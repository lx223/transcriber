import { pipeline } from '@huggingface/transformers';
import type { Progress, Transcript } from '../core/types';

export interface WhisperOptions {
  model: string;
  /** Whisper language name or code. Omit to let the model detect it. */
  language?: string;
  device: 'wasm' | 'webgpu' | 'cpu';
}

/** Runs Whisper on mono 16 kHz PCM. Shared by the browser Worker and the Node CLI. */
export async function runWhisper(
  samples: Float32Array,
  options: WhisperOptions,
  progress: (event: Progress) => void,
): Promise<Transcript> {
  progress({ message: 'Loading Whisper. The first run downloads and caches model files.' });
  const transcribe = await pipeline(
    'automatic-speech-recognition',
    `onnx-community/whisper-${options.model}`,
    {
      device: options.device,
      dtype: 'q8',
      progress_callback: (event: { status: string; file?: string; progress?: number }) => {
        if (event.status === 'progress') {
          progress({ message: `Downloading ${event.file}`, percent: event.progress });
        }
      },
    },
  );
  try {
    const where = { webgpu: 'GPU', wasm: 'CPU / WebAssembly', cpu: 'CPU' }[options.device];
    progress({ message: `Transcribing on ${where}…` });
    const output = await transcribe(samples, {
      chunk_length_s: 30,
      stride_length_s: 5,
      return_timestamps: true,
      task: 'transcribe',
      ...(options.language ? { language: options.language } : {}),
    });
    const result = Array.isArray(output) ? output[0] : output;
    return {
      text: result.text,
      segments: (result.chunks ?? []).map(
        (chunk: { text: string; timestamp: [number | null, number | null] }) => ({
          text: chunk.text,
          start: chunk.timestamp[0] ?? 0,
          end: chunk.timestamp[1],
        }),
      ),
    };
  } finally {
    await transcribe.dispose();
  }
}
