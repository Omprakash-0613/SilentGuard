/**
 * offlineQueue.js
 * IndexedDB queue for offline crisis events.
 * Stores events locally when Firebase is unavailable,
 * syncs them when internet connection is restored.
 */

const DB_NAME = 'silentguard-offline';
const DB_VERSION = 1;
const STORE_NAME = 'pendingEvents';

// Open IndexedDB
const openDB = () => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, {
          keyPath: 'id',
          autoIncrement: true,
        });
      }
    };

    request.onsuccess = (e) => resolve(e.target.result);
    request.onerror = (e) => reject(e.target.error);
  });
};

// Save event locally when offline
export const saveEventLocally = async (event) => {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.add({ ...event, savedAt: Date.now() });
    console.log('[OfflineQueue] Event saved locally:', event);
  } catch (err) {
    console.error('[OfflineQueue] Failed to save locally:', err);
  }
};

// Get all pending events
export const getPendingEvents = async () => {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    return new Promise((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.error('[OfflineQueue] Failed to get pending events:', err);
    return [];
  }
};

// Delete event after successful sync
export const deleteEvent = async (id) => {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.delete(id);
  } catch (err) {
    console.error('[OfflineQueue] Failed to delete event:', err);
  }
};

// Sync all pending events to Firebase when back online
export const syncPendingEvents = async (writeToFirestore) => {
  const pending = await getPendingEvents();

  if (pending.length === 0) return;

  console.log(`[OfflineQueue] Syncing ${pending.length} pending events...`);

  for (const event of pending) {
    try {
      const { id, savedAt, ...eventData } = event;
      await writeToFirestore(eventData);
      await deleteEvent(id);
      console.log(`[OfflineQueue] Synced event ${id}`);
    } catch (err) {
      console.error(`[OfflineQueue] Failed to sync event ${id}:`, err);
    }
  }
};

// Listen for online/offline events
export const initOfflineSync = (writeToFirestore) => {
  window.addEventListener('online', () => {
    console.log('[OfflineQueue] Back online — syncing pending events...');
    syncPendingEvents(writeToFirestore);
  });

  window.addEventListener('offline', () => {
    console.log('[OfflineQueue] Gone offline — events will be queued locally.');
  });
};