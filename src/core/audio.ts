/** Browser decoding is separate from inference so the engine only handles PCM. */
export async function decodeAudio(blob: Blob): Promise<Float32Array> {
  const context = new AudioContext();
  try {
    const decoded = await context.decodeAudioData(await blob.arrayBuffer());
    if (!Number.isFinite(decoded.duration) || decoded.duration <= 0) {
      throw new Error('The file does not contain decodable audio.');
    }
    if (decoded.duration > 60 * 30) {
      throw new Error('Use a clip under 30 minutes to keep browser memory bounded.');
    }

    const offline = new OfflineAudioContext(1, Math.ceil(decoded.duration * 16000), 16000);
    const source = offline.createBufferSource();
    source.buffer = decoded;
    source.connect(offline.destination);
    source.start();
    return (await offline.startRendering()).getChannelData(0);
  } catch (error) {
    if (error instanceof DOMException && error.name === 'EncodingError') {
      throw new Error('Your browser cannot decode this format. Try a WAV, MP3, or AAC audio file.');
    }
    throw error;
  } finally {
    await context.close();
  }
}
