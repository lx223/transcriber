import { test } from 'node:test';
import assert from 'node:assert/strict';
import { timestamp, toSrt } from '../src/core/export.ts';
import { MAX_FILE_BYTES, validateFile } from '../src/sources/file.ts';

test('rejects missing, empty and oversized inputs before decoding', () => {
  assert.throws(() => validateFile(undefined), /Choose/);
  assert.throws(() => validateFile({ size: 0 }), /empty/);
  assert.throws(() => validateFile({ size: MAX_FILE_BYTES + 1 }), /250 MB/);
  assert.doesNotThrow(() => validateFile({ size: MAX_FILE_BYTES }));
});

test('subtitle timestamps round across minute and hour boundaries', () => {
  assert.equal(timestamp(59.9996), '00:01:00,000');
  assert.equal(timestamp(3599.9996), '01:00:00,000');
  assert.equal(timestamp(-1), '00:00:00,000');
});

test('SRT fills missing ends from the next segment or media duration', () => {
  const transcript = { text: '你好 hello', segments: [
    { text: ' 你好 ', start: 0.5, end: null },
    { text: ' hello ', start: 2, end: null },
  ] };
  assert.equal(toSrt(transcript, 4), '1\n00:00:00,500 --> 00:00:02,000\n你好\n\n2\n00:00:02,000 --> 00:00:04,000\nhello\n');
});

test('SRT preserves explicit ends and handles empty recognition', () => {
  assert.equal(toSrt({ text: '', segments: [] }, 10), '');
  assert.equal(toSrt({ text: 'hello', segments: [{ text: 'hello', start: 1, end: 2 }] }, 10),
    '1\n00:00:01,000 --> 00:00:02,000\nhello\n');
});
