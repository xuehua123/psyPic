import Link from "next/link";
import { ArrowRight, Download, ImagePlus, Star } from "lucide-react";

import AppPageHeader from "@/components/layout/AppPageHeader";
import AppShell from "@/components/layout/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  listImageAlbumsForUser,
  listImageLibraryAssetsForUser
} from "@/server/services/image-task-service";
import { getCurrentRequestViewer } from "@/server/services/request-user-service";

export default async function LibraryPage() {
  const viewer = await getCurrentRequestViewer();
  const session = viewer.session;
  const [assets, albums] = session
    ? await Promise.all([
        listImageLibraryAssetsForUser(session.user_id, { limit: 36 }),
        listImageAlbumsForUser(session.user_id)
      ])
    : [{ items: [], nextCursor: null }, []];
  const favoriteCount = assets.items.filter((item) => item.favorite).length;
  const tagCount = new Set(assets.items.flatMap((item) => item.tags)).size;

  return (
    <AppShell currentPath="/library" showAdminLink={viewer.isAdmin}>
      <main className="mx-auto flex w-full max-w-[1180px] flex-col gap-6 px-5 py-6">
        <AppPageHeader
          eyebrow="素材资产"
          title="素材库"
          description="集中查看生成结果、收藏、标签和继续编辑入口。"
          actions={
            <Button asChild variant="secondary">
              <Link href="/">
                <ArrowRight aria-hidden className="size-4 -rotate-180" />
                返回工作台
              </Link>
            </Button>
          }
        />

        {/* 紧凑指标条：spec 要求"密度感、不抢主区"，所以用单行 chips 而不是大卡片 */}
        <div className="flex flex-wrap items-center gap-2 text-[13px] text-muted-foreground">
          <Badge variant="outline">{assets.items.length} 素材</Badge>
          {favoriteCount > 0 ? <Badge>{favoriteCount} 收藏</Badge> : null}
          {tagCount > 0 ? <Badge variant="secondary">{tagCount} 标签</Badge> : null}
          {albums.length > 0 ? <Badge variant="secondary">{albums.length} 相册</Badge> : null}
        </div>

        {assets.items.length === 0 ? (
          <Card className="flex flex-col items-start gap-3 p-6">
            <h2 className="text-base font-semibold">还没有素材</h2>
            <p className="text-[13px] text-muted-foreground">
              在工作台生成图片后，结果会进入素材库；也可以从历史记录继续编辑。
            </p>
            <Button asChild variant="secondary">
              <Link href="/">去生成第一张</Link>
            </Button>
          </Card>
        ) : (
          <section
            aria-label="素材列表"
            className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
          >
            {assets.items.map((item) => (
              <Card
                className="group overflow-hidden p-0 transition-shadow hover:shadow-md"
                key={item.asset_id}
              >
                <Link href={`/library/${item.asset_id}`} className="block">
                  <div className="relative aspect-square overflow-hidden bg-muted">
                    <img
                      alt={item.prompt}
                      className="size-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                      src={item.thumbnail_url}
                    />
                    {item.favorite ? (
                      <Star
                        aria-hidden
                        className="absolute right-2 top-2 size-4 fill-amber-400 text-amber-500"
                      />
                    ) : null}
                  </div>
                </Link>
                <CardContent className="flex flex-col gap-2.5 px-3.5 py-3">
                  <p className="line-clamp-2 text-[12.5px] leading-relaxed text-foreground/80">
                    {item.prompt}
                  </p>
                  <div className="flex flex-wrap gap-1">
                    <Badge variant="secondary">{item.params.size}</Badge>
                    <Badge variant="outline">{item.format.toUpperCase()}</Badge>
                  </div>
                  <div className="flex gap-1.5 pt-0.5">
                    <Button asChild className="flex-1" size="sm">
                      <Link href={`/?reference_asset=${item.asset_id}`}>
                        <ImagePlus aria-hidden className="size-3.5" />
                        继续编辑
                      </Link>
                    </Button>
                    <Button asChild size="sm" variant="ghost" aria-label="详情">
                      <Link href={`/library/${item.asset_id}`}>
                        <Download aria-hidden className="size-3.5" />
                      </Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </section>
        )}
      </main>
    </AppShell>
  );
}
