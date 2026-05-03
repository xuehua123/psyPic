import Link from "next/link";
import { Clock, Download, FileImage, Hash, ImagePlus, Star, Tags } from "lucide-react";
import type { ImageGenerationParams } from "@/lib/validation/image-params";

import AppPageHeader from "@/components/layout/AppPageHeader";
import AppShell from "@/components/layout/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

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
  errorMessage,
  showAdminLink = false
}: {
  item: LibraryAssetDetailItem | null;
  errorMessage?: string;
  showAdminLink?: boolean;
}) {
  return (
    <AppShell currentPath="/library" showAdminLink={showAdminLink}>
      <main className="mx-auto flex w-full max-w-[1180px] flex-col gap-5 px-5 py-6">
        {!item ? (
          <Card role="alert" className="p-6">
            <CardTitle className="mb-1.5 text-base">无法打开素材</CardTitle>
            <p className="text-[13px] text-muted-foreground">
              {errorMessage ?? "素材不存在或无权访问。"}
            </p>
            <Button asChild className="mt-4 w-fit" variant="secondary">
              <Link href="/library">返回素材库</Link>
            </Button>
          </Card>
        ) : (
          <>
            <AppPageHeader
              eyebrow="素材详情"
              title={item.prompt}
              description={`${item.type === "edit" ? "图生图" : "文生图"} · ${item.params.size} · ${item.format.toUpperCase()}`}
            />

            <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(320px,400px)]">
              <Card className="overflow-hidden p-0">
                <div className="relative bg-muted">
                  <img
                    alt={`素材 ${item.asset_id}`}
                    className="block max-h-[55vh] w-full object-contain md:max-h-[calc(100vh-220px)]"
                    src={item.thumbnail_url}
                  />
                  {item.favorite ? (
                    <Star
                      aria-hidden
                      className="absolute right-3 top-3 size-5 fill-amber-400 text-amber-500"
                    />
                  ) : null}
                </div>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-[14px]">
                    <Tags aria-hidden className="size-4 text-accent" />
                    素材信息
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col gap-4">
                  {/* 主 CTA：spec "继续编辑是主要动作" */}
                  <div className="flex flex-col gap-2">
                    <Button asChild>
                      <Link href={`/?reference_asset=${encodeURIComponent(item.asset_id)}`}>
                        <ImagePlus aria-hidden className="size-4" />
                        继续编辑
                      </Link>
                    </Button>
                    <Button asChild variant="secondary">
                      <a download href={item.url}>
                        <Download aria-hidden className="size-4" />
                        下载
                      </a>
                    </Button>
                  </div>

                  <div className="grid grid-cols-1 gap-2 border-t border-border pt-4 text-[12.5px]">
                    <MetaRow icon={Hash} label="Asset" value={item.asset_id} mono />
                    <MetaRow icon={FileImage} label="Task" value={item.task_id} mono />
                    {item.usage ? (
                      <MetaRow
                        icon={Hash}
                        label="Tokens"
                        value={`${item.usage.total_tokens} (in ${item.usage.input_tokens} / out ${item.usage.output_tokens})`}
                      />
                    ) : null}
                    {item.duration_ms ? (
                      <MetaRow icon={Clock} label="Duration" value={`${item.duration_ms} ms`} />
                    ) : null}
                  </div>

                  {item.tags.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5 border-t border-border pt-4">
                      {item.tags.map((tag) => (
                        <Badge key={tag} variant="secondary">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            </div>
          </>
        )}
      </main>
    </AppShell>
  );
}

function MetaRow({
  icon: Icon,
  label,
  value,
  mono
}: {
  icon: typeof Hash;
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-center gap-2">
      <Icon aria-hidden className="size-3.5 shrink-0 text-muted-foreground" />
      <span className="w-[68px] shrink-0 text-muted-foreground">{label}</span>
      <span className={mono ? "truncate font-mono text-[11.5px] text-foreground/80" : "text-foreground/80"}>
        {value}
      </span>
    </div>
  );
}
