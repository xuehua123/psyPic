import { canUseIndexedDB } from "../workbench-cache-store";
import type { BoardDocument } from "./types";

const DB_NAME = "psypic_workbench_board";
const DB_VERSION = 1;

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

export async function listBoardDocuments(sessionId: string): Promise<BoardDocument[]> {
  if (!canUseIndexedDB()) return [];
  const db = await openDb();
  const tx = db.transaction("board_documents", "readonly");
  const index = tx.objectStore("board_documents").index("session_id");
  const items = await requestToPromise<BoardDocument[]>(index.getAll(sessionId));
  db.close();
  return items.filter(item => !item.deletedAt).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function getBoardDocument(id: string): Promise<BoardDocument | null> {
  if (!canUseIndexedDB()) return null;
  const db = await openDb();
  const tx = db.transaction("board_documents", "readonly");
  const item = await requestToPromise<BoardDocument | undefined>(tx.objectStore("board_documents").get(id));
  db.close();
  if (item && !item.deletedAt) {
    return item;
  }
  return null;
}

export async function saveBoardDocument(doc: BoardDocument): Promise<void> {
  if (!canUseIndexedDB()) return;
  const db = await openDb();
  await requestToPromise(
    db.transaction("board_documents", "readwrite").objectStore("board_documents").put(doc)
  );
  db.close();
}

export async function deleteBoardDocument(id: string, soft: boolean = true): Promise<void> {
  if (!canUseIndexedDB()) return;
  const db = await openDb();
  if (soft) {
    const tx = db.transaction("board_documents", "readwrite");
    const store = tx.objectStore("board_documents");
    const item = await requestToPromise<BoardDocument | undefined>(store.get(id));
    if (item) {
      const deletedAt = new Date().toISOString();
      item.deletedAt = deletedAt;
      item.updatedAt = deletedAt;
      await requestToPromise(store.put(item));
    }
  } else {
    await requestToPromise(
      db.transaction("board_documents", "readwrite").objectStore("board_documents").delete(id)
    );
  }
  db.close();
}

export async function clearBoardStore(): Promise<void> {
  if (!canUseIndexedDB()) return;
  const db = await openDb();
  await requestToPromise(
    db.transaction("board_documents", "readwrite").objectStore("board_documents").clear()
  );
  db.close();
}
