import Link from "next/link";
import {
  Image as ImageIcon,
  Megaphone,
  PaintBucket,
  PencilRuler,
  ShoppingBag,
  Sparkles,
  User2,
  Wand2,
  type LucideIcon
} from "lucide-react";

import AppPageHeader from "@/components/layout/AppPageHeader";
import AppShell from "@/components/layout/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/components/ui/card";
import { commercialTemplates } from "@/lib/templates/commercial-templates";
import { isCurrentRequestAdmin } from "@/server/services/request-user-service";

/**
 * 商业模板页：场景化模板的"门厅"。
 * 强调示例感、商业用途与可复用性，不堆砌 chip 噪声。
 */
export default async function TemplatesPage() {
  const showAdminLink = await isCurrentRequestAdmin();

  return (
    <AppShell currentPath="/templates" showAdminLink={showAdminLink}>
      <main className="mx-auto flex w-full max-w-[1180px] flex-col gap-6 px-5 py-6">
        <AppPageHeader
          eyebrow="Prompt 系统"
          title="商业模板"
          description="把固定场景、参数和 Prompt 结构沉淀成可复用的创作入口。"
          actions={
            <Button asChild>
              <Link href="/">
                <Sparkles aria-hidden className="size-4" />
                去工作台使用
              </Link>
            </Button>
          }
        />

        <section
          aria-label="模板列表"
          className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3"
        >
          {commercialTemplates.map((template) => (
            <TemplateCard
              defaultParams={template.defaultParams}
              description={template.description}
              fields={template.fields.slice(0, 4).map((field) => field.label)}
              key={template.id}
              name={template.name}
              requiresImage={template.requiresImage}
              requiresMask={template.requiresMask ?? false}
              scene={template.scene}
              sceneId={template.id}
            />
          ))}
        </section>
      </main>
    </AppShell>
  );
}

const sceneIconMap: Record<string, LucideIcon> = {
  ecommerce: ShoppingBag,
  background_replacement: PaintBucket,
  lifestyle: ImageIcon,
  ad_banner: Megaphone,
  social_cover: ImageIcon,
  local_edit: PencilRuler,
  brand_poster: Sparkles,
  portrait: User2,
  app_hero: Wand2
};

const sceneGradientMap: Record<string, string> = {
  ecommerce: "from-emerald-100 via-teal-50 to-sky-100",
  background_replacement: "from-amber-100 via-orange-50 to-rose-100",
  lifestyle: "from-violet-100 via-fuchsia-50 to-rose-100",
  ad_banner: "from-blue-100 via-cyan-50 to-emerald-100",
  social_cover: "from-pink-100 via-rose-50 to-red-100",
  local_edit: "from-slate-200 via-slate-100 to-zinc-100",
  brand_poster: "from-indigo-100 via-violet-50 to-purple-100",
  portrait: "from-orange-100 via-amber-50 to-yellow-100",
  app_hero: "from-cyan-100 via-sky-50 to-indigo-100"
};

function TemplateCard({
  description,
  defaultParams,
  fields,
  name,
  requiresImage,
  requiresMask,
  scene,
  sceneId
}: {
  description: string;
  defaultParams: { size: string; quality: string; output_format: string };
  fields: string[];
  name: string;
  requiresImage: boolean;
  requiresMask: boolean;
  scene: string;
  sceneId: string;
}) {
  const Icon = sceneIconMap[sceneId] ?? sceneIconMap[scene] ?? ImageIcon;
  const gradient =
    sceneGradientMap[sceneId] ?? sceneGradientMap[scene] ?? "from-slate-100 to-slate-50";

  return (
    <Card className="group overflow-hidden p-0 transition-shadow hover:shadow-md">
      {/* 示例位：spec 强制要求"模板卡片必须展示示例图"，先用渐变 + scene icon 占位 */}
      <div
        aria-hidden
        className={`relative flex aspect-[16/10] items-center justify-center bg-gradient-to-br ${gradient}`}
      >
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_30%,rgba(255,255,255,0.6),transparent_55%)]" />
        <Icon className="size-12 text-foreground/40" strokeWidth={1.4} />
        <Badge
          className="absolute left-3 top-3 bg-card/80 text-foreground backdrop-blur"
          variant="outline"
        >
          {scene}
        </Badge>
      </div>

      <CardHeader className="px-5 pb-2 pt-4">
        <CardTitle className="text-[15px]">{name}</CardTitle>
        <CardDescription className="line-clamp-2">{description}</CardDescription>
      </CardHeader>

      <CardContent className="flex flex-col gap-3 px-5 pb-4">
        <div className="flex flex-wrap gap-1.5">
          <Badge variant="secondary">{defaultParams.size}</Badge>
          <Badge variant="secondary">{defaultParams.quality}</Badge>
          <Badge variant="secondary">{defaultParams.output_format.toUpperCase()}</Badge>
          {requiresImage ? <Badge variant="outline">参考图</Badge> : null}
          {requiresMask ? <Badge variant="outline">遮罩</Badge> : null}
        </div>

        {fields.length > 0 ? (
          <div className="flex flex-wrap gap-1 text-[11px] text-muted-foreground">
            {fields.map((field, index) => (
              <span key={field}>
                {field}
                {index < fields.length - 1 ? <span className="mx-1 opacity-50">·</span> : null}
              </span>
            ))}
          </div>
        ) : null}

        <Button asChild className="mt-1 w-full" size="sm" variant="secondary">
          <Link href="/">在工作台打开 →</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
