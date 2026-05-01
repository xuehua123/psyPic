"use client";

import Link from "next/link";
import { Bookmark, Flag, Heart, Star } from "lucide-react";
import { useState } from "react";

export type CommunityWorkDetail = {
  work_id: string;
  title: string;
  scene: string | null;
  tags: string[];
  image_url: string;
  thumbnail_url: string;
  same_generation_available: boolean;
  like_count: number;
  favorite_count: number;
  liked: boolean;
  favorited: boolean;
  featured: boolean;
  disclose_prompt: boolean;
  disclose_params: boolean;
  disclose_reference_images: boolean;
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
  const [interaction, setInteraction] = useState({
    like_count: work?.like_count ?? 0,
    favorite_count: work?.favorite_count ?? 0,
    liked: work?.liked ?? false,
    favorited: work?.favorited ?? false
  });
  const [reportState, setReportState] = useState<"idle" | "sending" | "sent" | "failed">(
    "idle"
  );

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
          {work.featured ? (
            <span className="template-pill">
              <Star size={12} aria-hidden="true" />
              精选
            </span>
          ) : null}
          {work.scene ? <span className="template-pill">{work.scene}</span> : null}
          {work.tags.length > 0 ? (
            <div className="tag-list">
              {work.tags.map((tag) => (
                <span key={tag}>{tag}</span>
              ))}
            </div>
          ) : null}
          <div className="history-actions">
            <button
              className="secondary-button"
              onClick={() => void toggleInteraction("like")}
              type="button"
            >
              <Heart size={15} aria-hidden="true" />
              {interaction.liked ? "已点赞" : "点赞"} {interaction.like_count}
            </button>
            <button
              className="secondary-button"
              onClick={() => void toggleInteraction("favorite")}
              type="button"
            >
              <Bookmark size={15} aria-hidden="true" />
              {interaction.favorited ? "已收藏" : "收藏"}{" "}
              {interaction.favorite_count}
            </button>
            <button
              className="secondary-button"
              disabled={reportState === "sending" || reportState === "sent"}
              onClick={() => void reportWork()}
              type="button"
            >
              <Flag size={15} aria-hidden="true" />
              举报作品
            </button>
          </div>
          {reportState === "sent" ? (
            <p className="settings-note">已提交举报</p>
          ) : null}
          {reportState === "failed" ? (
            <p className="error-message">举报提交失败，请稍后重试。</p>
          ) : null}
          {work.prompt ? (
            <section className="community-disclosed-block">
              <div className="field-label">公开 Prompt</div>
              <p>{work.prompt}</p>
            </section>
          ) : (
            <section className="community-disclosed-block">
              <div className="field-label">Prompt 未公开</div>
              <p>作者未公开原始 Prompt，同款生成只会使用公开场景、标签和安全约束。</p>
            </section>
          )}
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

  async function toggleInteraction(type: "like" | "favorite") {
    if (!work) {
      return;
    }

    const enabled = type === "like" ? interaction.liked : interaction.favorited;
    const response = await fetch(`/api/community/works/${work.work_id}/${type}`, {
      method: enabled ? "DELETE" : "POST"
    });
    const body = (await response.json().catch(() => ({}))) as {
      data?: Partial<CommunityWorkDetail>;
    };

    if (!response.ok || !body.data) {
      return;
    }

    setInteraction({
      like_count: body.data.like_count ?? interaction.like_count,
      favorite_count: body.data.favorite_count ?? interaction.favorite_count,
      liked: body.data.liked ?? interaction.liked,
      favorited: body.data.favorited ?? interaction.favorited
    });
  }

  async function reportWork() {
    if (!work) {
      return;
    }

    setReportState("sending");

    try {
      const response = await fetch("/api/community/reports", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          work_id: work.work_id,
          reason: "other",
          details: "用户从作品详情页提交举报。"
        })
      });

      setReportState(response.ok ? "sent" : "failed");
    } catch {
      setReportState("failed");
    }
  }
}
