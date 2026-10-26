/** Platform-independent input/output types for transcription engines. */
export interface Segment {
  text: string;
  start: number;
  end: number | null;
}

export interface Transcript {
  text: string;
  segments: Segment[];
}

export interface TranscriptionOptions {
  language: 'auto' | 'english' | 'chinese';
  model: 'tiny' | 'base';
  device: 'wasm' | 'webgpu';
}

export interface Progress {
  message: string;
  percent?: number;
}

/** Samples must be mono PCM at 16 kHz. Implementations own their execution environment. */
export interface Transcriber {
  transcribe(
    samples: Float32Array,
    options: TranscriptionOptions,
    progress: (event: Progress) => void,
  ): Promise<Transcript>;
  cancel(): void;
}
