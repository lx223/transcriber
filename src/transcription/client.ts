import type { Transcriber, Transcript } from '../core/types';
import type { TranscriptionEvent } from './protocol';

export class WhisperTranscriber implements Transcriber {
  private worker?: Worker;
  private reject?: (reason: Error) => void;

  transcribe: Transcriber['transcribe'] = (samples, options, progress) => {
    this.cancel();
    return new Promise<Transcript>((resolve, reject) => {
      const worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
      this.worker = worker;
      this.reject = reject;

      const finish = () => {
        worker.terminate();
        this.worker = undefined;
        this.reject = undefined;
      };

      worker.onmessage = ({ data }: MessageEvent<TranscriptionEvent>) => {
        switch (data.type) {
          case 'progress':
            progress(data.value);
            break;
          case 'result':
            finish();
            resolve(data.value);
            break;
          case 'error':
            finish();
            reject(new Error(data.message));
            break;
        }
      };
      worker.onerror = event => {
        finish();
        reject(new Error(event.message || 'Transcription worker failed.'));
      };
      // Transfer a dedicated array so a caller's input remains available for a retry.
      const input = samples.slice();
      worker.postMessage({ samples: input, options }, [input.buffer]);
    });
  };

  cancel(): void {
    this.worker?.terminate();
    this.worker = undefined;
    this.reject?.(new Error('Cancelled'));
    this.reject = undefined;
  }
}
