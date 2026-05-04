/**
 * 项目数据层 —— 原生 IndexedDB CRUD（照搬 lib/prompts/prompt-favorites.ts 模式）。
 *
 * 与 lib/history/local-history.ts、lib/prompts/prompt-favorites.ts 并列，每个
 * 功能一个独立 DB，避免 schema 冲突。**不引入 dexie**（项目装了但目前
 * 0 引用，保持现状）。
 *
 * 兼容老用户：
 * - 4 个 hardcoded ID（commercial / social / campaign / same）作为
 *   default seed 写入。CreatorWorkspace 内的 nodeProjectIds map 老 entry
 *   使用这 4 个 literal，seed 后无缝匹配。
 * - seed 仅在 store 完全为空时跑一次；用户删掉 builtin project 后再次进入
 *   不会重新 seed（acceptable，符合"完整 CRUD"语义）。
 */

import type { CreatorProjectId } from "@/lib/creator/types";

export type StoredProject = {
  id: CreatorProjectId;
  title: string;
  description?: string;
  /** true = 4 个初始 hardcoded seed；用户新建为 false。仅控制 hover icon
   *  显示（builtin 不显示重命名按钮，但仍可删除——用户已选择"完整 CRUD"）。 */
  isBuiltin: boolean;
  createdAt: string;
  updatedAt: string;
  sortOrder: number;
};

export type DefaultProjectSeed = {
  id: CreatorProjectId;
  title: string;
  description: string;
};

const DB_NAME = "psypic_projects";
const DB_VERSION = 1;
const STORE_NAME = "creator_projects";

/** 用户新建项目的 ID 前缀，与 prompt-favorites.ts 风格一致。 */
const USER_PROJECT_ID_PREFIX = "proj_";

export function createUserProjectId(): `proj_${string}` {
  const randomPart =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID().replaceAll("-", "")
      : Math.random().toString(16).slice(2);
  return `${USER_PROJECT_ID_PREFIX}${randomPart.slice(0, 24)}`;
}

export async function listProjects(): Promise<StoredProject[]> {
  if (!canUseIndexedDB()) {
    return [];
  }

  const db = await openProjectsDb();
  const items = await requestToPromise<StoredProject[]>(
    db.transaction(STORE_NAME, "readonly").objectStore(STORE_NAME).getAll()
  );
  db.close();

  return items.sort((left, right) => left.sortOrder - right.sortOrder);
}

export async function saveProject(project: StoredProject): Promise<void> {
  if (!canUseIndexedDB()) {
    return;
  }

  const db = await openProjectsDb();
  await requestToPromise(
    db.transaction(STORE_NAME, "readwrite").objectStore(STORE_NAME).put(project)
  );
  db.close();
}

export async function renameProject(
  id: CreatorProjectId,
  title: string,
  description?: string
): Promise<StoredProject | null> {
  if (!canUseIndexedDB()) {
    return null;
  }

  const db = await openProjectsDb();
  const tx = db.transaction(STORE_NAME, "readwrite");
  const store = tx.objectStore(STORE_NAME);
  const existing = await requestToPromise<StoredProject | undefined>(
    store.get(id)
  );

  if (!existing) {
    db.close();
    return null;
  }

  const updated: StoredProject = {
    ...existing,
    title: title.trim() || existing.title,
    description: description?.trim() ?? existing.description,
    updatedAt: new Date().toISOString()
  };

  await requestToPromise(store.put(updated));
  db.close();
  return updated;
}

export async function deleteProject(id: CreatorProjectId): Promise<void> {
  if (!canUseIndexedDB()) {
    return;
  }

  const db = await openProjectsDb();
  await requestToPromise(
    db.transaction(STORE_NAME, "readwrite").objectStore(STORE_NAME).delete(id)
  );
  db.close();
}

export async function seedDefaultProjectsIfEmpty(
  seeds: DefaultProjectSeed[]
): Promise<StoredProject[]> {
  if (!canUseIndexedDB()) {
    return [];
  }

  const db = await openProjectsDb();
  const existing = await requestToPromise<StoredProject[]>(
    db.transaction(STORE_NAME, "readonly").objectStore(STORE_NAME).getAll()
  );

  if (existing.length > 0) {
    db.close();
    return existing.sort((left, right) => left.sortOrder - right.sortOrder);
  }

  const now = new Date().toISOString();
  const records: StoredProject[] = seeds.map((seed, index) => ({
    id: seed.id,
    title: seed.title,
    description: seed.description,
    isBuiltin: true,
    createdAt: now,
    updatedAt: now,
    sortOrder: index
  }));

  const tx = db.transaction(STORE_NAME, "readwrite");
  const store = tx.objectStore(STORE_NAME);
  for (const record of records) {
    await requestToPromise(store.put(record));
  }
  db.close();
  return records;
}

function canUseIndexedDB() {
  return (
    typeof window !== "undefined" && typeof window.indexedDB !== "undefined"
  );
}

function openProjectsDb() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;

      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id" });
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
