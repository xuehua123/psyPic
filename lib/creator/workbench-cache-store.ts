import type {
  WorkbenchProject,
  WorkbenchSession,
  WorkbenchVersionNode
} from "./workbench-types";

const DB_NAME = "psypic_workbench_cache";
const DB_VERSION = 1;

export function canUseIndexedDB() {
  return typeof window !== "undefined" && typeof window.indexedDB !== "undefined";
}

function openDb() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains("projects")) {
        db.createObjectStore("projects", { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains("sessions")) {
        const store = db.createObjectStore("sessions", { keyPath: "id" });
        store.createIndex("project_id", "project_id", { unique: false });
      }
      if (!db.objectStoreNames.contains("version_nodes")) {
        const store = db.createObjectStore("version_nodes", { keyPath: "id" });
        store.createIndex("session_id", "session_id", { unique: false });
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

// --- Projects ---

export async function listCachedProjects(): Promise<WorkbenchProject[]> {
  if (!canUseIndexedDB()) return [];
  const db = await openDb();
  const tx = db.transaction("projects", "readonly");
  const items = await requestToPromise<WorkbenchProject[]>(
    tx.objectStore("projects").getAll()
  );
  db.close();
  return items.sort((a, b) => {
    if (a.sort_order !== b.sort_order) return a.sort_order - b.sort_order;
    return b.updated_at.localeCompare(a.updated_at);
  });
}

export async function saveCachedProject(project: WorkbenchProject): Promise<void> {
  if (!canUseIndexedDB()) return;
  const db = await openDb();
  await requestToPromise(
    db.transaction("projects", "readwrite").objectStore("projects").put(project)
  );
  db.close();
}

export async function deleteCachedProject(id: string): Promise<void> {
  if (!canUseIndexedDB()) return;
  const db = await openDb();
  await requestToPromise(
    db.transaction("projects", "readwrite").objectStore("projects").delete(id)
  );
  db.close();
}

// --- Sessions ---

export async function listCachedSessions(projectId: string): Promise<WorkbenchSession[]> {
  if (!canUseIndexedDB()) return [];
  const db = await openDb();
  const tx = db.transaction("sessions", "readonly");
  const index = tx.objectStore("sessions").index("project_id");
  const items = await requestToPromise<WorkbenchSession[]>(index.getAll(projectId));
  db.close();
  return items.sort((a, b) => b.updated_at.localeCompare(a.updated_at));
}

export async function saveCachedSession(session: WorkbenchSession): Promise<void> {
  if (!canUseIndexedDB()) return;
  const db = await openDb();
  await requestToPromise(
    db.transaction("sessions", "readwrite").objectStore("sessions").put(session)
  );
  db.close();
}

export async function deleteCachedSession(id: string): Promise<void> {
  if (!canUseIndexedDB()) return;
  const db = await openDb();
  await requestToPromise(
    db.transaction("sessions", "readwrite").objectStore("sessions").delete(id)
  );
  db.close();
}

// --- Version Nodes ---

export async function listCachedVersionNodes(sessionId: string): Promise<WorkbenchVersionNode[]> {
  if (!canUseIndexedDB()) return [];
  const db = await openDb();
  const tx = db.transaction("version_nodes", "readonly");
  const index = tx.objectStore("version_nodes").index("session_id");
  const items = await requestToPromise<WorkbenchVersionNode[]>(index.getAll(sessionId));
  db.close();
  return items.sort((a, b) => a.updated_at.localeCompare(b.updated_at));
}

export async function saveCachedVersionNode(node: WorkbenchVersionNode): Promise<void> {
  if (!canUseIndexedDB()) return;
  const db = await openDb();
  await requestToPromise(
    db.transaction("version_nodes", "readwrite").objectStore("version_nodes").put(node)
  );
  db.close();
}

export async function deleteCachedVersionNode(id: string): Promise<void> {
  if (!canUseIndexedDB()) return;
  const db = await openDb();
  await requestToPromise(
    db.transaction("version_nodes", "readwrite").objectStore("version_nodes").delete(id)
  );
  db.close();
}

export async function clearWorkbenchCache(): Promise<void> {
  if (!canUseIndexedDB()) return;
  const db = await openDb();
  const tx = db.transaction(["projects", "sessions", "version_nodes"], "readwrite");
  await Promise.all([
    requestToPromise(tx.objectStore("projects").clear()),
    requestToPromise(tx.objectStore("sessions").clear()),
    requestToPromise(tx.objectStore("version_nodes").clear())
  ]);
  db.close();
}
