"use client";

import Link from "next/link";
import {
  Copy,
  Download,
  History,
  ImagePlus,
  PanelBottom,
  Play,
  RotateCcw,
  Settings,
  SlidersHorizontal,
  Sparkles
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  listLocalHistoryItems,
  saveLocalHistoryItem,
  type LocalHistoryItem
} from "@/lib/history/local-history";
import { commercialTemplates } from "@/lib/templates/commercial-templates";
import {
  GENERATION_SIZE_OPTIONS,
  imageGenerationDefaults,
  type ImageGenerationParams
} from "@/lib/validation/image-params";

const qualityOptions = [
  { label: "自动", value: "auto" },
  { label: "标准", value: "medium" },
  { label: "高质", value: "high" }
] as const;

type GenerationImage = {
  asset_id: string;
  url: string;
  format: string;
};

type GenerationResult = {
  task_id: string;
  images: GenerationImage[];
  usage: {
    input_tokens: number;
    output_tokens: number;
    total_tokens: number;
    estimated_cost: string;
  };
  duration_ms: number;
  request_id: string;
  upstream_request_id?: string;
};

type ApiGenerationResponse = {
  data?: Omit<GenerationResult, "request_id" | "upstream_request_id">;
  request_id?: string;
  upstream_request_id?: string;
  error?: {
    code: string;
    message: string;
    details?: { field?: string };
  };
};

