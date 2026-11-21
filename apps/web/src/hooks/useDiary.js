import { useEffect, useRef, useState } from 'react';
import { dateKey } from '../domain/dates.js';
import { upsertRecord } from '../domain/diary.js';
import { createDemoRecords } from '../fixtures/demo-records.js';
import { createDiaryRepository, STORAGE_KEY } from '../services/diary-store.js';

function previewRecords(preview) {
  const records = createDemoRecords();
  if (['drawn', 'record', 'history'].includes(preview)) {
    records.push({
      id: dateKey(),
      date: dateKey(),
      cardId: 18,
      status: 'pending',
      text: '',
      demo: true,
    });
  }
  return records;
}

export function useDiary(preview) {
  const [initial] = useState(() => {
    if (preview) return { records: previewRecords(preview), error: null };
    try {
      return {
        records: createDiaryRepository(localStorage).load() ?? createDemoRecords(),
        error: null,
      };
    } catch (error) {
      return { records: [], error };
    }
  });
  const [records, setRecords] = useState(initial.records);
  const [storageError, setStorageError] = useState(initial.error);
  const current = useRef(initial.records);

  useEffect(() => {
    if (preview) return;
    const synchronize = (event) => {
      if (event.key !== STORAGE_KEY && event.key !== null) return;
      try {
        const next = createDiaryRepository(localStorage).load() ?? [];
        current.current = next;
        setRecords(next);
        setStorageError(null);
      } catch (error) {
        setStorageError(error);
      }
    };
    window.addEventListener('storage', synchronize);
    return () => window.removeEventListener('storage', synchronize);
  }, [preview]);

  function change(transform) {
    try {
      const latest = preview
        ? current.current
        : (createDiaryRepository(localStorage).load() ?? current.current);
      const next = transform(latest);
      if (!preview) createDiaryRepository(localStorage).save(next);
      current.current = next;
      setRecords(next);
      setStorageError(null);
      return next;
    } catch (error) {
      setStorageError(error);
      throw error;
    }
  }

  return {
    records,
    storageError,
    updateRecord: (date, patch) => change((previous) => upsertRecord(previous, date, patch)),
    removeRecord: (id) => change((previous) => previous.filter((record) => record.id !== id)),
    clearDemo: () => change((previous) => previous.filter((record) => !record.demo)),
  };
}
