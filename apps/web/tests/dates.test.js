import assert from 'node:assert/strict';
import test from 'node:test';
import { dateKey, dayAgo, isDateKey, parseDate } from '../src/domain/dates.js';

test('date keys use local calendar dates rather than UTC slicing', () => {
  assert.equal(dateKey(new Date(2026, 10, 21, 0, 5)), '2026-11-21');
});
test('yesterday crosses a year boundary', () => {
  assert.equal(dayAgo(1, new Date(2026, 0, 1, 12)), '2025-12-31');
});
test('yesterday respects leap years', () => {
  assert.equal(dayAgo(1, new Date(2024, 2, 1, 12)), '2024-02-29');
});
test('calendar validation rejects dates that Date silently rolls over', () => {
  for (const date of ['2026-02-29', '2026-11-31', '2026-13-01', '2026-1-1', '', null]) {
    assert.equal(isDateKey(date), false);
  }
  assert.equal(isDateKey('2024-02-29'), true);
});
test('invalid dates are rejected before persistence or formatting', () => {
  assert.throws(() => parseDate('2026-02-30'), RangeError);
  assert.throws(() => dateKey(new Date('invalid')), RangeError);
});
