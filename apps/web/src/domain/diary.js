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

export function getAudioIds(record) {
  return record?.audioIds ?? (record?.audioId ? [record.audioId] : []);
}

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
    if (
      record.audioIds !== undefined &&
      (!Array.isArray(record.audioIds) ||
        record.audioIds.some((id) => typeof id !== 'string' || !id) ||
        new Set(record.audioIds).size !== record.audioIds.length ||
        (record.audioId != null && record.audioId !== record.audioIds[0]))
    )
      throw new TypeError('Invalid audio IDs');
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
  return Boolean(
    record && (record.status !== 'pending' || record.text || getAudioIds(record).length),
  );
}

export function createReflectionPatch(
  { text = '', status = '', audioId = null, audioIds = audioId ? [audioId] : [] },
  now = new Date().toISOString(),
) {
  if (!text.trim() && !status && !audioIds.length)
    throw new TypeError('A reflection needs a result, text or audio');
  return {
    text: text.trim(),
    status: status || 'noted',
    audioId: audioIds[0] || null,
    audioIds,
    updatedAt: now,
    demo: false,
  };
}
