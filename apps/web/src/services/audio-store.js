export function createAudioStore({
  indexedDB = globalThis.indexedDB,
  databaseName = 'shinian-audio-v1',
} = {}) {
  function openDatabase() {
    return new Promise((resolve, reject) => {
      if (!indexedDB) {
        reject(new Error('Audio storage is unavailable'));
        return;
      }
      const request = indexedDB.open(databaseName, 1);
      request.onupgradeneeded = () => request.result.createObjectStore('audio');
      request.onsuccess = () => {
        request.result.onversionchange = () => request.result.close();
        resolve(request.result);
      };
      request.onerror = () => reject(request.error);
      request.onblocked = () => reject(new Error('Audio storage is blocked by another tab'));
    });
  }

  async function transaction(mode, action) {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('audio', mode);
      let result;
      tx.oncomplete = () => {
        db.close();
        resolve(result);
      };
      tx.onerror = () => {
        db.close();
        reject(tx.error || new Error('Audio transaction failed'));
      };
      tx.onabort = () => {
        db.close();
        reject(tx.error || new Error('Audio transaction aborted'));
      };
      try {
        const request = action(tx.objectStore('audio'));
        request.onsuccess = () => {
          result = request.result;
        };
      } catch (error) {
        db.close();
        reject(error);
      }
    });
  }

  return {
    get: (id) => transaction('readonly', (store) => store.get(id)),
    put: (id, blob) => transaction('readwrite', (store) => store.put(blob, id)),
    remove: (id) => transaction('readwrite', (store) => store.delete(id)),
  };
}

const audioStore = createAudioStore();
export const getAudio = (id) => audioStore.get(id);
export const putAudio = (id, blob) => audioStore.put(id, blob);
export const deleteAudio = (id) => audioStore.remove(id);
