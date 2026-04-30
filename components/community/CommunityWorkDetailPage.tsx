"use client";

import Link from "next/link";
import { useState } from "react";

export type CommunityWorkDetail = {
  work_id: string;
  title: string;
  scene: string | null;
  tags: string[];
  image_url: string;
  thumbnail_url: string;
  same_generation_available: boolean;
  prompt?: string;
  created_at: string;
};

type SameGenerationDraftResponse = {
  data?: {
    draft: {
      prompt: string;
      params?: Record<string, unknown>;
    };
  };
  error?: {
    message: string;
  };
};

export default function CommunityWorkDetailPage({
  work
}: {
  work: CommunityWorkDetail | null;
}) {
  const [samePrompt, setSamePrompt] = useState("");
  const [sameError, setSameError] = useState("");
  const [sameLoading, setSameLoading] = useState(false);

  if (!work) {
    return (
      <main className="community-shell">
        <section className="community-empty" role="alert">
          <h1>作品不存在</h1>
          <p>作品可能是私有、已下架，或链接不正确。</p>
          <Link className="secondary-button" href="/community">
            返回社区
          </Link>
        </section>
      </main>
    );
  }

  return (
    <main className="community-shell">
      <div className="community-detail-grid">
        <section className="community-detail-preview">
          <img alt={work.title} src={work.image_url} />
        </section>
        <aside className="workspace-panel community-detail-panel">
          <Link className="secondary-button" href="/community">
            返回社区
          </Link>
          <h1>{work.title}</h1>
          {work.scene ? <span className="template-pill">{work.scene}</span> : null}
          {work.tags.length > 0 ? (
            <div className="tag-list">
              {work.tags.map((tag) => (
                <span key={tag}>{tag}</span>
              ))}
            </div>
          ) : null}
          {work.prompt ? (
            <section className="community-disclosed-block">
              <div className="field-label">公开 Prompt</div>
              <p>{work.prompt}</p>
            </section>
          ) : null}
          {work.same_generation_available ? (
            <section className="community-disclosed-block">
              <div className="field-label">同款生成</div>
              <button
                className="primary-button"
                disabled={sameLoading}
                onClick={() => void loadSameGenerationDraft(work.work_id)}
                type="button"
              >
                {sameLoading ? "生成中" : "生成同款草稿"}
              </button>
              {samePrompt ? (
                <>
                  <p>{samePrompt}</p>
                  <Link
                    className="secondary-button"
                    href={`/?same_work=${work.work_id}`}
                  >
                    套用到创作台
                  </Link>
                </>
              ) : null}
              {sameError ? <p className="error-message">{sameError}</p> : null}
            </section>
          ) : null}
        </aside>
      </div>
    </main>
  );

  async function loadSameGenerationDraft(workId: string) {
    setSameLoading(true);
    setSameError("");

    try {
      const response = await fetch(`/api/community/works/${workId}/same`, {
        method: "POST"
      });
      const body = (await response.json()) as SameGenerationDraftResponse;

      if (!response.ok || !body.data) {
        setSameError(body.error?.message ?? "同款草稿生成失败。");
        return;
      }

      setSamePrompt(body.data.draft.prompt);
    } catch {
      setSameError("同款草稿生成失败，请检查网络。");
    } finally {
      setSameLoading(false);
    }
  }
}
