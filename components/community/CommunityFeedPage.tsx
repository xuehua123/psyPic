"use client";

import Link from "next/link";
import { Bookmark, Heart, ImagePlus, Star } from "lucide-react";
import { useState } from "react";

import AppPageHeader from "@/components/layout/AppPageHeader";
import AppShell from "@/components/layout/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export type CommunityFeedItem = {
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
  created_at: string;
};

type CommunityFeedPageProps = {
  filters?: {
    sort: "latest" | "popular" | "featured";
    scene: string | null;
    tag: string | null;
    scenes: string[];
    tags: string[];
  };
  works: CommunityFeedItem[];
  showAdminLink?: boolean;
};

export default function CommunityFeedPage(props: CommunityFeedPageProps) {
  return <CommunityFeedContent key={communityFeedKey(props.works)} {...props} />;
}

function CommunityFeedContent({
  filters,
  works,
  showAdminLink = false
}: CommunityFeedPageProps) {
  const [items, setItems] = useState(works);

  return (
    <AppShell currentPath="/community" showAdminLink={showAdminLink}>
      <main className="mx-auto flex w-full max-w-[1180px] flex-col gap-5 px-5 py-6">
        <AppPageHeader
          eyebrow="社区灵感"
          title="灵感社区"
          description="公开作品、商业场景标签和可复用创意。点击作品可进入详情或一键生成同款。"
        />

        {filters ? <FilterBar filters={filters} /> : null}

        {items.length === 0 ? (
          <Card className="flex flex-col items-start gap-2 p-7">
            <h2 className="text-base font-semibold">暂无公开作品</h2>
            <p className="text-[13px] text-muted-foreground">
              从创作台素材卡发布公开作品后，会出现在这里。
            </p>
            <Button asChild className="mt-3" variant="secondary">
              <Link href="/">去工作台创作</Link>
            </Button>
          </Card>
        ) : (
          <section
            aria-label="公开作品"
            className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
          >
            {items.map((work) => (
              <WorkCard
                key={work.work_id}
                work={work}
                onToggle={(type) => void toggleInteraction(work.work_id, type)}
              />
            ))}
          </section>
        )}
      </main>
    </AppShell>
  );

  async function toggleInteraction(workId: string, type: "like" | "favorite") {
    const current = items.find((item) => item.work_id === workId);
    if (!current) {
      return;
    }

    const enabled = type === "like" ? current.liked : current.favorited;
    const response = await fetch(`/api/community/works/${workId}/${type}`, {
      method: enabled ? "DELETE" : "POST"
    });
    const body = (await response.json().catch(() => ({}))) as {
      data?: Partial<CommunityFeedItem>;
    };

    if (!response.ok || !body.data) {
      return;
    }

    setItems((previous) =>
      previous.map((item) =>
        item.work_id === workId
          ? {
              ...item,
              like_count: body.data?.like_count ?? item.like_count,
              favorite_count: body.data?.favorite_count ?? item.favorite_count,
              liked: body.data?.liked ?? item.liked,
              favorited: body.data?.favorited ?? item.favorited
            }
          : item
      )
    );
  }
}

function FilterBar({
  filters
}: {
  filters: NonNullable<CommunityFeedPageProps["filters"]>;
}) {
  return (
    <Card className="flex flex-col gap-3 px-4 py-3.5">
      {/* 排序 */}
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="mr-1 text-[12px] font-semibold text-muted-foreground">
          排序
        </span>
        {(["latest", "popular", "featured"] as const).map((value) => {
          const label = value === "latest" ? "最新" : value === "popular" ? "热门" : "精选";
          const active = filters.sort === value;
          return (
            <Link
              aria-current={active ? "page" : undefined}
              className={cn(
                "inline-flex h-7 items-center rounded-full border px-3 text-[12.5px] font-medium transition-colors",
                active
                  ? "border-accent/30 bg-accent/10 text-accent"
                  : "border-border bg-card text-muted-foreground hover:bg-muted"
              )}
              href={communityHref(filters, { sort: value })}
              key={value}
            >
              {label}
            </Link>
          );
        })}
      </div>

      {/* 场景 */}
      {filters.scenes.length > 0 ? (
        <div className="flex flex-wrap items-center gap-1.5" aria-label="场景筛选">
          <span className="mr-1 text-[12px] font-semibold text-muted-foreground">
            场景
          </span>
          <Link
            aria-current={filters.scene ? undefined : "page"}
            className={cn(
              "inline-flex h-7 items-center rounded-full border px-3 text-[12.5px] transition-colors",
              !filters.scene
                ? "border-accent/30 bg-accent/10 text-accent"
                : "border-border bg-card text-muted-foreground hover:bg-muted"
            )}
            href={communityHref(filters, { scene: null })}
          >
            全部场景
          </Link>
          {filters.scenes.map((scene) => {
            const active = filters.scene === scene;
            return (
              <Link
                aria-current={active ? "page" : undefined}
                className={cn(
                  "inline-flex h-7 items-center rounded-full border px-3 text-[12.5px] transition-colors",
                  active
                    ? "border-accent/30 bg-accent/10 text-accent"
                    : "border-border bg-card text-muted-foreground hover:bg-muted"
                )}
                href={communityHref(filters, { scene })}
                key={scene}
              >
                {scene}
              </Link>
            );
          })}
        </div>
      ) : null}

      {/* 标签 */}
      {filters.tags.length > 0 ? (
        <div className="flex flex-wrap items-center gap-1.5" aria-label="标签筛选">
          <span className="mr-1 text-[12px] font-semibold text-muted-foreground">
            标签
          </span>
          <Link
            aria-current={filters.tag ? undefined : "page"}
            className={cn(
              "inline-flex h-7 items-center rounded-full border px-3 text-[12.5px] transition-colors",
              !filters.tag
                ? "border-accent/30 bg-accent/10 text-accent"
                : "border-border bg-card text-muted-foreground hover:bg-muted"
            )}
            href={communityHref(filters, { tag: null })}
          >
            全部标签
          </Link>
          {filters.tags.map((tag) => {
            const active = filters.tag === tag;
            return (
              <Link
                aria-current={active ? "page" : undefined}
                className={cn(
                  "inline-flex h-7 items-center rounded-full border px-3 text-[12.5px] transition-colors",
                  active
                    ? "border-accent/30 bg-accent/10 text-accent"
                    : "border-border bg-card text-muted-foreground hover:bg-muted"
                )}
                href={communityHref(filters, { tag })}
                key={tag}
              >
                {tag}
              </Link>
            );
          })}
        </div>
      ) : null}
    </Card>
  );
}

