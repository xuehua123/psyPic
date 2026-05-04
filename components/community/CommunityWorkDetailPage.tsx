"use client";

import Link from "next/link";
import { Bookmark, Flag, Heart, ImagePlus, Sparkles, Star } from "lucide-react";
import { useState } from "react";

import AppPageHeader from "@/components/layout/AppPageHeader";
import AppShell from "@/components/layout/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

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
  work,
  showAdminLink = false
}: {
  work: CommunityWorkDetail | null;
  showAdminLink?: boolean;
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
  const [reportState, setReportState] = useState<
    "idle" | "sending" | "sent" | "failed"
  >("idle");

  if (!work) {
    return (
      <AppShell currentPath="/community" showAdminLink={showAdminLink}>
        <main className="mx-auto flex w-full max-w-[800px] px-5 py-10">
          <Card className="w-full p-7" role="alert">
            <h1 className="mb-1.5 text-base font-semibold">作品不存在</h1>
            <p className="text-[13px] text-muted-foreground">
              作品可能是私有、已下架，或链接不正确。
            </p>
            <Button asChild className="mt-4 w-fit" variant="secondary">
              <Link href="/community">返回灵感社区</Link>
            </Button>
          </Card>
        </main>
      </AppShell>
    );
  }

  return (
    <AppShell currentPath="/community" showAdminLink={showAdminLink}>
      <main className="mx-auto flex w-full max-w-[1180px] flex-col gap-5 px-5 py-6">
        <AppPageHeader
          eyebrow="作品详情"
          title={work.title}
          description={work.scene ? `场景：${work.scene}` : undefined}
          actions={
            <Button asChild variant="ghost">
              <Link href="/community">← 灵感社区</Link>
            </Button>
          }
        />

        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(320px,400px)]">
          <Card className="overflow-hidden p-0">
            <div className="relative bg-muted">
              <img
                alt={work.title}
                className="block max-h-[55vh] w-full object-contain md:max-h-[calc(100vh-220px)]"
                src={work.image_url}
              />
              <div className="absolute left-3 top-3 flex flex-wrap gap-1.5">
                {work.featured ? (
                  <Badge
                    className="bg-amber-50 text-amber-700 backdrop-blur dark:bg-amber-500/15 dark:text-amber-300"
                    variant="outline"
                  >
                    <Star aria-hidden className="size-3 fill-amber-400 text-amber-500" />
                    精选
                  </Badge>
                ) : null}
                {work.scene ? (
                  <Badge className="bg-card/85 backdrop-blur" variant="outline">
                    {work.scene}
                  </Badge>
                ) : null}
              </div>
            </div>
          </Card>

          <Card>
            <CardContent className="flex flex-col gap-4 px-5 py-5">
              {work.tags.length > 0 ? (
                <div className="flex flex-wrap gap-1">
                  {work.tags.map((tag) => (
                    <Badge key={tag} variant="secondary">
                      {tag}
                    </Badge>
                  ))}
                </div>
              ) : null}

              {/* 主 CTA：生成同款草稿 — spec 强制 */}
              {work.same_generation_available ? (
                <div className="flex flex-col gap-2 border-t border-border pt-4">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                    同款创作
                  </span>
                  <Button
                    disabled={sameLoading}
                    onClick={() => void loadSameGenerationDraft(work.work_id)}
                    type="button"
                  >
                    <Sparkles aria-hidden className="size-4" />
                    {sameLoading ? "生成中..." : "生成同款草稿"}
                  </Button>
                  {samePrompt ? (
                    <>
                      <p className="rounded-md bg-muted/60 px-3 py-2 text-[12.5px] leading-relaxed text-foreground/80">
                        {samePrompt}
                      </p>
                      <Button asChild variant="secondary">
                        <Link href={`/?same_work=${work.work_id}`}>
                          <ImagePlus aria-hidden className="size-4" />
                          套用到创作台
                        </Link>
                      </Button>
                    </>
                  ) : null}
                  {sameError ? (
                    <p className="text-[12.5px] text-destructive">{sameError}</p>
                  ) : null}
                </div>
              ) : null}

              {/* 互动操作 */}
              <div className="flex items-center gap-1 border-t border-border pt-4">
                <Button
                  className={cn(interaction.liked && "text-rose-600")}
                  onClick={() => void toggleInteraction("like")}
                  size="sm"
                  type="button"
                  variant="ghost"
                >
                  <Heart
                    aria-hidden
                    className={cn("size-3.5", interaction.liked && "fill-rose-500")}
                  />
                  {interaction.liked ? "已点赞" : "点赞"} {interaction.like_count}
                </Button>
                <Button
                  className={cn(interaction.favorited && "text-amber-700")}
                  onClick={() => void toggleInteraction("favorite")}
                  size="sm"
                  type="button"
                  variant="ghost"
                >
                  <Bookmark
                    aria-hidden
                    className={cn(
                      "size-3.5",
                      interaction.favorited && "fill-amber-400"
                    )}
                  />
                  {interaction.favorited ? "已收藏" : "收藏"} {interaction.favorite_count}
                </Button>
                <div className="grow" />
                <Button
                  className="text-muted-foreground"
                  disabled={reportState === "sending" || reportState === "sent"}
                  onClick={() => void reportWork()}
                  size="sm"
                  type="button"
                  variant="ghost"
                >
                  <Flag aria-hidden className="size-3.5" />
                  举报作品
                </Button>
              </div>
              {reportState === "sent" ? (
                <p className="text-[12px] text-muted-foreground">已提交举报</p>
              ) : null}
              {reportState === "failed" ? (
                <p className="text-[12px] text-destructive">举报提交失败，请稍后重试。</p>
              ) : null}

              {/* 公开 Prompt / 隐私说明 */}
              <div className="flex flex-col gap-1.5 border-t border-border pt-4">
                <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                  {work.prompt ? "公开 Prompt" : "Prompt 未公开"}
                </span>
                <p className="text-[12.5px] leading-relaxed text-muted-foreground">
                  {work.prompt ??
                    "作者未公开原始 Prompt，同款生成只会使用公开场景、标签和安全约束。"}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </AppShell>
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
