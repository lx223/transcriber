import './style.css';
import { decodeAudio } from './core/audio';
import { toSrt } from './core/export';
import type { Transcript, TranscriptionOptions } from './core/types';
import { validateFile } from './sources/file';
import { WhisperTranscriber } from './transcription/client';
import { TranscriptPlayer, isVideoFile } from './playback/transcript-player';

// UI concerns stay here; the engine accepts PCM and knows nothing about files or the DOM.
document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
<a class="skip-link" href="#main">Skip to transcriber</a>
<header class="site-header">
  <a class="brand" href="./" aria-label="Transcriber home">
    <svg class="brand-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 10v4m5-8v12m5-15v18m5-12v6" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>
    transcriber
  </a>
  <span class="privacy"><svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><rect x="4.5" y="8.5" width="11" height="8" rx="2" stroke="currentColor" stroke-width="1.4"/><path d="M7 8V6a3 3 0 0 1 6 0v2" stroke="currentColor" stroke-width="1.4"/></svg>Processed on your device</span>
</header>
<main id="main">
  <div class="page-heading">
    <h1>Watch, read, and find every word.</h1>
    <p>Choose a video, transcribe it on your device, and jump to any moment.</p>
  </div>
  <div class="workspace">
    <section class="input-panel" aria-labelledby="source-heading">
      <div class="section-title"><h2 id="source-heading">Recording</h2></div>
      <form id="form" novalidate>
        <label class="drop" id="drop-zone" for="file">
          <svg class="upload-icon" viewBox="0 0 32 32" fill="none" aria-hidden="true"><path d="M16 21V7m-5 5 5-5 5 5M7 21v4a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>
          <strong id="file-name">Drop your audio or video here</strong>
          <span class="file-picker">Choose a file</span>
          <span class="file-formats" id="file-detail">MP3, WAV, M4A or MP4</span>
          <input id="file" class="visually-hidden" type="file" accept="audio/*,video/*" aria-label="Choose an audio or video file" aria-describedby="file-limit">
        </label>
        <p class="hint" id="file-limit">Up to 250 MB and 30 minutes.</p>
        <div class="settings">
          <div><label for="language">Language</label><select id="language"><option value="auto">Auto-detect</option><option value="chinese">Chinese 中文</option><option value="english">English</option></select></div>
          <div><label for="model">Model</label><select id="model"><option value="base">Base (balanced)</option><option value="tiny">Tiny (faster)</option></select></div>
        </div>
        <details class="advanced">
          <summary>Advanced options</summary>
          <label for="device">Processing device</label>
          <select id="device"><option value="wasm">CPU / WebAssembly</option><option value="webgpu">WebGPU (experimental)</option></select>
          <p class="hint">Use CPU for compatibility. GPU support depends on your browser.</p>
        </details>
        <button class="primary" id="start" type="submit">Transcribe</button>
        <button class="cancel" id="cancel" type="button" hidden>Cancel transcription</button>
      </form>
      <p class="footnote">First use downloads the speech model.<br>Your recording stays on your device.</p>
    </section>
    <section class="output-panel" aria-labelledby="output-heading">
      <div class="section-title"><h2 id="output-heading">Transcript</h2><span class="badge" id="badge">Ready</span></div>
      <div id="status" class="status" role="status" aria-live="polite" hidden></div>
      <progress id="progress" hidden max="100" aria-label="Model download progress"></progress>
      <div id="empty" class="empty-state">
        <svg class="document-icon" viewBox="0 0 48 56" fill="none" aria-hidden="true"><rect x="5" y="3" width="38" height="50" rx="5" fill="white" stroke="currentColor" stroke-width="1.4"/><path d="M14 17h20M14 25h20M14 33h15M14 41h11" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>
        <h3>A clear view of every word.</h3>
        <p>Choose a video or audio file to begin.<br>Transcript timestamps will take you straight to the matching moment.</p>
      </div>
      <div id="media-preview" class="media-preview" hidden>
        <h3 id="title" class="recording-title"></h3>
        <video id="player" controls playsinline preload="metadata" aria-label="Source video or audio"></video>
      </div>
      <div id="result" hidden>
        <p class="playback-hint">Select a timestamp to play from that moment. The current passage is highlighted as you watch.</p>
        <div class="exports"><button id="txt">Download text</button><button id="srt">Download SRT</button><button id="copy">Copy text</button></div>
        <div id="segments"></div>
      </div>
    </section>
  </div>
  <footer><span>No account or API key needed.</span><a href="https://huggingface.co/onnx-community/whisper-base" target="_blank" rel="noreferrer">Speech recognition by Whisper</a></footer>
