/**
 * Browser Local Database Storage for Developer Notes
 *
 * Uses IndexedDB ('electropi_browser_db' / 'dev_local_notes') as primary persistent
 * client-side storage, with transparent fallback and synchronization with LocalStorage
 * for maximum resilience across all browser configurations and private modes.
 */

export type DevLocalNoteCategory =
  | "investigation"
  | "solution"
  | "workaround"
  | "code"
  | "reminder"
  | "general";

export interface DevLocalNote {
  id: string;
  bugId: number;
  title?: string | undefined;
  content: string;
  category: DevLocalNoteCategory;
  createdAt: string;
  updatedAt: string;
}

const DB_NAME = "electropi_browser_db";
const STORE_NAME = "dev_local_notes";
const DB_VERSION = 1;
const LOCAL_STORAGE_KEY = "electropi.browser.dev_local_notes";

function generateId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `note_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/** Reads all notes from localStorage as backup / mirror */
function readLocalStorageNotes(): DevLocalNote[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(LOCAL_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as DevLocalNote[]) : [];
  } catch {
    return [];
  }
}

/** Writes all notes to localStorage as backup / mirror */
function writeLocalStorageNotes(notes: DevLocalNote[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(notes));
  } catch (err) {
    console.warn("Failed to write developer notes to localStorage mirror:", err);
  }
}

function hasIndexedDb(): boolean {
  return typeof window !== "undefined" && typeof window.indexedDB !== "undefined" && window.indexedDB !== null;
}

/** Opens or upgrades the IndexedDB database */
function openIndexedDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!hasIndexedDb()) {
      reject(new Error("IndexedDB is not supported in this environment."));
      return;
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: "id" });
        store.createIndex("bugId", "bugId", { unique: false });
        store.createIndex("createdAt", "createdAt", { unique: false });
      }
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onerror = () => {
      reject(request.error || new Error("Failed to open IndexedDB"));
    };
  });
}

/**
 * Fetch all local developer notes for a specific bug
 */
export async function getDevLocalNotes(bugId: number): Promise<DevLocalNote[]> {
  try {
    const db = await openIndexedDb();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      const index = store.index("bugId");
      const request = index.getAll(IDBKeyRange.only(bugId));

      request.onsuccess = () => {
        const results = (request.result as DevLocalNote[]) || [];
        results.sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
        resolve(results);
      };

      request.onerror = () => {
        // Fallback to localStorage
        const all = readLocalStorageNotes();
        const filtered = all
          .filter((n) => n.bugId === bugId)
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        resolve(filtered);
      };
    });
  } catch {
    // If IndexedDB unavailable, return from localStorage
    const all = readLocalStorageNotes();
    return all
      .filter((n) => n.bugId === bugId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }
}

/**
 * Add a new local developer note for a bug
 */
export async function addDevLocalNote(payload: {
  bugId: number;
  title?: string;
  content: string;
  category?: DevLocalNoteCategory;
}): Promise<DevLocalNote> {
  const now = new Date().toISOString();
  const note: DevLocalNote = {
    id: generateId(),
    bugId: payload.bugId,
    title: payload.title?.trim() || undefined,
    content: payload.content.trim(),
    category: payload.category || "general",
    createdAt: now,
    updatedAt: now,
  };

  // Sync to localStorage
  const currentLocalStorage = readLocalStorageNotes();
  writeLocalStorageNotes([note, ...currentLocalStorage]);

  // Sync to IndexedDB if available
  if (hasIndexedDb()) {
    try {
      const db = await openIndexedDb();
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, "readwrite");
        const store = tx.objectStore(STORE_NAME);
        const request = store.add(note);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    } catch (err) {
      console.warn("IndexedDB insert failed, stored in localStorage:", err);
    }
  }

  return note;
}

/**
 * Update an existing local developer note
 */
export async function updateDevLocalNote(
  id: string,
  updates: Partial<{ title: string; content: string; category: DevLocalNoteCategory }>
): Promise<DevLocalNote> {
  const now = new Date().toISOString();

  // Update in localStorage
  const all = readLocalStorageNotes();
  const index = all.findIndex((n) => n.id === id);
  let updatedNote: DevLocalNote;

  if (index !== -1 && all[index]) {
    const prev = all[index];
    const nextTitle =
      updates.title !== undefined ? (updates.title.trim() || undefined) : prev.title;
    const nextContent =
      updates.content !== undefined ? updates.content.trim() : prev.content;
    const nextCategory =
      updates.category !== undefined ? updates.category : prev.category;

    updatedNote = {
      id: prev.id,
      bugId: prev.bugId,
      title: nextTitle,
      content: nextContent,
      category: nextCategory,
      createdAt: prev.createdAt,
      updatedAt: now,
    };
    all[index] = updatedNote;
    writeLocalStorageNotes(all);
  } else {
    throw new Error("Note not found in local storage");
  }

  // Update in IndexedDB if available
  if (hasIndexedDb()) {
    try {
      const db = await openIndexedDb();
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, "readwrite");
        const store = tx.objectStore(STORE_NAME);
        const getReq = store.get(id);

        getReq.onsuccess = () => {
          const existing = getReq.result as DevLocalNote | undefined;
          if (existing) {
            const mergedTitle =
              updates.title !== undefined ? (updates.title.trim() || undefined) : existing.title;
            const mergedContent =
              updates.content !== undefined ? updates.content.trim() : existing.content;
            const mergedCategory =
              updates.category !== undefined ? updates.category : existing.category;

            const merged: DevLocalNote = {
              id: existing.id,
              bugId: existing.bugId,
              title: mergedTitle,
              content: mergedContent,
              category: mergedCategory,
              createdAt: existing.createdAt,
              updatedAt: now,
            };
            const putReq = store.put(merged);
            putReq.onsuccess = () => resolve();
            putReq.onerror = () => reject(putReq.error);
          } else {
            // If not in IndexedDB yet, put the one from localStorage
            const putReq = store.put(updatedNote);
            putReq.onsuccess = () => resolve();
            putReq.onerror = () => reject(putReq.error);
          }
        };

        getReq.onerror = () => reject(getReq.error);
      });
    } catch (err) {
      console.warn("IndexedDB update failed, updated in localStorage:", err);
    }
  }

  return updatedNote;
}

/**
 * Delete a local developer note by id
 */
export async function deleteDevLocalNote(id: string): Promise<void> {
  // Delete from localStorage
  const all = readLocalStorageNotes();
  writeLocalStorageNotes(all.filter((n) => n.id !== id));

  // Delete from IndexedDB if available
  if (hasIndexedDb()) {
    try {
      const db = await openIndexedDb();
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, "readwrite");
        const store = tx.objectStore(STORE_NAME);
        const request = store.delete(id);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    } catch (err) {
      console.warn("IndexedDB delete failed, deleted from localStorage:", err);
    }
  }
}

/**
 * Clear all local developer notes (or for a specific bug)
 */
export async function clearDevLocalNotes(bugId?: number): Promise<void> {
  if (bugId !== undefined) {
    const all = readLocalStorageNotes();
    writeLocalStorageNotes(all.filter((n) => n.bugId !== bugId));

    if (hasIndexedDb()) {
      try {
        const db = await openIndexedDb();
        const existing = await getDevLocalNotes(bugId);
        const tx = db.transaction(STORE_NAME, "readwrite");
        const store = tx.objectStore(STORE_NAME);
        for (const note of existing) {
          store.delete(note.id);
        }
      } catch (err) {
        console.warn("IndexedDB clear notes for bug failed:", err);
      }
    }
  } else {
    writeLocalStorageNotes([]);
    if (hasIndexedDb()) {
      try {
        const db = await openIndexedDb();
        const tx = db.transaction(STORE_NAME, "readwrite");
        const store = tx.objectStore(STORE_NAME);
        store.clear();
      } catch (err) {
        console.warn("IndexedDB clear failed:", err);
      }
    }
  }
}
