import type { PromptAssistMode } from "@/lib/prompts/prompt-assistant";

export type PromptFavoriteItem = {
  id: string;
  title: string;
  prompt: string;
  templateId?: string;
  mode: PromptAssistMode;
  createdAt: string;
};

export type SavePromptFavoriteInput = {
  prompt: string;
  templateId?: string;
  mode: PromptAssistMode;
};

const DB_NAME = "psypic_prompt_favorites";
const DB_VERSION = 1;
const STORE_NAME = "prompt_favorites";

export async function savePromptFavorite(
  input: SavePromptFavoriteInput
): Promise<PromptFavoriteItem> {
  const prompt = input.prompt.trim();
  const item: PromptFavoriteItem = {
    id: createPromptFavoriteId(),
    title: createPromptTitle(prompt),
    prompt,
    templateId: input.templateId,
    mode: input.mode,
    createdAt: new Date().toISOString()
  };

  if (!canUseIndexedDB()) {
    return item;
  }

  const db = await openPromptFavoritesDb();
  await requestToPromise(
    db
      .transaction(STORE_NAME, "readwrite")
      .objectStore(STORE_NAME)
      .put(item)
  );
  db.close();

  return item;
}

export async function listPromptFavorites(): Promise<PromptFavoriteItem[]> {
  if (!canUseIndexedDB()) {
    return [];
  }

  const db = await openPromptFavoritesDb();
  const items = await requestToPromise<PromptFavoriteItem[]>(
    db.transaction(STORE_NAME, "readonly").objectStore(STORE_NAME).getAll()
  );
  db.close();

  return items.sort((left, right) =>
    right.createdAt.localeCompare(left.createdAt)
  );
}

function createPromptFavoriteId() {
  const randomPart =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID().replaceAll("-", "")
      : Math.random().toString(16).slice(2);

  return `pf_${randomPart.slice(0, 24)}`;
}

function createPromptTitle(prompt: string) {
  const firstLine = prompt.split(/\r?\n/).find(Boolean) ?? prompt;
  return firstLine.length > 64 ? `${firstLine.slice(0, 64)}...` : firstLine;
}

function canUseIndexedDB() {
  return typeof window !== "undefined" && typeof window.indexedDB !== "undefined";
}

function openPromptFavoritesDb() {
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
