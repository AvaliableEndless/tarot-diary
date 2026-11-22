import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createReflectionPatch,
  getAudioIds,
  hasReflection,
  upsertRecord,
  validateRecords,
} from '../src/domain/diary.js';

const day = '2026-11-21';
const now = '2026-11-21T08:00:00Z';

test('an existing draw cannot be replaced by another draw', () => {
  const first = upsertRecord([], day, { cardId: 18 }, now);
  const second = upsertRecord(first, day, { cardId: 20 }, now);
  assert.equal(second.length, 1);
  assert.equal(second[0].cardId, 18);
});
test('drawing after a freeform note preserves its text and audio', () => {
  const original = upsertRecord(
    [],
    day,
    createReflectionPatch({ text: '先留一句', audioId: 'voice-1' }),
    now,
  );
  const next = upsertRecord(original, day, { cardId: 18 }, now);
  assert.equal(next[0].text, '先留一句');
  assert.equal(next[0].audioId, 'voice-1');
});
test('reflection-only selection supports a day when nothing matched', () => {
  const patch = createReflectionPatch({ status: 'none' });
  assert.equal(patch.status, 'none');
  assert.equal(hasReflection(patch), true);
});
test('writing without evaluating the card never claims a match', () => {
  const patch = createReflectionPatch({ text: '  平平常常的一天。  ' });
  assert.equal(patch.status, 'noted');
  assert.equal(patch.text, '平平常常的一天。');
});
test('empty reflection cannot be saved', () => {
  assert.throws(() => createReflectionPatch({ text: '  ' }), TypeError);
});
test('updating a fixture changes only that day into a user record', () => {
  const first = upsertRecord([], day, { demo: true, cardId: 18 }, now);
  const next = upsertRecord(first, day, createReflectionPatch({ text: '自己的记录' }), now);
  assert.equal(next[0].demo, false);
  assert.equal(first[0].demo, true);
});
test('a patch cannot change a record identity or date', () => {
  const first = upsertRecord([], day, { cardId: 18 }, now);
  const next = upsertRecord(first, day, { id: 'different', date: '2026-11-20', text: '修改' }, now);
  assert.equal(next[0].id, day);
  assert.equal(next[0].date, day);
});
test('invalid dates, statuses, duplicate days and card IDs are rejected', () => {
  const records = upsertRecord([], day, { cardId: 18 }, now);
  assert.throws(() => upsertRecord([], '2026-11-31', {}));
  assert.throws(() => upsertRecord([], day, { cardId: 79 }));
  assert.throws(() => upsertRecord([], day, { status: 'guaranteed' }));
  assert.throws(() => validateRecords([...records, ...records]));
});

test('multiple voice inputs stay on the same date and retain the original card', () => {
  const first = upsertRecord([], day, { cardId: 18, text: '原记录', status: 'noted' });
  const second = upsertRecord(
    first,
    day,
    createReflectionPatch({
      text: '人工修改后的原记录\n第一段口述\n第二段口述',
      audioIds: ['voice-1', 'voice-2'],
    }),
  );
  assert.equal(second.length, 1);
  assert.equal(second[0].cardId, 18);
  assert.equal(second[0].text, '人工修改后的原记录\n第一段口述\n第二段口述');
  assert.deepEqual(getAudioIds(second[0]), ['voice-1', 'voice-2']);
  assert.equal(second[0].audioId, 'voice-1');
});

test('legacy recordings remain readable and malformed clip collections are rejected', () => {
  assert.deepEqual(getAudioIds({ audioId: 'legacy' }), ['legacy']);
  assert.deepEqual(getAudioIds(null), []);
  for (const audioIds of [['a', 'a'], [''], [9], 'a']) {
    assert.throws(() => upsertRecord([], day, { audioIds }));
  }
  assert.throws(() => upsertRecord([], day, { audioId: 'old', audioIds: ['different'] }));
});
