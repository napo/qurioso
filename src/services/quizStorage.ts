import type { Quiz } from '../types/quiz';

function openLibrary(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('qurioso-library', 2);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains('library')) request.result.createObjectStore('library');
      if (!request.result.objectStoreNames.contains('videos')) request.result.createObjectStore('videos');
    };
    request.onerror = () => reject(new Error('Impossibile aprire l’archivio dei quiz.'));
    request.onsuccess = () => resolve(request.result);
  });
}

export async function loadQuizzes(): Promise<Quiz[] | null> {
  if (typeof indexedDB !== 'undefined') {
    const database = await openLibrary();
    const saved = await new Promise<Quiz[] | undefined>((resolve, reject) => {
      const transaction = database.transaction('library', 'readonly');
      const request = transaction.objectStore('library').get('quizzes');
      transaction.oncomplete = () => { database.close(); resolve(request.result); };
      transaction.onerror = () => { database.close(); reject(new Error('Impossibile leggere i quiz salvati.')); };
    });
    if (saved) return saved;
  }
  const legacy = localStorage.getItem('qurioso_quizzes');
  if (!legacy) return null;
  const quizzes = JSON.parse(legacy);
  if (!Array.isArray(quizzes)) throw new Error('L’archivio dei quiz non è leggibile.');
  // Keep the old copy as a migration backup.
  if (typeof indexedDB !== 'undefined') await storeQuizzes(quizzes);
  return quizzes;
}

export async function storeQuizzes(quizzes: Quiz[]): Promise<void> {
  if (typeof indexedDB === 'undefined') {
    try { localStorage.setItem('qurioso_quizzes', JSON.stringify(quizzes)); return; }
    catch { throw new Error('Spazio insufficiente per salvare il quiz. Esporta il JSON prima di uscire.'); }
  }
  const database = await openLibrary();
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction('library', 'readwrite');
    transaction.objectStore('library').put(quizzes, 'quizzes');
    transaction.oncomplete = () => { database.close(); resolve(); };
    transaction.onabort = () => { database.close(); reject(new Error('Salvataggio non riuscito: controlla lo spazio disponibile. Puoi esportare il quiz in JSON.')); };
    transaction.onerror = () => { /* onabort reports failed writes without discarding the draft. */ };
  });
}

/** Store the original video once, without base64 overhead in every quiz save. */
export async function storeVideo(file: Blob): Promise<string> {
  if (typeof indexedDB === 'undefined') throw new Error('L’archivio video non è disponibile in questo browser.');
  const id = crypto.randomUUID();
  const database = await openLibrary();
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction('videos', 'readwrite');
    transaction.objectStore('videos').put(file, id);
    transaction.oncomplete = () => { database.close(); resolve(); };
    transaction.onabort = () => { database.close(); reject(new Error('Video non salvato. Controlla lo spazio disponibile.')); };
  });
  return id;
}

export async function loadVideo(id: string): Promise<Blob> {
  if (typeof indexedDB === 'undefined') throw new Error('L’archivio video non è disponibile.');
  const database = await openLibrary();
  const file = await new Promise<Blob | undefined>((resolve, reject) => {
    const transaction = database.transaction('videos', 'readonly');
    const request = transaction.objectStore('videos').get(id);
    transaction.oncomplete = () => { database.close(); resolve(request.result); };
    transaction.onerror = () => { database.close(); reject(new Error('Impossibile leggere il video.')); };
  });
  if (!file) throw new Error('Video locale non trovato. Riapri l’editor e seleziona di nuovo il file.');
  return file;
}
