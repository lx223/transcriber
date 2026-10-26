import type { Transcript } from './types';

export function timestamp(seconds: number, separator = ','): string {
  const ms = Math.round(Math.max(0, seconds) * 1000);
  const hours = String(Math.floor(ms / 3600000)).padStart(2, '0');
  const minutes = String(Math.floor(ms / 60000) % 60).padStart(2, '0');
  const wholeSeconds = String(Math.floor(ms / 1000) % 60).padStart(2, '0');
  const milliseconds = String(ms % 1000).padStart(3, '0');
  return `${hours}:${minutes}:${wholeSeconds}${separator}${milliseconds}`;
}

export function toSrt(transcript: Transcript, duration: number): string {
  return transcript.segments.map((segment, index, all) => {
    const end = Math.max(segment.start, segment.end ?? all[index + 1]?.start ?? duration);
    return `${index + 1}\n${timestamp(segment.start)} --> ${timestamp(end)}\n${segment.text.trim()}\n`;
  }).join('\n');
}
