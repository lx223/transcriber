import { execFile, spawn } from 'node:child_process';
import { mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { extname, join } from 'node:path';
import { parseArgs, promisify } from 'node:util';
import { toSrt } from '../src/core/export';
import { chooseSubtitle, parseSubtitles } from '../src/core/subtitles';
import type { Transcript } from '../src/core/types';

const USAGE = `Usage: npm run cli -- <url> [options]

Prints the transcript of a video. Uses the site's own subtitles when it has them,
otherwise downloads the audio and transcribes it locally with Whisper.

Options:
  -l, --lang <code>             Language, e.g. en or zh (default: the video's language)
  -f, --format <txt|srt|json>   Output format (default: txt)
  -o, --output <file>           Write to a file instead of stdout
  -s, --source <auto|subtitles|whisper>
                                Where the transcript comes from (default: auto)
  -m, --model <tiny|base|small> Whisper model for the fallback (default: base)
      --cookies-from-browser <browser>
                                Use this browser's login, e.g. chrome. Bilibili only
                                lists subtitles to logged-in users.
      --cookies <file>          Netscape cookies file, as for yt-dlp
  -h, --help                    Show this help

Set TRANSCRIBER_CACHE to choose where Whisper model files are cached.
Requires yt-dlp on PATH, plus ffmpeg for the Whisper fallback.`;

const run = promisify(execFile);
const log = (message: string) => process.stderr.write(`${message}\n`);

async function tool(command: string, args: string[]): Promise<string> {
  try {
    return (await run(command, args, { maxBuffer: 1 << 28 })).stdout;
  } catch (error) {
    const failure = error as NodeJS.ErrnoException & { stderr?: string };
    if (failure.code === 'ENOENT') throw new Error(`${command} is not installed or not on PATH.`);
    throw new Error(failure.stderr?.trim() || failure.message);
  }
}

async function fromSubtitles(
  url: string, info: Parameters<typeof chooseSubtitle>[0], language: string | undefined, cookies: string[], dir: string,
): Promise<Transcript | undefined> {
  const choice = chooseSubtitle(info, language);
  if (!choice) return undefined;
  log(`Fetching ${choice.automatic ? 'automatic captions' : 'subtitles'} (${choice.language})…`);
  await tool('yt-dlp', [
    ...cookies, '--no-playlist', '--skip-download', choice.automatic ? '--write-auto-subs' : '--write-subs',
    '--sub-langs', choice.language, '--sub-format', 'json3/srt/vtt', '-o', join(dir, 'sub.%(ext)s'), '--', url,
  ]);
  const file = (await readdir(dir)).find((name) => name.startsWith('sub.'));
  if (!file) return undefined;
  const transcript = parseSubtitles(await readFile(join(dir, file), 'utf8'), extname(file).slice(1));
  return transcript.segments.length ? transcript : undefined;
}

/** Decodes any media file to mono 16 kHz float PCM, the input Whisper expects. */
function decode(file: string): Promise<Float32Array> {
  return new Promise((resolve, reject) => {
    const ffmpeg = spawn('ffmpeg', ['-v', 'error', '-i', file, '-f', 'f32le', '-ac', '1', '-ar', '16000', 'pipe:1'],
      { stdio: ['ignore', 'pipe', 'pipe'] });
    const chunks: Buffer[] = [];
    let errors = '';
    ffmpeg.stdout.on('data', (chunk: Buffer) => chunks.push(chunk));
    ffmpeg.stderr.on('data', (chunk: Buffer) => { errors += chunk; });
    ffmpeg.on('error', (error: NodeJS.ErrnoException) =>
      reject(error.code === 'ENOENT' ? new Error('ffmpeg is not installed or not on PATH.') : error));
    ffmpeg.on('close', (code) => {
      if (code !== 0) return reject(new Error(errors.trim() || `ffmpeg exited with code ${code}`));
      const bytes = Buffer.concat(chunks);
      const samples = new Float32Array(Math.floor(bytes.length / 4));
      new Uint8Array(samples.buffer).set(bytes.subarray(0, samples.length * 4));
      resolve(samples);
    });
  });
}

async function fromWhisper(
  url: string, language: string, model: string, cookies: string[], dir: string,
): Promise<Transcript> {
  log('Downloading audio…');
  await tool('yt-dlp', [...cookies, '--no-playlist', '-f', 'bestaudio/best', '-o', join(dir, 'audio.%(ext)s'), '--', url]);
  const file = (await readdir(dir)).find((name) => name.startsWith('audio.'));
  if (!file) throw new Error('yt-dlp did not produce an audio file.');
  const samples = await decode(join(dir, file));
  if (!samples.length) throw new Error('The download does not contain decodable audio.');

  const { runWhisper } = await import('../src/transcription/whisper');
  if (process.env.TRANSCRIBER_CACHE) (await import('@huggingface/transformers')).env.cacheDir = process.env.TRANSCRIBER_CACHE;
  const seen = new Set<string>();
  return runWhisper(samples, { model, language, device: 'cpu' }, ({ message }) => {
    if (!seen.has(message)) log(message);
    seen.add(message);
  });
}

async function main(): Promise<void> {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      lang: { type: 'string', short: 'l' },
      format: { type: 'string', short: 'f', default: 'txt' },
      output: { type: 'string', short: 'o' },
      source: { type: 'string', short: 's', default: 'auto' },
      model: { type: 'string', short: 'm', default: 'base' },
      'cookies-from-browser': { type: 'string' },
      cookies: { type: 'string' },
      help: { type: 'boolean', short: 'h' },
    },
  });
  if (values.help) return void console.log(USAGE);
  const [url] = positionals;
  const check = (name: string, value: string, allowed: string[]) => {
    if (!allowed.includes(value)) throw new Error(`--${name} must be one of: ${allowed.join(', ')}`);
  };
  if (positionals.length !== 1 || !/^https?:\/\//.test(url)) throw new Error('Pass exactly one http(s) URL.');
  check('format', values.format, ['txt', 'srt', 'json']);
  check('source', values.source, ['auto', 'subtitles', 'whisper']);
  check('model', values.model, ['tiny', 'base', 'small']);

  const loggedIn = Boolean(values['cookies-from-browser'] || values.cookies);
  const cookies = [
    '--js-runtimes', 'node',
    ...(values['cookies-from-browser'] ? ['--cookies-from-browser', values['cookies-from-browser']] : []),
    ...(values.cookies ? ['--cookies', values.cookies] : []),
  ];
  const dir = await mkdtemp(join(tmpdir(), 'transcriber-'));
  try {
    log('Reading video details…');
    const info = JSON.parse(await tool('yt-dlp', [...cookies, '--no-playlist', '-J', '--skip-download', '--', url]));
    let transcript: Transcript | undefined;
    const isBilibili = /bilibili/i.test(info.extractor ?? '');
    // Bilibili lists subtitles only to logged-in users, so without cookies there is nothing to look up.
    const subtitlesNeedLogin = isBilibili && !loggedIn;
    if (values.source === 'subtitles' && subtitlesNeedLogin) {
      throw new Error('Bilibili only lists subtitles to logged-in users. Pass --cookies-from-browser or --cookies.');
    }
    if (values.source !== 'whisper' && subtitlesNeedLogin) {
      log('Skipping subtitles: Bilibili only lists them to logged-in users (pass --cookies-from-browser to use them).');
    } else if (values.source !== 'whisper') {
      transcript = await fromSubtitles(url, info, values.lang, cookies, dir);
      if (!transcript) {
        if (values.source === 'subtitles') throw new Error(`No subtitles found${values.lang ? ` for "${values.lang}"` : ''}.`);
        log('No subtitles found, falling back to Whisper.');
      }
    }
    if (!transcript) {
      // Whisper here does not detect the language itself; without one it assumes English.
      const language = values.lang ?? info.language ?? (isBilibili ? 'zh' : undefined);
      if (!language) log('Spoken language unknown, assuming English. Pass --lang if that is wrong.');
      transcript = await fromWhisper(url, language ?? 'en', values.model, cookies, dir);
    }

    const output = {
      txt: () => `${transcript.segments.map((segment) => segment.text.trim()).filter(Boolean).join('\n') || transcript.text.trim()}\n`,
      srt: () => toSrt(transcript, info.duration ?? transcript.segments.at(-1)?.start ?? 0),
      json: () => `${JSON.stringify({ title: info.title, url: info.webpage_url ?? url, ...transcript }, null, 2)}\n`,
    }[values.format as 'txt' | 'srt' | 'json']();
    if (values.output) await writeFile(values.output, output);
    else process.stdout.write(output);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

main().catch((error) => {
  log(`Error: ${error instanceof Error ? error.message : String(error)}\n\nRun with --help for usage.`);
  process.exitCode = 1;
});