export default function CreatorWorkspace() {
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState(
    "tpl_ecommerce_main"
  );
  const [prompt, setPrompt] = useState("");
  const [size, setSize] =
    useState<ImageGenerationParams["size"]>("1024x1024");
  const [quality, setQuality] =
    useState<ImageGenerationParams["quality"]>("medium");
  const [outputFormat, setOutputFormat] =
    useState<ImageGenerationParams["output_format"]>("png");
  const [n, setN] = useState(1);
  const [outputCompression, setOutputCompression] = useState("");
  const [moderation, setModeration] =
    useState<ImageGenerationParams["moderation"]>("auto");
  const [isGenerating, setIsGenerating] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [result, setResult] = useState<GenerationResult | null>(null);
  const [historyItems, setHistoryItems] = useState<LocalHistoryItem[]>([]);

  const mvpTemplates = useMemo(
    () => commercialTemplates.filter((template) => template.enabledForMvp),
    []
  );

  useEffect(() => {
    void listLocalHistoryItems()
      .then(setHistoryItems)
      .catch(() => setHistoryItems([]));
  }, []);

  async function submitGeneration() {
    if (!prompt.trim() || isGenerating) {
      setErrorMessage("Prompt 不能为空。");
      return;
    }

    setIsGenerating(true);
    setErrorMessage("");

    const requestParams = buildGenerationRequest();

    try {
      const response = await fetch("/api/images/generations", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(requestParams)
      });
      const body = (await response.json()) as ApiGenerationResponse;

      if (!response.ok || !body.data) {
        setErrorMessage(body.error?.message ?? "生成失败，请稍后重试。");
        return;
      }

      const nextResult: GenerationResult = {
        ...body.data,
        request_id: body.request_id ?? "",
        upstream_request_id: body.upstream_request_id
      };
      setResult(nextResult);

      const firstImage = nextResult.images[0];
      if (firstImage) {
        const historyItem: LocalHistoryItem = {
          taskId: nextResult.task_id,
          prompt: requestParams.prompt,
          params: {
            model: requestParams.model,
            size: requestParams.size,
            quality: requestParams.quality,
            n: requestParams.n,
            output_format: requestParams.output_format,
            output_compression: requestParams.output_compression,
            background: requestParams.background,
            moderation: requestParams.moderation
          },
          thumbnailUrl: firstImage.url,
          requestId: nextResult.request_id,
          durationMs: nextResult.duration_ms,
          totalTokens: nextResult.usage.total_tokens,
          createdAt: new Date().toISOString()
        };

        setHistoryItems((items) => [historyItem, ...items]);
        void saveLocalHistoryItem(historyItem).catch(() => undefined);
      }
    } catch {
      setErrorMessage("网络错误，请检查服务和 session。");
    } finally {
      setIsGenerating(false);
    }
  }

  function buildGenerationRequest(): ImageGenerationParams {
    return {
      ...imageGenerationDefaults,
      prompt,
      size,
      quality,
      n,
      output_format: outputFormat,
      output_compression:
        outputFormat === "png" || outputCompression.trim() === ""
          ? null
          : Number(outputCompression),
      moderation
    };
  }

  async function copyPrompt() {
    await navigator.clipboard?.writeText(prompt);
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand" aria-label="PsyPic">
          <div className="brand-mark">P</div>
          <div>
            <div className="brand-title">PsyPic</div>
            <div className="brand-subtitle">商业创作台</div>
          </div>
        </div>
        <div className="topbar-actions">
          <button className="icon-button" type="button" title="历史">
            <History size={17} aria-hidden="true" />
          </button>
          <Link className="icon-button" href="/settings" title="设置">
            <Settings size={17} aria-hidden="true" />
          </Link>
        </div>
      </header>

      <div className="creator-grid">
        <aside
          className="workspace-panel left-column"
          data-testid="left-parameter-panel"
        >
          <div className="panel-header">
            <div className="panel-title">
              <SlidersHorizontal size={16} aria-hidden="true" />
              参数
            </div>
          </div>
          <div className="panel-body field-stack">
            <div className="field">
              <div className="field-label">模式</div>
              <div className="segmented">
                <button className="segment active" type="button">
                  文生图
                </button>
                <button className="segment" type="button">
                  图生图
                </button>
              </div>
            </div>

            <div className="field">
              <label htmlFor="model">模型</label>
              <select className="select" id="model" defaultValue="gpt-image-2">
                <option value="gpt-image-2">gpt-image-2</option>
              </select>
            </div>

            <div className="field">
              <label htmlFor="size">尺寸</label>
              <select
                className="select"
                id="size"
                onChange={(event) =>
                  setSize(event.target.value as ImageGenerationParams["size"])
                }
                value={size}
              >
                {GENERATION_SIZE_OPTIONS.map((size) => (
                  <option key={size} value={size}>
                    {size === "auto" ? "自动" : size}
                  </option>
                ))}
              </select>
            </div>

            <div className="field">
              <div className="field-label">质量</div>
              <div className="segmented three">
                {qualityOptions.map((option) => (
                  <button
                    className={`segment ${option.value === quality ? "active" : ""}`}
                    key={option.value}
                    onClick={() => setQuality(option.value)}
                    type="button"
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="field">
              <label htmlFor="output-format">输出格式</label>
              <select
                className="select"
                id="output-format"
                onChange={(event) =>
                  setOutputFormat(
                    event.target.value as ImageGenerationParams["output_format"]
                  )
                }
                value={outputFormat}
              >
                <option value="png">PNG</option>
                <option value="jpeg">JPEG</option>
                <option value="webp">WebP</option>
              </select>
            </div>

            <div className="field">
              <label htmlFor="count">数量</label>
              <input
                className="input"
                id="count"
                min={1}
                max={4}
                onChange={(event) => setN(Number(event.target.value))}
                type="number"
                value={n}
              />
            </div>

            <button
              aria-expanded={advancedOpen}
              className="secondary-button"
              onClick={() => setAdvancedOpen((open) => !open)}
              type="button"
            >
              <SlidersHorizontal size={16} aria-hidden="true" />
              高级参数
            </button>

            {advancedOpen ? (
              <div className="field-stack">
                <div className="field">
                  <label htmlFor="compression">Output Compression</label>
                  <input
                    className="input"
                    id="compression"
                    max={100}
                    min={1}
                    onChange={(event) => setOutputCompression(event.target.value)}
                    type="number"
                    placeholder="仅 JPEG/WebP"
                    value={outputCompression}
                  />
                </div>
                <div className="field">
                  <label htmlFor="moderation">Moderation</label>
                  <select
                    className="select"
                    id="moderation"
                    onChange={(event) =>
                      setModeration(
                        event.target
                          .value as ImageGenerationParams["moderation"]
                      )
                    }
                    value={moderation}
                  >
                    <option value="auto">auto</option>
                    <option value="low">low</option>
                  </select>
                </div>
              </div>
            ) : null}
          </div>
        </aside>

        <section
          className="workspace-panel center-panel"
          data-testid="center-workspace"
        >
          <div className="panel-header">
            <div className="panel-title">
              <Sparkles size={16} aria-hidden="true" />
              创作
            </div>
            <button className="secondary-button" type="button">
              <ImagePlus size={16} aria-hidden="true" />
              上传参考图
            </button>
          </div>
          <div className="panel-body field-stack">
            <div className="field">
              <label htmlFor="prompt">Prompt</label>
              <textarea
                className="textarea"
                id="prompt"
                onChange={(event) => setPrompt(event.target.value)}
                placeholder="描述你要生成的商业图片"
                value={prompt}
              />
              <div className="prompt-actions">
                <span className="inline-hint">
                  默认不生成文字，不改变参考图主体。
                </span>
                <button
                  className="primary-button"
                  disabled={isGenerating}
                  onClick={submitGeneration}
                  type="button"
                >
                  <Play size={16} aria-hidden="true" />
                  {isGenerating ? "生成中" : "生成图片"}
                </button>
              </div>
              {errorMessage ? (
                <p className="error-message" role="alert">
                  {errorMessage}
                </p>
              ) : null}
            </div>

            <div className="field" data-testid="commercial-template-list">
              <div className="field-label">商业模板</div>
              <div className="template-list">
                {mvpTemplates.map((template) => (
                  <button
                    className="template-button"
                    key={template.id}
                    onClick={() => setSelectedTemplateId(template.id)}
                    type="button"
                  >
                    <span>
                      <strong>{template.name}</strong>
                      <span>{template.description}</span>
                    </span>
                    <span className="template-pill">
                      {template.requiresImage ? "需参考图" : "文生图"}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <div className="result-stage" aria-label="结果区">
              {result ? (
                <div className="result-grid">
                  {result.images.map((image) => (
                    <article className="result-card" key={image.asset_id}>
                      <img alt="生成结果" src={image.url} />
                      <div className="result-card-body">
                        <strong>{image.asset_id}</strong>
                        <p>{result.request_id}</p>
                        <p>{result.usage.total_tokens} tokens</p>
                        <div className="result-actions">
                          <a
                            className="secondary-button"
                            download
                            href={image.url}
                          >
                            <Download size={16} aria-hidden="true" />
                            下载
                          </a>
                          <button
                            className="secondary-button"
                            onClick={copyPrompt}
                            type="button"
                          >
                            <Copy size={16} aria-hidden="true" />
                            复制 Prompt
                          </button>
                          <button
                            className="secondary-button"
                            onClick={submitGeneration}
                            type="button"
                          >
                            <RotateCcw size={16} aria-hidden="true" />
                            重试
                          </button>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="empty-result">
                  <h2>选择模板或输入 Prompt 后生成</h2>
                  <p>
                    当前模板：
                    {commercialTemplates.find(
                      (template) => template.id === selectedTemplateId
                    )?.name ?? "未选择"}
                  </p>
                </div>
              )}
            </div>
          </div>
        </section>

        <aside
          className="workspace-panel right-column"
          data-testid="right-history-panel"
        >
          <div className="panel-header">
            <div className="panel-title">
              <History size={16} aria-hidden="true" />
              历史与详情
            </div>
          </div>
          <div className="panel-body history-list">
            {historyItems.length === 0 ? (
              <div className="history-item">
                <strong>尚未生成</strong>
                <p>生成后会显示 prompt、参数、request id、耗时和 usage。</p>
              </div>
            ) : (
              historyItems.map((item) => (
                <div className="history-item" key={item.taskId}>
                  <strong>{item.taskId}</strong>
                  <p>{item.prompt}</p>
                  <p>{item.requestId}</p>
                  <p>{item.totalTokens} tokens · {item.durationMs}ms</p>
                </div>
              ))
            )}
          </div>
        </aside>
      </div>

      <div className="mobile-bottom-bar">
        <button className="secondary-button" type="button">
          <PanelBottom size={16} aria-hidden="true" />
          打开参数面板
        </button>
        <button
          className="primary-button"
          disabled={isGenerating}
          onClick={submitGeneration}
          type="button"
        >
          <Play size={16} aria-hidden="true" />
          {isGenerating ? "生成中" : "生成"}
        </button>
      </div>
    </main>
  );
}
