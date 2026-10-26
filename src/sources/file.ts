export const MAX_FILE_BYTES = 250 * 1024 * 1024;

export function validateFile(file: { size: number } | undefined): void {
  if (!file) throw new Error('Choose an audio or video file first.');
  if (file.size === 0) throw new Error('This file is empty. Choose a file containing audio.');
  if (file.size > MAX_FILE_BYTES) throw new Error('Choose a file smaller than 250 MB.');
}
