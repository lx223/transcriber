import { test } from 'node:test';
import assert from 'node:assert/strict';
import { activeSegmentAt } from '../src/core/timeline.ts';

const segments = [
  { text: 'One', start: 1, end: 3 },
  { text: 'Two', start: 5, end: null },
  { text: 'Three', start: 8, end: null },
];

test('active passage follows seeking forwards and backwards, leaving gaps unselected', () => {
  assert.equal(activeSegmentAt(segments, 0, 10), -1);
  assert.equal(activeSegmentAt(segments, 1, 10), 0);
  assert.equal(activeSegmentAt(segments, 3, 10), -1);
  assert.equal(activeSegmentAt(segments, 7, 10), 1);
  assert.equal(activeSegmentAt(segments, 8, 10), 2);
  assert.equal(activeSegmentAt(segments, 2, 10), 0);
  assert.equal(activeSegmentAt(segments, 10, 10), -1);
});

test('overlapping timestamps prefer the later passage and invalid times select nothing', () => {
  const overlapping = [{ text: 'A', start: 0, end: 5 }, { text: 'B', start: 4, end: 7 }];
  assert.equal(activeSegmentAt(overlapping, 4.5), 1);
  assert.equal(activeSegmentAt([], 1), -1);
  assert.equal(activeSegmentAt(segments, NaN), -1);
  assert.equal(activeSegmentAt(segments, -1), -1);
});
