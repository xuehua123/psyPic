"use client";

import { ListPlus, RotateCcw, Table } from "lucide-react";
import { useState } from "react";

type BatchMode = "prompts" | "csv";

type BatchItem = {
  item_id: string;
  task_id: string;
  prompt: string;
  size: string;
  status: string;
  retry_count: number;
};

type BatchResponse = {
  data?: {
    batch_id: string;
    status: string;
    items: BatchItem[];
  };
  error?: {
    message: string;
  };
};

export default function BatchWorkflowPanel({
  defaultSize
}: {
  defaultSize: string;
}) {
  const [mode, setMode] = useState<BatchMode>("prompts");
  const [promptText, setPromptText] = useState("");
  const [csvText, setCsvText] = useState("");
  const [sizeText, setSizeText] = useState(defaultSize);
  const [batch, setBatch] = useState<BatchResponse["data"] | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  return (
    <section className="batch-panel">
      <div className="panel-header">
        <div className="panel-title">
          <ListPlus size={16} aria-hidden="true" />
          批量工作流
        </div>
      </div>
      <div className="panel-body field-stack">
        <div className="segmented" role="tablist" aria-label="批量模式">
          <button
            aria-selected={mode === "prompts"}
            className={`segment ${mode === "prompts" ? "active" : ""}`}
            onClick={() => setMode("prompts")}
            role="tab"
            type="button"
          >
            Prompt
          </button>
          <button
            aria-selected={mode === "csv"}
            className={`segment ${mode === "csv" ? "active" : ""}`}
            onClick={() => setMode("csv")}
            role="tab"
            type="button"
          >
            CSV
          </button>
        </div>

        {mode === "prompts" ? (
          <>
            <label className="field">
              <span>批量 Prompt</span>
              <textarea
                aria-label="批量 Prompt"
                className="textarea batch-textarea"
                onChange={(event) => setPromptText(event.currentTarget.value)}
                placeholder="每行一个 Prompt"
                value={promptText}
              />
            </label>
            <label className="field">
              <span>目标尺寸</span>
              <input
                aria-label="批量尺寸"
                className="input"
                onChange={(event) => setSizeText(event.currentTarget.value)}
                value={sizeText}
              />
            </label>
          </>
        ) : (
          <label className="field">
            <span>CSV 内容</span>
            <textarea
              aria-label="CSV 内容"
              className="textarea batch-textarea"
              onChange={(event) => setCsvText(event.currentTarget.value)}
              placeholder="prompt,size"
              value={csvText}
            />
          </label>
        )}

        <button
          className="primary-button"
          disabled={loading}
          onClick={() => void submitBatch()}
          type="button"
        >
          <Table size={16} aria-hidden="true" />
          创建批量任务
        </button>
        {error ? <p className="error-message">{error}</p> : null}
        {batch ? (
          <section className="batch-result">
            <div className="task-status-meta">
              <span>{batch.batch_id}</span>
              <span>批次 {batch.status}</span>
            </div>
            <div className="batch-item-list">
              {batch.items.map((item) => (
                <article className="batch-item" key={item.item_id}>
                  <div>
                    <strong>{item.prompt}</strong>
                    <span>{item.size}</span>
                  </div>
                  <span>{item.status}</span>
                  {item.status === "failed" ? (
                    <button
                      className="secondary-button"
                      onClick={() => void retryItem(item.item_id)}
                      type="button"
                    >
                      <RotateCcw size={15} aria-hidden="true" />
                      重试
                    </button>
                  ) : null}
                </article>
              ))}
            </div>
          </section>
        ) : null}
      </div>
    </section>
  );

  async function submitBatch() {
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
  }

  async function retryItem(itemId: string) {
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
  }

  function defaultParams() {
    return {
      model: "gpt-image-2",
      quality: "medium",
      output_format: "png",
      background: "auto",
      moderation: "auto"
    };
  }
}
