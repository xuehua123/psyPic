import Link from "next/link";
import { ArrowLeft, Download, ImagePlus, Star, Tags } from "lucide-react";
import type { ImageGenerationParams } from "@/lib/validation/image-params";

export type LibraryAssetDetailItem = {
  asset_id: string;
  task_id: string;
  type: "generation" | "edit";
  prompt: string;
  params: ImageGenerationParams;
  url: string;
  thumbnail_url: string;
  format: string;
  usage?: {
    input_tokens: number;
    output_tokens: number;
    total_tokens: number;
    estimated_cost?: string;
  };
  duration_ms?: number;
  created_at: string;
  favorite: boolean;
  tags: string[];
};

export default function LibraryAssetDetailPage({
  item,
  errorMessage
}: {
  item: LibraryAssetDetailItem | null;
  errorMessage?: string;
}) {
  return (
    <main className="library-detail-shell">
      <header className="topbar">
        <Link className="secondary-button" href="/">
          <ArrowLeft size={16} aria-hidden="true" />
          返回创作台
        </Link>
        <div className="brand" aria-label="PsyPic">
          <div className="brand-mark">P</div>
          <div>
            <div className="brand-title">PsyPic</div>
            <div className="brand-subtitle">素材详情</div>
          </div>
        </div>
      </header>

      <section className="library-detail-wrap">
        {!item ? (
          <div className="workspace-panel library-detail-panel" role="alert">
            <strong>无法打开素材</strong>
            <p>{errorMessage ?? "素材不存在或无权访问。"}</p>
          </div>
        ) : (
          <div className="library-detail-grid">
            <div className="workspace-panel library-preview-panel">
              <img alt={`素材 ${item.asset_id}`} src={item.thumbnail_url} />
            </div>

            <aside className="workspace-panel library-detail-panel">
              <div className="panel-header">
                <div className="panel-title">
                  <Tags size={16} aria-hidden="true" />
                  素材信息
                </div>
              </div>
              <div className="panel-body field-stack">
                <div>
                  <strong>{item.asset_id}</strong>
                  <p>{item.prompt}</p>
                </div>
                <div className="task-status-meta">
                  <span>{item.task_id}</span>
                  <span>{item.type === "edit" ? "图生图" : "文生图"}</span>
                  <span>{item.params.size}</span>
                  <span>{item.format.toUpperCase()}</span>
                  {item.usage ? <span>{item.usage.total_tokens} tokens</span> : null}
                  {item.duration_ms ? <span>{item.duration_ms}ms</span> : null}
                </div>
                {item.tags.length > 0 ? (
                  <div className="tag-list">
                    {item.tags.map((tag) => (
                      <span key={tag}>{tag}</span>
                    ))}
                  </div>
                ) : null}
                {item.favorite ? (
                  <div className="task-status-meta">
                    <Star fill="currentColor" size={15} aria-hidden="true" />
                    <span>已收藏</span>
                  </div>
                ) : null}
                <div className="result-actions">
                  <a className="secondary-button" download href={item.url}>
                    <Download size={16} aria-hidden="true" />
                    下载
                  </a>
                  <Link
                    className="primary-button"
                    href={`/?reference_asset=${encodeURIComponent(item.asset_id)}`}
                  >
                    <ImagePlus size={16} aria-hidden="true" />
                    继续编辑
                  </Link>
                </div>
              </div>
            </aside>
          </div>
        )}
      </section>
    </main>
  );
}
