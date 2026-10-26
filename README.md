# Transcriber

Transcribe audio and video files in your browser with multilingual Whisper. Supports English and Chinese, an HTML video player, synchronized transcript highlighting, timestamp seeking, and TXT/SRT export. No account, API key or transcription backend.

## Run locally

Requires Node.js 22 or later.

```sh
npm ci
npm run dev
```

Open the URL printed by Vite, normally http://127.0.0.1:5173. Choose an audio/video file, language and model, then click **Create transcript**. Tiny is faster; Base is the default for better accuracy. CPU/WebAssembly is the compatibility default; WebGPU is opt-in and depends on browser/hardware support.

Selecting a file immediately opens a local preview in the HTML video player. After transcription, click a timestamp to seek and play that passage. The active passage is highlighted as the video plays, including after seeking with the player controls. Audio-only files use compact playback controls. Choosing another file clears the previous transcript.

The first run downloads model weights from Hugging Face and the inference runtime. Downloads may be tens to hundreds of megabytes and are cached by the browser where supported. Inference and audio processing happen on-device. Files and transcripts are not uploaded or saved by the app. Model downloads require network access; browser cache availability does not guarantee offline operation.

## Validate and build

```sh
npm test
npm run build
npm run preview
```

`npm run build` type-checks and creates a static app in `dist/`. Serve it over HTTPS (or localhost). Relative asset paths support deployment under a subdirectory. The GitHub Actions workflow tests and builds every pull request, then deploys successful builds from `main` to GitHub Pages. The live app is served at https://lanxiao.dev/transcriber/.

## Module boundaries

- `src/core`: engine contracts, audio decoding/resampling, transcript exports.
- `src/sources/file.ts`: file input validation.
- `src/transcription`: Whisper implementation and typed Worker protocol.
- `src/playback`: local video/audio object URLs, timestamp seeking, and transcript highlighting.
- `src/core/timeline.ts`: active-passage selection, independent of the DOM or inference engine.
- `src/main.ts`: UI and orchestration.

The transcription engine accepts mono 16 kHz PCM and produces text plus timestamped segments. It has no knowledge of URLs, files or the UI. Future capture/downloader adapters can produce the same audio input; another engine can implement the `Transcriber` interface. Browser audio decoding and Worker execution remain browser-specific. No speculative CLI/MCP framework is included.

TypeScript keeps browser integration straightforward. Transformers.js runs ONNX models through WebAssembly/WebGPU, so a separate Rust layer is unnecessary for this implementation.

## Limits

- This version takes local files. Direct Bilibili-link downloading is not connected. A normal webpage needs a compatible hosted download/relay service to reliably resolve and retrieve Bilibili media; GitHub Pages cannot run that service. No extension or local server is required for file transcription. Live/tab capture is separate work.
- Browser codecs determine which containers work. Try WAV, MP3 or AAC if a file fails to decode.
- Files are limited to 250 MB and 30 minutes. Decoding happens in memory before inference; low-memory devices may need much shorter clips.
- The model processes overlapping 30-second windows. This is file transcription, not a live stream.
- Model loading/inference runs in a Worker. Cancel terminates it; browser audio decoding is not interruptible, but its result is discarded after cancellation.
- Whisper can make errors or hallucinate on silence. Review transcripts. Mixed-language speech may need experimentation with language selection.
- Automated tests cover input limits and subtitle formatting. Tiny was smoke-tested on CPU/WebAssembly in the browser with the public Transformers.js JFK English speech sample, producing the expected transcript. Chinese recognition, Base, and WebGPU still need device-specific testing; this is not an accuracy benchmark.

## Privacy and repository scope

The app has no server, analytics, persistence or cloud inference. Fonts use system-installed font families. External requests are needed to download model/runtime assets.

This repository contains the file transcription app. Video-source downloading is outside its scope.

## Design

The interface uses a compact, responsive layout with a recording panel and a readable transcript workspace. See [design notes](docs/design.md) for the visual direction and skill reference.
