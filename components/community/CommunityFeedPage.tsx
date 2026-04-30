import Link from "next/link";

export type CommunityFeedItem = {
  work_id: string;
  title: string;
  scene: string | null;
  tags: string[];
  image_url: string;
  thumbnail_url: string;
  same_generation_available: boolean;
  created_at: string;
};

export default function CommunityFeedPage({
  works
}: {
  works: CommunityFeedItem[];
}) {
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

      {works.length === 0 ? (
        <section className="community-empty">
          <h2>暂无公开作品</h2>
          <p>从创作台素材卡发布公开作品后，会出现在这里。</p>
        </section>
      ) : (
        <section className="community-grid" aria-label="公开作品">
          {works.map((work) => (
            <article className="community-work-card" key={work.work_id}>
              <img alt={work.title} src={work.thumbnail_url || work.image_url} />
              <div className="community-work-body">
                <div className="community-work-title-row">
                  <h2>{work.title}</h2>
                  {work.scene ? <span>{work.scene}</span> : null}
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
}