function WorkCard({
  work,
  onToggle
}: {
  work: CommunityFeedItem;
  onToggle: (type: "like" | "favorite") => void;
}) {
  return (
    <Card className="group overflow-hidden p-0 transition-shadow hover:shadow-md">
      <div className="relative aspect-square overflow-hidden bg-muted">
        <img
          alt={work.title}
          className="size-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
          src={work.thumbnail_url || work.image_url}
        />
        {/* hover 时浮现"生成同款"主 CTA（spec 强调） */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-end gap-2 bg-gradient-to-t from-black/55 via-black/20 to-transparent p-3 opacity-0 transition-opacity duration-200 group-hover:pointer-events-auto group-hover:opacity-100">
          <Button asChild className="pointer-events-auto h-8" size="sm">
            <Link href={`/community/works/${work.work_id}`}>
              <ImagePlus aria-hidden className="size-3.5" />
              生成同款
            </Link>
          </Button>
        </div>
        {/* 角标 */}
        <div className="absolute left-2 top-2 flex flex-wrap gap-1">
          {work.featured ? (
            <Badge className="bg-amber-50 text-amber-700 backdrop-blur" variant="outline">
              <Star aria-hidden className="size-3 fill-amber-400 text-amber-500" />
              精选
            </Badge>
          ) : null}
          {work.scene ? (
            <Badge className="bg-card/85 backdrop-blur" variant="outline">
              {work.scene}
            </Badge>
          ) : null}
          {work.same_generation_available ? (
            <Badge className="bg-accent text-accent-foreground" variant="default">
              可同款
            </Badge>
          ) : null}
        </div>
      </div>

      <CardContent className="flex flex-col gap-2.5 px-3.5 py-3">
        <h3 className="line-clamp-1 text-[14px] font-semibold leading-tight text-foreground">
          {work.title}
        </h3>

        {work.tags.length > 0 ? (
          <div className="flex flex-wrap gap-1">
            {work.tags.slice(0, 4).map((tag) => (
              <Badge key={tag} variant="secondary">
                {tag}
              </Badge>
            ))}
          </div>
        ) : null}

        <div className="flex items-center gap-1 pt-0.5">
          <Button
            className={cn(work.liked && "text-rose-600")}
            onClick={() => onToggle("like")}
            size="sm"
            type="button"
            variant="ghost"
          >
            <Heart
              aria-hidden
              className={cn("size-3.5", work.liked && "fill-rose-500")}
            />
            {work.liked ? "已点赞" : "点赞"} {work.like_count}
          </Button>
          <Button
            className={cn(work.favorited && "text-amber-700")}
            onClick={() => onToggle("favorite")}
            size="sm"
            type="button"
            variant="ghost"
          >
            <Bookmark
              aria-hidden
              className={cn("size-3.5", work.favorited && "fill-amber-400")}
            />
            {work.favorited ? "已收藏" : "收藏"} {work.favorite_count}
          </Button>
          <div className="grow" />
          <Button asChild size="sm" variant="ghost">
            <Link href={`/community/works/${work.work_id}`}>查看作品</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function communityFeedKey(works: CommunityFeedItem[]) {
  return works
    .map((work) =>
      [
        work.work_id,
        work.title,
        work.scene ?? "",
        work.tags.join(","),
        work.image_url,
        work.thumbnail_url,
        work.same_generation_available,
        work.like_count,
        work.favorite_count,
        work.liked,
        work.favorited,
        work.featured,
        work.created_at
      ].join(":")
    )
    .join("|");
}

function communityHref(
  filters: {
    sort: "latest" | "popular" | "featured";
    scene: string | null;
    tag: string | null;
  },
  patch: Partial<{
    sort: string;
    scene: string | null;
    tag: string | null;
  }>
) {
  const sort = patch.sort ?? filters.sort;
  const scene = patch.scene === undefined ? filters.scene : patch.scene;
  const tag = patch.tag === undefined ? filters.tag : patch.tag;
  const params = new URLSearchParams();

  if (sort && sort !== "latest") {
    params.set("sort", sort);
  }

  if (scene) {
    params.set("scene", scene);
  }

  if (tag) {
    params.set("tag", tag);
  }

  const query = params.toString();

  return query ? `/community?${query}` : "/community";
}
