import type { ImageGenerationParams } from "@/lib/validation/image-params";

export type LocalHistoryImage = {
  asset_id: string;
  url: string;
  format: string;
};

export type LocalHistoryItem = {
  taskId: string;
  prompt: string;
  params: Omit<ImageGenerationParams, "prompt">;
  thumbnailUrl: string;
  images?: LocalHistoryImage[];
  parentTaskId?: string | null;
  branchId?: string;
  branchLabel?: string;
  versionNodeId?: string;
  requestId: string;
  durationMs: number;
  totalTokens: number;
  createdAt: string;
};

const DB_NAME = "psypic";
const DB_VERSION = 1;
const STORE_NAME = "local_tasks";

export async function saveLocalHistoryItem(item: LocalHistoryItem) {
  if (!canUseIndexedDB()) {
    return;
  }

  const db = await openHistoryDb();
  await requestToPromise(
    db
      .transaction(STORE_NAME, "readwrite")
      .objectStore(STORE_NAME)
      .put(item)
  );
  db.close();
}

export async function listLocalHistoryItems(): Promise<LocalHistoryItem[]> {
  if (!canUseIndexedDB()) {
    return [];
  }

  const db = await openHistoryDb();
  const items = await requestToPromise<LocalHistoryItem[]>(
    db.transaction(STORE_NAME, "readonly").objectStore(STORE_NAME).getAll()
  );
  db.close();

  return items.sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}

function canUseIndexedDB() {
  return typeof window !== "undefined" && typeof window.indexedDB !== "undefined";
}

function openHistoryDb() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;

      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "taskId" });
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
