import type { WorkbenchSyncOperation } from "./workbench-types";
import { canUseIndexedDB } from "./workbench-cache-store";

const DB_NAME = "psypic_workbench_outbox";
const DB_VERSION = 1;

export type OutboxRecord = WorkbenchSyncOperation & {
  created_at: string;
};

function openDb() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains("operations")) {
        const store = db.createObjectStore("operations", { keyPath: "client_mutation_id" });
        store.createIndex("created_at", "created_at", { unique: false });
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

export async function listOutboxOperations(): Promise<OutboxRecord[]> {
  if (!canUseIndexedDB()) return [];
  const db = await openDb();
  const tx = db.transaction("operations", "readonly");
  const index = tx.objectStore("operations").index("created_at");
  const items = await requestToPromise<OutboxRecord[]>(index.getAll());
  db.close();
  return items.sort((a, b) => a.created_at.localeCompare(b.created_at));
}

export async function addOutboxOperation(operation: WorkbenchSyncOperation): Promise<void> {
  if (!canUseIndexedDB()) return;
  const db = await openDb();
  const record: OutboxRecord = {
    ...operation,
    created_at: new Date().toISOString()
  };
  await requestToPromise(
    db.transaction("operations", "readwrite").objectStore("operations").put(record)
  );
  db.close();
}

export async function removeOutboxOperations(clientMutationIds: string[]): Promise<void> {
  if (!canUseIndexedDB() || clientMutationIds.length === 0) return;
  const db = await openDb();
  const tx = db.transaction("operations", "readwrite");
  const store = tx.objectStore("operations");
  await Promise.all(clientMutationIds.map((id) => requestToPromise(store.delete(id))));
  db.close();
}

export async function clearOutbox(): Promise<void> {
  if (!canUseIndexedDB()) return;
  const db = await openDb();
  await requestToPromise(
    db.transaction("operations", "readwrite").objectStore("operations").clear()
  );
  db.close();
}
