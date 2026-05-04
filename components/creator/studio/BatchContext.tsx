"use client";

/**
 * BatchContext
 *
 * 把 BatchWorkflowPanel 内部的 7 个 useState（mode / promptText / csvText /
 * sizeText / batch / error / loading）+ 轮询 useEffect + 提交 / 重试动作集中
 * 到 Provider 级，让 BatchWorkflowPanel 退化为纯 view。这样工作台的桌面
 * Inspector 和移动端底抽屉可以同时 mount 同一份 view，不会出现 state 分裂或
 * 双 polling timer。
 *
 * 关联文档：docs/superpowers/plans/2026-05-03-creatorworkspace-extraction-map.md
 *           CLAUDE.md「后续可选项」段：BatchWorkflowPanel state 上 Context
 *
 * 设计权衡：
 * - 单 Context（state + actions 合并）—— 当前消费方仅 BatchWorkflowPanel，
 *   不存在 selector 级别的 wasted render 风险，先合一。
 * - 在没有 Provider 时 useBatch() 抛错（与 useCreatorStudio 一致），避免
 *   silent undefined。
 * - 轮询 useEffect 跑在 Provider 内，确保不论 mount 几个 view 只有一个 timer。
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode
} from "react";

export type BatchMode = "prompts" | "csv";

export type BatchItem = {
  item_id: string;
  task_id: string;
  prompt: string;
  size: string;
  status: string;
  retry_count: number;
};

export type BatchData = {
  batch_id: string;
  status: string;
  items: BatchItem[];
};

type BatchResponse = {
  data?: BatchData;
  error?: { message: string };
};

export type BatchContextValue = {
  // state
  mode: BatchMode;
  promptText: string;
  csvText: string;
  sizeText: string;
  batch: BatchData | null;
  error: string;
  loading: boolean;
  // setters
  setMode: (mode: BatchMode) => void;
  setPromptText: (value: string) => void;
  setCsvText: (value: string) => void;
  setSizeText: (value: string) => void;
  // actions
  submitBatch: () => Promise<void>;
  retryItem: (itemId: string) => Promise<void>;
};

const BatchContext = createContext<BatchContextValue | null>(null);

function defaultParams() {
  return {
    model: "gpt-image-2",
    quality: "medium",
    output_format: "png",
    background: "auto",
    moderation: "auto"
  };
}

export function BatchProvider({
  defaultSize,
  children
}: {
  defaultSize: string;
  children: ReactNode;
}) {
  const [mode, setMode] = useState<BatchMode>("prompts");
  const [promptText, setPromptText] = useState("");
  const [csvText, setCsvText] = useState("");
  const [sizeText, setSizeText] = useState(defaultSize);
  const [batch, setBatch] = useState<BatchData | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // 轮询 batch 状态：仅在 queued / running 时拉。
  useEffect(() => {
    if (!batch || !["queued", "running"].includes(batch.status)) {
      return;
    }

    let active = true;
    const batchId = batch.batch_id;

    async function refreshBatch() {
      const response = await fetch(`/api/batches/${batchId}`);
      const responseBody = (await response.json().catch(() => ({}))) as BatchResponse;

      if (active && response.ok && responseBody.data) {
        setBatch(responseBody.data);
      }
    }

    const timer = window.setInterval(() => {
      void refreshBatch();
    }, 2000);
    void refreshBatch();

    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [batch]);

  const submitBatch = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const body =
        mode === "csv"
          ? {
              csv: csvText,
              params: defaultParams()
            }
          : {
              prompts: promptText
                .split(/\r?\n/)
                .map((prompt) => prompt.trim())
                .filter(Boolean),
              sizes: sizeText
                .split(",")
                .map((size) => size.trim())
                .filter(Boolean),
              params: defaultParams()
            };
      const response = await fetch("/api/batches", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body)
      });
      const responseBody = (await response.json()) as BatchResponse;

      if (!response.ok || !responseBody.data) {
        setError(responseBody.error?.message ?? "批量任务创建失败。");
        return;
      }

      setBatch(responseBody.data);
    } catch {
      setError("批量任务创建失败，请检查网络。");
    } finally {
      setLoading(false);
    }
  }, [csvText, mode, promptText, sizeText]);

  const retryItem = useCallback(
    async (itemId: string) => {
      if (!batch) {
        return;
      }

      const response = await fetch(`/api/batches/${batch.batch_id}/retry`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ item_ids: [itemId] })
      });
      const responseBody = (await response.json().catch(() => ({}))) as BatchResponse;

      if (response.ok && responseBody.data) {
        setBatch(responseBody.data);
      }
    },
    [batch]
  );

  const value = useMemo<BatchContextValue>(
    () => ({
      mode,
      promptText,
      csvText,
      sizeText,
      batch,
      error,
      loading,
      setMode,
      setPromptText,
      setCsvText,
      setSizeText,
      submitBatch,
      retryItem
    }),
    [batch, csvText, error, loading, mode, promptText, retryItem, sizeText, submitBatch]
  );

  return <BatchContext.Provider value={value}>{children}</BatchContext.Provider>;
}

export function useBatch(): BatchContextValue {
  const value = useContext(BatchContext);
  if (!value) {
    throw new Error("useBatch must be used within a <BatchProvider>");
  }
  return value;
}
