/**
 * Branch 元数据存储 —— 原生 IndexedDB CRUD（照搬 lib/creator/projects-store.ts
 * 模式）。给 sidebar 上每条 branch session 挂上「自定义标题 / 置顶 /
 * 归档 / 已读时间」这几个跨刷新持久化的状态。
 *
 * branchId 是全局唯一（version-graph startsBranch 时用 node id 派生），
 * 所以 store 不需要 projectId scope —— 直接 keyPath: branchId 即可。
 *
 * 不引 dexie；与 prompt-favorites / projects-store / local-history 并列
 * 独立 DB。
 */

export type StoredBranchMeta = {
  /** branchId（IndexedDB keyPath）。 */
  branchId: string;
  /** 用户重命名后的 session 标题；undefined 时 sidebar fallback 到
   *  latestNode.prompt 或 branch.label。 */
  customLabel?: string;
  /** 置顶：sidebar 渲染时排到所有时间桶之前的「置顶」桶。 */
  isPinned?: boolean;
  /** 归档：sidebar 默认隐藏，「显示归档」toggle 后可见。 */
  isArchived?: boolean;
  /** 上次已读时间（ISO）；< latestNode.createdAt 即未读。 */
  lastReadAt?: string;
  /** 任意字段变化的时间戳，仅作 audit 用，不参与排序。 */
  updatedAt: string;
};

const DB_NAME = "psypic_branch_meta";
const DB_VERSION = 1;
const STORE_NAME = "branch_meta";

export async function listBranchMeta(): Promise<StoredBranchMeta[]> {
  if (!canUseIndexedDB()) {
    return [];
  }

  const db = await openDb();
  const items = await requestToPromise<StoredBranchMeta[]>(
    db.transaction(STORE_NAME, "readonly").objectStore(STORE_NAME).getAll()
  );
  db.close();
  return items;
}

export async function getBranchMeta(
  branchId: string
): Promise<StoredBranchMeta | null> {
  if (!canUseIndexedDB()) {
    return null;
  }

  const db = await openDb();
  const item = await requestToPromise<StoredBranchMeta | undefined>(
    db.transaction(STORE_NAME, "readonly").objectStore(STORE_NAME).get(branchId)
  );
  db.close();
  return item ?? null;
}

/**
 * Patch 单个 branch meta（merge 进现有 row；row 不存在时新建）。返回写入后的
 * 完整 row 供 hook 同步内存状态。
 */
export async function patchBranchMeta(
  branchId: string,
  patch: Partial<Omit<StoredBranchMeta, "branchId" | "updatedAt">>
): Promise<StoredBranchMeta | null> {
  if (!canUseIndexedDB()) {
    return null;
  }

  const db = await openDb();
  const tx = db.transaction(STORE_NAME, "readwrite");
  const store = tx.objectStore(STORE_NAME);
  const existing = await requestToPromise<StoredBranchMeta | undefined>(
    store.get(branchId)
  );

  const next: StoredBranchMeta = {
    ...(existing ?? { branchId, updatedAt: "" }),
    ...patch,
    branchId,
    updatedAt: new Date().toISOString()
  };

  await requestToPromise(store.put(next));
  db.close();
  return next;
}

export async function deleteBranchMeta(branchId: string): Promise<void> {
  if (!canUseIndexedDB()) {
    return;
  }

  const db = await openDb();
  await requestToPromise(
    db.transaction(STORE_NAME, "readwrite").objectStore(STORE_NAME).delete(branchId)
  );
  db.close();
}

function canUseIndexedDB() {
  return typeof window !== "undefined" && typeof window.indexedDB !== "undefined";
}

function openDb() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "branchId" });
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
