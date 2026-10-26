import type { Segment } from './types';

/** Segments are ordered by start time, as returned by the transcription engine. */
export function activeSegmentAt(segments: readonly Segment[], time: number, duration = Infinity): number {
  if (!Number.isFinite(time) || time < 0 || time >= duration) return -1;
  // Prefer the latest passage when adjacent inference windows overlap.
  for (let index = segments.length - 1; index >= 0; index--) {
    const segment = segments[index];
    if (time < segment.start) continue;
    const end = segment.end ?? segments[index + 1]?.start ?? duration;
    if (time < end) return index;
  }
  return -1;
}
