import { env } from '@huggingface/transformers';
import type { TranscriptionEvent, TranscriptionRequest } from './protocol';
import { runWhisper } from './whisper';

env.allowLocalModels = false;

function send(event: TranscriptionEvent): void {
  self.postMessage(event);
}

self.onmessage = async ({ data }: MessageEvent<TranscriptionRequest>) => {
  const { samples, options } = data;
  try {
    const transcript = await runWhisper(
      samples,
      {
        model: options.model,
        device: options.device,
        language: options.language === 'auto' ? undefined : options.language,
      },
      (value) => send({ type: 'progress', value }),
    );
    send({ type: 'result', value: transcript });
  } catch (error) {
    send({ type: 'error', message: error instanceof Error ? error.message : String(error) });
  }
};
