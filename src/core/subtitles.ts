import type { Segment, Transcript } from './types';

/** Parsers for subtitle files published by video sites. Pure text in, Transcript out. */

function toTranscript(segments: Segment[]): Transcript {
  return { text: segments.map((segment) => segment.text).join('\n'), segments };
}

const CUE_TIME = /(?:(\d+):)?(\d{1,2}):(\d{2})[.,](\d{1,3})/g;

function seconds([, hours, minutes, secs, fraction]: RegExpMatchArray): number {
  return Number(hours ?? 0) * 3600 + Number(minutes) * 60 + Number(secs) + Number(fraction.padEnd(3, '0')) / 1000;
}

/**
 * Parses SRT and WebVTT cues. Inline tags are stripped and consecutive repeats dropped.
 * Line-based, so cues that are not separated by a blank line still parse.
 */
export function parseCues(source: string): Transcript {
  const segments: Segment[] = [];
  let cue: { start: number; end: number; lines: string[] } | undefined;
  const flush = () => {
    const text = cue?.lines.join(' ').replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
    if (cue && text && text !== segments.at(-1)?.text) segments.push({ text, start: cue.start, end: cue.end });
    cue = undefined;
  };
  for (const line of source.split(/\r?\n/)) {
    const [start, end] = line.includes('-->') ? [...line.matchAll(CUE_TIME)] : [];
    if (start && end) {
      flush();
      cue = { start: seconds(start), end: seconds(end), lines: [] };
    } else if (!line.trim()) {
      flush();
    } else {
      cue?.lines.push(line);
    }
  }
  flush();
  return toTranscript(segments);
}

interface Json3 {
  events?: { tStartMs?: number; dDurationMs?: number; segs?: { utf8?: string }[] }[];
}

/** Parses YouTube's json3 caption format. Ends are clipped so rolling captions do not overlap. */
export function parseJson3(source: string): Transcript {
  const segments: Segment[] = [];
  for (const event of (JSON.parse(source) as Json3).events ?? []) {
    const text = (event.segs ?? []).map((seg) => seg.utf8 ?? '').join('').replace(/\s+/g, ' ').trim();
    if (!text) continue;
    const start = (event.tStartMs ?? 0) / 1000;
    const previous = segments.at(-1);
    if (previous && previous.end !== null && previous.end > start) previous.end = start;
    segments.push({ text, start, end: start + (event.dDurationMs ?? 0) / 1000 });
  }
  return toTranscript(segments);
}

export function parseSubtitles(source: string, ext: string): Transcript {
  return ext === 'json3' ? parseJson3(source) : parseCues(source);
}

export interface SubtitleChoice {
  language: string;
  automatic: boolean;
}

/** Tracks that are not speech transcripts: Bilibili danmaku comments, YouTube live chat. */
const NOT_SPEECH = new Set(['danmaku', 'live_chat']);

function matches(track: string, language: string): boolean {
  const base = track.toLowerCase().replace(/^ai-/, '');
  const wanted = language.toLowerCase();
  return base === wanted || base.startsWith(`${wanted}-`);
}

/**
 * Picks a subtitle track from yt-dlp metadata. Uploader subtitles beat automatic captions.
 * Without a requested language, the video's own language is used so translations are avoided.
 */
export function chooseSubtitle(
  info: { subtitles?: Record<string, unknown>; automatic_captions?: Record<string, unknown>; language?: string | null },
  language?: string,
): SubtitleChoice | undefined {
  const manual = Object.keys(info.subtitles ?? {}).filter((track) => !NOT_SPEECH.has(track));
  const automatic = Object.keys(info.automatic_captions ?? {}).filter((track) => !NOT_SPEECH.has(track));
  const wanted = language ?? info.language ?? undefined;
  const find = (tracks: string[]) =>
    wanted ? tracks.find((track) => track.toLowerCase() === wanted.toLowerCase()) ?? tracks.find((track) => matches(track, wanted)) : undefined;

  const manualMatch = find(manual);
  if (manualMatch) return { language: manualMatch, automatic: false };
  if (!language && manual.length) return { language: manual[0], automatic: false };

  // YouTube marks the untranslated automatic track with an "-orig" suffix.
  const original = automatic.filter((track) => track.endsWith('-orig'));
  const automaticMatch = find(original) ?? find(automatic) ?? (language ? undefined : original[0] ?? automatic[0]);
  return automaticMatch ? { language: automaticMatch, automatic: true } : undefined;
}
