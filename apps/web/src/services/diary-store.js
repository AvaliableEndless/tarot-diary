import { validateRecords } from '../domain/diary.js';

export const STORAGE_KEY = 'shinian-tarot-v1';

export function createDiaryRepository(storage, key = STORAGE_KEY) {
  return {
    load() {
      const raw = storage.getItem(key);
      if (raw === null) return null;
      return validateRecords(JSON.parse(raw));
    },
    save(records) {
      validateRecords(records);
      storage.setItem(key, JSON.stringify(records));
    },
  };
}