</main>`;

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const engine = new WhisperTranscriber();
const fileInput = $<HTMLInputElement>('file');
let controller: AbortController | undefined;
let transcript: Transcript | undefined;
let duration = 0;
let busy = false;
let selectedFile: File | undefined;
const playback = new TranscriptPlayer($<HTMLVideoElement>('player'), $('segments'), message => status(message));

function selectFile(file: File | undefined): void {
  if (busy || !file) return;
  try {
    validateFile(file);
    selectedFile = file;
    clearResult();
    playback.load(file);
    $('title').textContent = file.name;
    $('media-preview').hidden = false;
    $('empty').hidden = true;
    $('badge').textContent = 'Ready';
    $('file-name').textContent = file.name;
    $('file-detail').textContent = `${(file.size / 1024 / 1024).toFixed(1)} MB · Ready to transcribe`;
    $('drop-zone').classList.add('has-file');
    status(`${isVideoFile(file) ? 'Video' : 'Audio'} ready to preview. Select Transcribe to create the transcript.`);
  } catch (error) {
    status(error instanceof Error ? error.message : String(error), undefined, true);
  }
}

fileInput.onchange = () => selectFile(fileInput.files?.[0]);
const dropZone = $('drop-zone');
for (const eventName of ['dragenter', 'dragover']) {
  dropZone.addEventListener(eventName, event => {
    event.preventDefault();
    if (!busy) dropZone.classList.add('drag-over');
  });
}
for (const eventName of ['dragleave', 'drop']) {
  dropZone.addEventListener(eventName, () => dropZone.classList.remove('drag-over'));
}
dropZone.addEventListener('drop', event => {
  event.preventDefault();
  if (!busy) selectFile(event.dataTransfer?.files[0]);
});

function status(message: string, percent?: number, error = false): void {
  $('status').textContent = message;
  $('status').hidden = !message;
  $('status').classList.toggle('error', error);
  const progress = $<HTMLProgressElement>('progress');
  progress.hidden = !busy;
  if (percent == null) progress.removeAttribute('value');
  else progress.value = percent;
}

function setBusy(value: boolean): void {
  busy = value;
  for (const el of document.querySelectorAll<HTMLInputElement | HTMLSelectElement>('#form input, #form select')) {
    el.disabled = value;
  }
  $<HTMLButtonElement>('start').disabled = value;
  $('cancel').hidden = !value;
  $('drop-zone').classList.toggle('is-disabled', value);
  $('start').textContent = value ? 'Transcribing…' : 'Transcribe';
  $('badge').textContent = value ? 'Transcribing' : transcript ? 'Complete' : 'Ready';
  if (!value) $('progress').hidden = true;
}

function clearResult(): void {
  transcript = undefined;
  $('empty').hidden = false;
  $('result').hidden = true;
  playback.clearTranscript();
}

function showResult(result: Transcript): void {
  transcript = result;
  $('empty').hidden = true;
  $('result').hidden = false;
  playback.setTranscript(result.segments);
  if (!result.segments.length) $('segments').textContent = result.text || 'No speech detected.';
  $<HTMLButtonElement>('srt').disabled = !result.segments.length;
}

$('cancel').onclick = () => {
  controller?.abort();
  engine.cancel();
};

$('form').onsubmit = async event => {
  event.preventDefault();
  if (busy) return;
  const selected = selectedFile;
  try {
    validateFile(selected);
  } catch (error) {
    status(error instanceof Error ? error.message : String(error), undefined, true);
    return;
  }
  // validateFile guarantees a file exists; keep the explicit guard for type narrowing.
  if (!selected) return;

  setBusy(true);
  clearResult();
  $('empty').hidden = true;
  const operation = controller = new AbortController();
  try {
    status('Decoding and resampling audio to 16 kHz…');
    const samples = await decodeAudio(selected);
    duration = samples.length / 16000;
    operation.signal.throwIfAborted();
    const options: TranscriptionOptions = {
      language: $<HTMLSelectElement>('language').value as TranscriptionOptions['language'],
      model: $<HTMLSelectElement>('model').value as TranscriptionOptions['model'],
      device: $<HTMLSelectElement>('device').value as TranscriptionOptions['device'],
    };
    if (options.device === 'webgpu' && !('gpu' in navigator)) {
      throw new Error('WebGPU is unavailable. Select CPU / WebAssembly and try again.');
    }
    const result = await engine.transcribe(samples, options, p => status(p.message, p.percent));
    showResult(result);
    status(`Complete · ${(duration / 60).toFixed(1)} min of audio · ${options.model} model`);
  } catch (error) {
    status(operation.signal.aborted
      ? 'Cancelled. Your file is ready to try again.'
      : error instanceof Error ? error.message : String(error), undefined, !operation.signal.aborted);
  } finally {
    setBusy(false);
    controller = undefined;
  }
};

function download(content: string, extension: string): void {
  const objectUrl = URL.createObjectURL(new Blob([content], { type: 'text/plain;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = objectUrl;
  link.download = `transcript.${extension}`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
}

$('txt').onclick = () => { if (transcript) download(transcript.text, 'txt'); };
$('srt').onclick = () => { if (transcript) download(toSrt(transcript, duration), 'srt'); };
$('copy').onclick = async () => {
  try {
    if (transcript) {
      await navigator.clipboard.writeText(transcript.text);
      status('Transcript copied.');
    }
  } catch {
    status('Clipboard unavailable. Download the text instead.');
  }
};

window.addEventListener('pagehide', () => {
  engine.cancel();
  playback.destroy();
});
