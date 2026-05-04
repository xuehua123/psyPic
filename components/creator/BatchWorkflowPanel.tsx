"use client";

/**
 * BatchWorkflowPanel
 *
 * 批量工作流的纯 view：mode 切换、prompt / csv 输入、提交、批次结果列表与
 * 失败项重试按钮。所有 state（含轮询）都集中在
 * `components/creator/studio/BatchContext.tsx` 的 BatchProvider 里，本组件
 * 仅消费 useBatch()。
 *
 * 这样工作台的桌面 Inspector 与移动端底抽屉可以**同时**挂载本 view 共享同
 * 一份 batch state，不会出现状态分裂或双 polling timer。
 *
 * 使用：包一个 <BatchProvider defaultSize={...}> 在外层，本组件不再接 props。
 */

import { ListPlus, RotateCcw, Table } from "lucide-react";

import { useBatch } from "@/components/creator/studio/BatchContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function BatchWorkflowPanel() {
  const {
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
  } = useBatch();

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
              <Input
                aria-label="批量尺寸"
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

        <Button
          disabled={loading}
          onClick={() => void submitBatch()}
          type="button"
        >
          <Table size={16} aria-hidden="true" />
          创建批量任务
        </Button>
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
                    <Button
                      variant="secondary"
                      onClick={() => void retryItem(item.item_id)}
                      type="button"
                    >
                      <RotateCcw size={15} aria-hidden="true" />
                      重试
                    </Button>
                  ) : null}
                </article>
              ))}
            </div>
          </section>
        ) : null}
      </div>
    </section>
  );
}
