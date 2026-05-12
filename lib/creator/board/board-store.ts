import type { BoardDocument, BoardExport } from "./types";

const DB_NAME = "psypic_board_store";
const DB_VERSION = 1;

export function canUseIndexedDB() {
  return typeof window !== "undefined" && typeof window.indexedDB !== "undefined";
}

function openDb() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains("board_documents")) {
        const store = db.createObjectStore("board_documents", { keyPath: "id" });
        store.createIndex("project_id", "projectId", { unique: false });
        store.createIndex("session_id", "sessionId", { unique: false });
      }
      if (!db.objectStoreNames.contains("board_exports")) {
        const store = db.createObjectStore("board_exports", { keyPath: "id" });
        store.createIndex("board_document_id", "boardDocumentId", { unique: false });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function requestToPromise<T>(request: IDBRequest<T>) {
  return new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// --- Board Documents ---

export async function listBoardDocuments(sessionId: string): Promise<BoardDocument[]> {
  if (!canUseIndexedDB()) return [];
  const db = await openDb();
  const tx = db.transaction("board_documents", "readonly");
  const index = tx.objectStore("board_documents").index("session_id");
  const items = await requestToPromise<BoardDocument[]>(index.getAll(sessionId));
  db.close();
  // Sort by updatedAt descending
  return items.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function getBoardDocument(id: string): Promise<BoardDocument | null> {
  if (!canUseIndexedDB()) return null;
  const db = await openDb();
  const tx = db.transaction("board_documents", "readonly");
  const item = await requestToPromise<BoardDocument | undefined>(
    tx.objectStore("board_documents").get(id)
  );
  db.close();
  return item ?? null;
}

export async function saveBoardDocument(document: BoardDocument): Promise<void> {
  if (!canUseIndexedDB()) return;
  const db = await openDb();
  await requestToPromise(
    db.transaction("board_documents", "readwrite").objectStore("board_documents").put(document)
  );
  db.close();
}

/**
 * Perform a soft delete by setting deletedAt.
 */
export async function softDeleteBoardDocument(id: string): Promise<void> {
  if (!canUseIndexedDB()) return;
  const db = await openDb();
  const tx = db.transaction("board_documents", "readwrite");
  const store = tx.objectStore("board_documents");
  
  const doc = await requestToPromise<BoardDocument | undefined>(store.get(id));
  if (doc) {
    doc.deletedAt = new Date().toISOString();
    doc.updatedAt = doc.deletedAt;
    await requestToPromise(store.put(doc));
  }
  
  db.close();
}

export async function hardDeleteBoardDocument(id: string): Promise<void> {
  if (!canUseIndexedDB()) return;
  const db = await openDb();
  await requestToPromise(
    db.transaction("board_documents", "readwrite").objectStore("board_documents").delete(id)
  );
  db.close();
}

// --- Board Exports ---

export async function listBoardExports(boardDocumentId: string): Promise<BoardExport[]> {
  if (!canUseIndexedDB()) return [];
  const db = await openDb();
  const tx = db.transaction("board_exports", "readonly");
  const index = tx.objectStore("board_exports").index("board_document_id");
  const items = await requestToPromise<BoardExport[]>(index.getAll(boardDocumentId));
  db.close();
  return items.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function saveBoardExport(boardExport: BoardExport): Promise<void> {
  if (!canUseIndexedDB()) return;
  const db = await openDb();
  await requestToPromise(
    db.transaction("board_exports", "readwrite").objectStore("board_exports").put(boardExport)
  );
  db.close();
}

export async function clearBoardStore(): Promise<void> {
  if (!canUseIndexedDB()) return;
  const db = await openDb();
  const tx = db.transaction(["board_documents", "board_exports"], "readwrite");
  await Promise.all([
    requestToPromise(tx.objectStore("board_documents").clear()),
    requestToPromise(tx.objectStore("board_exports").clear())
  ]);
  db.close();
}
