"use client";

import Link from "next/link";
import {
  Download,
  History,
  ImagePlus,
  PanelBottom,
  Play,
  Settings,
  SlidersHorizontal,
  Sparkles
} from "lucide-react";
import { useMemo, useState } from "react";
import { commercialTemplates } from "@/lib/templates/commercial-templates";
import { GENERATION_SIZE_OPTIONS } from "@/lib/validation/image-params";

const qualityOptions = [
  { label: "自动", value: "auto" },
  { label: "标准", value: "medium" },
  { label: "高质", value: "high" }
];

export default function CreatorWorkspace() {
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState(
    "tpl_ecommerce_main"
  );

  const mvpTemplates = useMemo(
    () => commercialTemplates.filter((template) => template.enabledForMvp),
    []
  );

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
              <select className="select" id="size" defaultValue="1024x1024">
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
                    className={`segment ${
                      option.value === "medium" ? "active" : ""
                    }`}
                    key={option.value}
                    type="button"
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="field">
              <label htmlFor="output-format">输出格式</label>
              <select className="select" id="output-format" defaultValue="png">
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
                type="number"
                defaultValue={1}
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
                    type="number"
                    placeholder="仅 JPEG/WebP"
                  />
                </div>
                <div className="field">
                  <label htmlFor="moderation">Moderation</label>
                  <select className="select" id="moderation" defaultValue="auto">
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
                placeholder="描述你要生成的商业图片"
              />
              <div className="prompt-actions">
                <span className="inline-hint">
                  默认不生成文字，不改变参考图主体。
                </span>
                <button className="primary-button" type="button">
                  <Play size={16} aria-hidden="true" />
                  生成图片
                </button>
              </div>
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
              <div className="empty-result">
                <h2>选择模板或输入 Prompt 后生成</h2>
                <p>
                  当前模板：
                  {commercialTemplates.find(
                    (template) => template.id === selectedTemplateId
                  )?.name ?? "未选择"}
                </p>
              </div>
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
            <div className="history-item">
              <strong>尚未生成</strong>
              <p>生成后会显示 prompt、参数、request id、耗时和 usage。</p>
            </div>
            <button className="secondary-button" type="button">
              <Download size={16} aria-hidden="true" />
              下载结果
            </button>
          </div>
        </aside>
      </div>

      <div className="mobile-bottom-bar">
        <button className="secondary-button" type="button">
          <PanelBottom size={16} aria-hidden="true" />
          打开参数面板
        </button>
        <button className="primary-button" type="button">
          <Play size={16} aria-hidden="true" />
          生成
        </button>
      </div>
    </main>
  );
}
