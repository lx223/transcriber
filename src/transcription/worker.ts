import { env, pipeline } from '@huggingface/transformers';
import type { TranscriptionEvent, TranscriptionRequest } from './protocol';

env.allowLocalModels = false;

function send(event: TranscriptionEvent): void {
  self.postMessage(event);
}

self.onmessage = async ({ data }: MessageEvent<TranscriptionRequest>) => {
  const { samples, options } = data;
  const progress = (message: string, percent?: number) =>
    send({ type: 'progress', value: { message, percent } });

  try {
    progress('Loading Whisper. The first run downloads and caches model files.');
    const transcribe = await pipeline(
      'automatic-speech-recognition',
      `onnx-community/whisper-${options.model}`,
      {
        device: options.device,
        dtype: 'q8',
        progress_callback: (event: { status: string; file?: string; progress?: number }) => {
          if (event.status === 'progress') {
            progress(`Downloading ${event.file}`, event.progress);
          }
        },
      },
    );
    try {
      progress(`Transcribing on ${options.device === 'webgpu' ? 'GPU' : 'CPU / WebAssembly'}…`);
      const output = await transcribe(samples, {
        chunk_length_s: 30,
        stride_length_s: 5,
        return_timestamps: true,
        task: 'transcribe',
        ...(options.language === 'auto' ? {} : { language: options.language }),
      });
      const result = Array.isArray(output) ? output[0] : output;
      const transcript = {
        text: result.text,
        segments: (result.chunks ?? []).map(
          (chunk: { text: string; timestamp: [number | null, number | null] }) => ({
            text: chunk.text,
            start: chunk.timestamp[0] ?? 0,
            end: chunk.timestamp[1],
          }),
        ),
      };
      await transcribe.dispose();
      send({ type: 'result', value: transcript });
    } catch (error) {
      await transcribe.dispose();
      throw error;
    }
  } catch (error) {
    send({ type: 'error', message: error instanceof Error ? error.message : String(error) });
  }
};
