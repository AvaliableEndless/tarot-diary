import { isDateKey } from './dates.js';

export const statusNames = {
  yes: '有过这样的时刻',
  tried: '试过，还没答案',
  none: '没有发生',
  noted: '留了一句话',
  pending: '等一句回声',
};

export const reviewOptions = [
  ['yes', '有这样的时刻'],
  ['tried', '试过，还没答案'],
  ['none', '没有发生'],
];

export function validateRecords(records) {
  if (!Array.isArray(records)) throw new TypeError('Diary must be an array');
  const dates = new Set();
  for (const record of records) {
    if (
      !record ||
      !isDateKey(record.date) ||
      typeof record.id !== 'string' ||
      typeof record.text !== 'string' ||
      !Object.hasOwn(statusNames, record.status)
    ) {
      throw new TypeError('Invalid diary record');
    }
    if (
      record.cardId !== null &&
      (!Number.isInteger(record.cardId) || record.cardId < 1 || record.cardId > 78)
    ) {
      throw new TypeError('Invalid card ID');
    }
    if (record.audioId != null && typeof record.audioId !== 'string')
      throw new TypeError('Invalid audio ID');
    if (dates.has(record.date)) throw new TypeError('Duplicate diary date');
    dates.add(record.date);
  }
  return records;
}

export function upsertRecord(records, date, patch, now = new Date().toISOString()) {
  if (!isDateKey(date)) throw new RangeError('Invalid diary date');
  const existing = records.find((record) => record.date === date);
  const base = existing || {
    id: date,
    cardId: null,
    text: '',
    status: 'pending',
    createdAt: now,
  };
  const next = {
    ...base,
    ...patch,
    id: existing?.id || date,
    date,
    // A recorded day keeps its original draw, even across another tab's update.
    cardId: existing?.cardId || patch.cardId || null,
    updatedAt: now,
  };
  const result = existing
    ? records.map((record) => (record.date === date ? next : record))
    : [...records, next];
  return validateRecords(result);
}

export function hasReflection(record) {
  return Boolean(record && (record.status !== 'pending' || record.text || record.audioId));
}

export function createReflectionPatch(
  { text = '', status = '', audioId = null },
  now = new Date().toISOString(),
) {
  if (!text.trim() && !status && !audioId)
    throw new TypeError('A reflection needs a result, text or audio');
  return { text: text.trim(), status: status || 'noted', audioId, updatedAt: now, demo: false };
}
