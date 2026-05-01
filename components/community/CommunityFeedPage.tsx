"use client";

import Link from "next/link";
import { Bookmark, Heart, Star } from "lucide-react";
import { useState } from "react";

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
};

export default function CommunityFeedPage(props: CommunityFeedPageProps) {
  return <CommunityFeedContent key={communityFeedKey(props.works)} {...props} />;
}

function CommunityFeedContent({
  filters,
  works
}: CommunityFeedPageProps) {
  const [items, setItems] = useState(works);

  return (
    <main className="community-shell">
      <header className="community-header">
        <Link className="secondary-button" href="/">
          返回创作台
        </Link>
        <div>
          <h1>灵感社区</h1>
          <p>公开作品、商业场景标签和可复用创意。</p>
        </div>
      </header>

      {filters ? (
        <section className="community-filter-bar" aria-label="社区筛选">
          <div className="segmented" aria-label="排序" role="group">
            {[
              { label: "最新", value: "latest" },
              { label: "热门", value: "popular" },
              { label: "精选", value: "featured" }
            ].map((option) => (
              <Link
                aria-current={filters.sort === option.value ? "page" : undefined}
                className={`segment ${
                  filters.sort === option.value ? "active" : ""
                }`}
                href={communityHref(filters, { sort: option.value })}
                key={option.value}
              >
                {option.label}
              </Link>
            ))}
          </div>
          {filters.scenes.length > 0 ? (
            <div className="filter-chip-row" aria-label="场景筛选">
              <Link
                aria-current={filters.scene ? undefined : "page"}
                href={communityHref(filters, { scene: null })}
              >
                全部场景
              </Link>
              {filters.scenes.map((scene) => (
                <Link
                  aria-current={filters.scene === scene ? "page" : undefined}
                  href={communityHref(filters, { scene })}
                  key={scene}
                >
                  {scene}
                </Link>
              ))}
            </div>
          ) : null}
          {filters.tags.length > 0 ? (
            <div className="filter-chip-row" aria-label="标签筛选">
              <Link
                aria-current={filters.tag ? undefined : "page"}
                href={communityHref(filters, { tag: null })}
              >
                全部标签
              </Link>
              {filters.tags.map((tag) => (
                <Link
                  aria-current={filters.tag === tag ? "page" : undefined}
                  href={communityHref(filters, { tag })}
                  key={tag}
                >
                  {tag}
                </Link>
              ))}
            </div>
          ) : null}
        </section>
      ) : null}

      {works.length === 0 ? (
        <section className="community-empty">
          <h2>暂无公开作品</h2>
          <p>从创作台素材卡发布公开作品后，会出现在这里。</p>
        </section>
      ) : (
        <section className="community-grid" aria-label="公开作品">
          {items.map((work) => (
            <article className="community-work-card" key={work.work_id}>
              <img alt={work.title} src={work.thumbnail_url || work.image_url} />
              <div className="community-work-body">
                <div className="community-work-title-row">
                  <h2>{work.title}</h2>
                  <div className="community-card-badges">
                    {work.featured ? (
                      <span>
                        <Star size={12} aria-hidden="true" />
                        精选
                      </span>
                    ) : null}
                    {work.scene ? <span>{work.scene}</span> : null}
                  </div>
                </div>
                {work.tags.length > 0 ? (
                  <div className="tag-list">
                    {work.tags.map((tag) => (
                      <span key={tag}>{tag}</span>
                    ))}
                  </div>
                ) : null}
                <div className="history-actions">
                  <Link
                    className="secondary-button"
                    href={`/community/works/${work.work_id}`}
                  >
                    查看作品
                  </Link>
                  <button
                    className="secondary-button"
                    onClick={() => void toggleInteraction(work.work_id, "like")}
                    type="button"
                  >
                    <Heart size={15} aria-hidden="true" />
                    {work.liked ? "已点赞" : "点赞"} {work.like_count}
                  </button>
                  <button
                    className="secondary-button"
                    onClick={() =>
                      void toggleInteraction(work.work_id, "favorite")
                    }
                    type="button"
                  >
                    <Bookmark size={15} aria-hidden="true" />
                    {work.favorited ? "已收藏" : "收藏"} {work.favorite_count}
                  </button>
                  {work.same_generation_available ? (
                    <span className="template-pill">可同款</span>
                  ) : null}
                </div>
              </div>
            </article>
          ))}
        </section>
      )}
    </main>
  );

  async function toggleInteraction(
    workId: string,
    type: "like" | "favorite"
  ) {
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
