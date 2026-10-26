import { timestamp } from '../core/export';
import { activeSegmentAt } from '../core/timeline';
import type { Segment } from '../core/types';

/** Browser playback adapter. The transcription engine never owns a player. */
export class TranscriptPlayer {
  private objectUrl?: string;
  private segments: readonly Segment[] = [];
  private rows: HTMLButtonElement[] = [];
  private activeIndex = -1;
  private readonly sync = () => this.highlight();
  private readonly reportMediaError = () => this.report('This browser could not play the file. Try an MP4 with H.264 video and AAC audio.');

  constructor(
    private readonly media: HTMLVideoElement,
    private readonly container: HTMLElement,
    private readonly report: (message: string) => void,
  ) {
    media.addEventListener('error', this.reportMediaError);
    for (const event of ['timeupdate', 'seeked', 'loadedmetadata', 'ended']) {
      media.addEventListener(event, this.sync);
    }
  }

  load(file: File): void {
    this.media.pause();
    this.media.removeAttribute('src');
    this.media.load();
    if (this.objectUrl) URL.revokeObjectURL(this.objectUrl);
    this.objectUrl = URL.createObjectURL(file);
    this.media.src = this.objectUrl;
    this.media.classList.toggle('audio-only', !isVideoFile(file));
    this.media.load();
    this.clearTranscript();
  }

  clearTranscript(): void {
    this.segments = [];
    this.rows = [];
    this.activeIndex = -1;
    this.container.replaceChildren();
  }

  setTranscript(segments: readonly Segment[]): void {
    this.clearTranscript();
    this.segments = segments;
    this.rows = segments.map((segment, index) => {
      const row = document.createElement('button');
      row.className = 'segment';
      const time = document.createElement('span');
      time.className = 'segment-time';
      time.textContent = timestamp(segment.start).slice(0, 8);
      const text = document.createElement('span');
      text.textContent = segment.text;
      row.append(time, text);
      row.setAttribute('aria-label', `Play from ${time.textContent}: ${segment.text.trim()}`);
      row.onclick = () => this.seek(index);
      this.container.append(row);
      return row;
    });
    this.highlight();
  }

  private seek(index: number): void {
    const segment = this.segments[index];
    if (!segment) return;
    try {
      this.media.currentTime = segment.start;
      this.highlight();
      void this.media.play().catch(() => {
        this.report('Playback moved to the timestamp. Press play to continue.');
      });
    } catch {
      this.report('The browser could not seek this file. Try a standard MP4 video.');
    }
  }

  private highlight(): void {
    const duration = Number.isFinite(this.media.duration) ? this.media.duration : Infinity;
    const nextIndex = activeSegmentAt(this.segments, this.media.currentTime, duration);
    if (nextIndex === this.activeIndex) return;
    if (this.activeIndex >= 0) {
      this.rows[this.activeIndex]?.classList.remove('is-active');
      this.rows[this.activeIndex]?.removeAttribute('aria-current');
    }
    this.activeIndex = nextIndex;
    if (nextIndex >= 0) {
      this.rows[nextIndex]?.classList.add('is-active');
      this.rows[nextIndex]?.setAttribute('aria-current', 'true');
    }
  }

  destroy(): void {
    this.media.pause();
    this.media.removeAttribute('src');
    this.media.load();
    for (const event of ['timeupdate', 'seeked', 'loadedmetadata', 'ended']) {
      this.media.removeEventListener(event, this.sync);
    }
    this.media.removeEventListener('error', this.reportMediaError);
    if (this.objectUrl) URL.revokeObjectURL(this.objectUrl);
    this.objectUrl = undefined;
    this.clearTranscript();
  }
}

export function isVideoFile(file: { type: string; name: string }): boolean {
  return file.type.startsWith('video/') || /\.(mp4|m4v|webm|mov|ogv|mkv)$/i.test(file.name);
}
