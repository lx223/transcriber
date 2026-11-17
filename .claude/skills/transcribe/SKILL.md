---
name: transcribe
description: Get the transcript of an online video or audio URL (YouTube, Bilibili, TED, podcasts, direct media links and other yt-dlp-supported sites). Use when the user gives a video link and wants its transcript, subtitles, or a summary/answer based on what is said in it.
---

# Transcribe a URL

This repository ships a CLI that prints a video's transcript. It uses the site's own subtitles when they exist and otherwise downloads the audio and runs Whisper locally.

## Run it

From the repository root (needs `npm ci` once, `yt-dlp` on PATH, and `ffmpeg` for the fallback):

```bash
npm run -s cli -- "<url>" -o transcript.txt
```

If `yt-dlp` or `ffmpeg` is missing and Docker is available, use the image instead:

```bash
docker build -t transcriber .
```

```bash
docker run --rm -v transcriber-models:/cache transcriber "<url>" > transcript.txt
```

The transcript goes to stdout (or `-o`); progress and errors go to stderr. Write long transcripts to a file and read that, rather than printing them into the conversation.

## Options

- `-f txt|srt|json`: `txt` is one line per passage (default); `srt` and `json` keep timestamps. Use `json` when the user wants to cite times.
- `-l <code>`: language such as `en` or `zh`. Defaults to the video's own language. Pass it when the user names a language, or when the Whisper fallback says it is assuming English and the video is not English.
- `-s auto|subtitles|whisper`: `subtitles` fails fast instead of transcribing; `whisper` ignores site subtitles.
- `-m tiny|base|small`: Whisper model for the fallback. `base` is the default; `small` is slower and more accurate.
- `--cookies-from-browser <browser>` or `--cookies <file>`: use a logged-in session.

## Things to know

- Bilibili only lists subtitles to logged-in users. Without cookies the CLI still works but falls back to Whisper, which is much slower. Ask the user before reading their browser cookies.
- YouTube often blocks cloud/datacenter IPs ("Sign in to confirm you're not a bot"). That is a network restriction, not a bug; it works from a home connection or with cookies.
- The Whisper fallback runs on CPU, roughly real time or slower for long videos with `base`. Tell the user before starting a long one, and run it in the background.
- Site subtitles may be automatic captions, and Whisper can mishear or invent text on silence. Say which source the transcript came from (stderr reports it) when accuracy matters.
