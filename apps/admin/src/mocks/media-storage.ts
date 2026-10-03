import { DataError } from '../data/data-error.js';

// Only finalized uploads are durable. Metadata remains in the versioned snapshot.
export type PrototypeMediaStorage = {
  get: (id: string) => Promise<Blob | undefined>;
  put: (id: string, blob: Blob) => Promise<void>;
  remove: (id: string) => Promise<void>;
  prune: (retained: string[]) => Promise<void>;
};
export const prototypeMediaDatabase = 'holita.prototype.media';
const error = () =>
  new DataError('Prototype images could not be saved or read. Check browser storage and retry.');

export function openPrototypeMediaStorage(): Promise<PrototypeMediaStorage> {
  return new Promise((resolve, reject) => {
    let request: IDBOpenDBRequest;
    try {
      request = indexedDB.open(prototypeMediaDatabase, 1);
    } catch {
      reject(error());
      return;
    }
    request.onupgradeneeded = () => {
      request.result.createObjectStore('images');
    };
    request.onerror = () => {
      reject(error());
    };
    request.onblocked = () => {
      reject(error());
    };
    request.onsuccess = () => {
      const database = request.result;
      database.onversionchange = () => {
        database.close();
      };
      function transaction<T>(
        mode: IDBTransactionMode,
        run: (store: IDBObjectStore, result: (value: T) => void) => void,
        initial: T,
      ): Promise<T> {
        return new Promise((done, fail) => {
          try {
            const tx = database.transaction('images', mode);
            let value = initial;
            tx.oncomplete = () => {
              done(value);
            };
            tx.onabort = () => {
              fail(error());
            };
            tx.onerror = () => {
              fail(error());
            };
            run(tx.objectStore('images'), (next) => {
              value = next;
            });
          } catch {
            fail(error());
          }
        });
      }
      resolve({
        get: (id) =>
          transaction<Blob | undefined>(
            'readonly',
            (store, result) => {
              const read = store.get(id);
              read.onsuccess = () => {
                const value: unknown = read.result;
                if (value instanceof Blob) result(value);
              };
            },
            undefined,
          ),
        put: (id, blob) =>
          transaction(
            'readwrite',
            (store) => {
              store.put(blob, id);
            },
            undefined,
          ),
        remove: (id) =>
          transaction(
            'readwrite',
            (store) => {
              store.delete(id);
            },
            undefined,
          ),
        prune: (retained) => {
          const kept = new Set(retained);
          return transaction(
            'readwrite',
            (store) => {
              const cursor = store.openKeyCursor();
              cursor.onsuccess = () => {
                const row = cursor.result;
                if (!row) return;
                if (typeof row.key !== 'string' || !kept.has(row.key)) store.delete(row.key);
                row.continue();
              };
            },
            undefined,
          );
        },
      });
    };
  });
}
