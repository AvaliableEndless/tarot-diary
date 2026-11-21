import { getAudio } from './audio-store.js';
import { getCard } from '../domain/cards.js';

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

export async function createDiaryExport(
  records,
  { readAudio = getAudio, encodeAudio = blobToDataUrl, now = new Date().toISOString() } = {},
) {
  const items = await Promise.all(
    records.map(async (record) => {
      let audio = null;
      if (record.audioId) {
        const blob = await readAudio(record.audioId);
        if (!blob) throw new Error('An original recording is missing; export was not completed');
        audio = await encodeAudio(blob);
      }
      return { ...record, card: record.cardId ? getCard(record.cardId).name : null, audio };
    }),
  );
  return { product: '拾念', version: 1, exportedAt: now, records: items };
}

export function downloadDiary(data, date) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `拾念-${date}.json`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 3000);
}
