import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chooseSubtitle, parseCues, parseJson3 } from '../src/core/subtitles.ts';

test('parses SRT cues, joining lines and stripping tags', () => {
  const srt = '1\r\n00:00:01,500 --> 00:00:03,000\r\n你好\r\n世界\r\n\r\n2\r\n01:00:00,000 --> 01:00:02,250\r\n<i>hello</i>\r\n';
  assert.deepEqual(parseCues(srt).segments, [
    { text: '你好 世界', start: 1.5, end: 3 },
    { text: 'hello', start: 3600, end: 3602.25 },
  ]);
});

test('parses WebVTT with short timestamps and drops rolling repeats', () => {
  const vtt = 'WEBVTT\nKind: captions\n\n00:00.000 --> 00:00.001\n\u00a0\n00:01.000 --> 00:02.000 align:start\nhello\n\n00:02.000 --> 00:03.000\nhello\n\n00:03.000 --> 00:04.000\n<c>world</c>\n';
  const transcript = parseCues(vtt);
  assert.deepEqual(transcript.segments, [
    { text: 'hello', start: 1, end: 2 },
    { text: 'world', start: 3, end: 4 },
  ]);
  assert.equal(transcript.text, 'hello\nworld');
});

test('parses json3, skipping empty events and clipping overlaps', () => {
  const json3 = JSON.stringify({ events: [
    { tStartMs: 0, dDurationMs: 100 },
    { tStartMs: 1000, dDurationMs: 4000, segs: [{ utf8: 'hello' }, { utf8: ' there' }] },
    { tStartMs: 3000, dDurationMs: 10, segs: [{ utf8: '\n' }] },
    { tStartMs: 3000, dDurationMs: 2000, segs: [{ utf8: 'world' }] },
  ] });
  assert.deepEqual(parseJson3(json3).segments, [
    { text: 'hello there', start: 1, end: 3 },
    { text: 'world', start: 3, end: 5 },
  ]);
});

test('prefers uploader subtitles and never picks danmaku or live chat', () => {
  assert.deepEqual(chooseSubtitle({ subtitles: { danmaku: [], 'ai-zh': [] } }), { language: 'ai-zh', automatic: false });
  assert.equal(chooseSubtitle({ subtitles: { danmaku: [], live_chat: [] } }), undefined);
  assert.deepEqual(
    chooseSubtitle({ subtitles: { 'zh-Hans': [], en: [] }, automatic_captions: { en: [] } }, 'zh'),
    { language: 'zh-Hans', automatic: false },
  );
});

test('picks the untranslated automatic track and respects a requested language', () => {
  const info = { language: 'en', automatic_captions: { ab: [], 'en-orig': [], en: [], zh: [] } };
  assert.deepEqual(chooseSubtitle(info), { language: 'en-orig', automatic: true });
  assert.deepEqual(chooseSubtitle(info, 'zh'), { language: 'zh', automatic: true });
  assert.equal(chooseSubtitle(info, 'fr'), undefined);
  assert.deepEqual(chooseSubtitle({ subtitles: { en: [] }, automatic_captions: { fr: [] } }, 'fr'), { language: 'fr', automatic: true });
});
