import type { Progress, Transcript, TranscriptionOptions } from '../core/types';

export interface TranscriptionRequest {
  samples: Float32Array;
  options: TranscriptionOptions;
}

export type TranscriptionEvent =
  | { type: 'progress'; value: Progress }
  | { type: 'result'; value: Transcript }
  | { type: 'error'; message: string };
