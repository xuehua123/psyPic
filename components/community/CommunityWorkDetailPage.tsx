import Link from "next/link";

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

export default function CommunityWorkDetailPage({
  work
}: {
  work: CommunityWorkDetail | null;
}) {
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
            <span className="inline-hint">发布者允许同款生成。</span>
          ) : null}
        </aside>
      </div>
    </main>
  );
}
