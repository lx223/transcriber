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

## Transcript from a URL (CLI)

The CLI prints the transcript of an online video. It first asks the site for its own subtitles (uploader subtitles, then automatic captions) and only if there are none downloads the audio and transcribes it locally with the same Whisper models as the app.

```sh
npm ci
npm run -s cli -- "https://www.ted.com/talks/ken_robinson_do_schools_kill_creativity" -f srt -o talk.srt
```

It needs a recent [yt-dlp](https://github.com/yt-dlp/yt-dlp) on `PATH`, plus `ffmpeg` for the Whisper fallback. The Docker image bundles both:

```sh
docker build -t transcriber .
docker run --rm -v transcriber-models:/cache transcriber "<url>" > transcript.txt
```

Once the `DOCKERHUB_USERNAME` repository variable and `DOCKERHUB_TOKEN` secret are set, every push to `main` also publishes the image to Docker Hub as `<username>/transcriber` for amd64 and arm64, so `docker run` works without building.

Options: `--lang en|zh|…`, `--format txt|srt|json`, `--output <file>`, `--source auto|subtitles|whisper`, `--model tiny|base|small`, `--cookies-from-browser <browser>`, `--cookies <file>`. Run with `--help` for details. Progress goes to stderr, the transcript to stdout.

- Any site yt-dlp supports works. Bilibili lists subtitles only to logged-in users, so pass cookies to get them; without cookies the CLI skips the subtitle lookup and goes straight to Whisper.
- Whisper here does not detect the language. The fallback uses `--lang`, then the language the site reports, then Chinese for Bilibili, then English.
- The fallback runs on CPU and has no length limit, so long videos take a while.
- Inside Docker, `--cookies-from-browser` cannot see your browser; mount a cookies file and use `--cookies`.
- `.claude/skills/transcribe` teaches Claude Code to use the CLI when given a video link.

## Module boundaries

- `src/core`: engine contracts, audio decoding/resampling, transcript exports.
- `src/sources/file.ts`: file input validation.
- `src/core/subtitles.ts`: SRT/WebVTT/json3 parsing and subtitle track selection.
- `src/transcription`: Whisper implementation (`whisper.ts`, shared with the CLI) and typed Worker protocol.
- `cli/main.ts`: URL-to-transcript CLI; shells out to yt-dlp and ffmpeg.
- `src/playback`: local video/audio object URLs, timestamp seeking, and transcript highlighting.
- `src/core/timeline.ts`: active-passage selection, independent of the DOM or inference engine.
- `src/main.ts`: UI and orchestration.

The transcription engine accepts mono 16 kHz PCM and produces text plus timestamped segments. It has no knowledge of URLs, files or the UI. The CLI produces the same audio input from a URL; another engine can implement the `Transcriber` interface. Browser audio decoding and Worker execution remain browser-specific.

TypeScript keeps browser integration straightforward. Transformers.js runs ONNX models through WebAssembly/WebGPU, so a separate Rust layer is unnecessary for this implementation.

## Limits

- The web app takes local files; use the CLI for URLs. Direct Bilibili-link downloading is not connected in the browser. A normal webpage needs a compatible hosted download/relay service to reliably resolve and retrieve Bilibili media; GitHub Pages cannot run that service. No extension or local server is required for file transcription. Live/tab capture is separate work.
- Browser codecs determine which containers work. Try WAV, MP3 or AAC if a file fails to decode.
- Files are limited to 250 MB and 30 minutes. Decoding happens in memory before inference; low-memory devices may need much shorter clips.
- The model processes overlapping 30-second windows. This is file transcription, not a live stream.
- Model loading/inference runs in a Worker. Cancel terminates it; browser audio decoding is not interruptible, but its result is discarded after cancellation.
- Whisper can make errors or hallucinate on silence. Review transcripts. Mixed-language speech may need experimentation with language selection.
- Automated tests cover input limits and subtitle formatting. Tiny was smoke-tested on CPU/WebAssembly in the browser with the public Transformers.js JFK English speech sample, producing the expected transcript. Chinese recognition, Base, and WebGPU still need device-specific testing; this is not an accuracy benchmark.

## Privacy and repository scope

The app has no server, analytics, persistence or cloud inference. Fonts use system-installed font families. External requests are needed to download model/runtime assets.

The web app does no downloading. The CLI downloads subtitles or audio from the URL you give it through yt-dlp, sends cookies only when you pass a cookies option, and deletes its temporary files when it finishes.

## Design

The interface uses a compact, responsive layout with a recording panel and a readable transcript workspace. See [design notes](docs/design.md) for the visual direction and skill reference.
