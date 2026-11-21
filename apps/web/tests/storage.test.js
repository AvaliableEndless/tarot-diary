import assert from 'node:assert/strict';
import test from 'node:test';
import { createDiaryRepository, STORAGE_KEY } from '../src/services/diary-store.js';
import { upsertRecord } from '../src/domain/diary.js';
import { createAudioStore } from '../src/services/audio-store.js';
import { IDBFactory } from 'fake-indexeddb';

function memoryStorage() {
  const entries = new Map();
  return {
    getItem: (key) => entries.get(key) ?? null,
    setItem: (key, value) => entries.set(key, value),
  };
}

test('empty storage and intentional empty records are different', () => {
  const repository = createDiaryRepository(memoryStorage());
  assert.equal(repository.load(), null);
  repository.save([]);
  assert.deepEqual(repository.load(), []);
});
test('repository round-trips the original day and text', () => {
  const repository = createDiaryRepository(memoryStorage());
  const records = upsertRecord([], '2026-11-21', { text: '我自己的记录', status: 'noted' });
  repository.save(records);
  assert.deepEqual(repository.load(), records);
});
test('malformed existing data is reported and never overwritten on read', () => {
  const storage = memoryStorage();
  storage.setItem(STORAGE_KEY, '{broken');
  assert.throws(() => createDiaryRepository(storage).load());
  assert.equal(storage.getItem(STORAGE_KEY), '{broken');
});
test('storage quota errors propagate to the caller', () => {
  const repository = createDiaryRepository({
    getItem: () => null,
    setItem: () => {
      throw new Error('quota exceeded');
    },
  });
  assert.throws(() => repository.save([]), /quota exceeded/);
});
test('audio waits for commit, persists across store instances, and deletes', async () => {
  const indexedDB = new IDBFactory();
  const options = { indexedDB, databaseName: 'test-audio' };
  const first = createAudioStore(options);
  await first.put('voice-1', new Blob(['original voice'], { type: 'audio/webm' }));
  const second = createAudioStore(options);
  const blob = await second.get('voice-1');
  assert.equal(await blob.text(), 'original voice');
  assert.equal(blob.type, 'audio/webm');
  await second.remove('voice-1');
  assert.equal(await first.get('voice-1'), undefined);
});
test('audio storage absence is an actionable error', async () => {
  await assert.rejects(createAudioStore({ indexedDB: null }).get('missing'), /unavailable/);
});
