"use client";

/**
 * TemplatePickerDialog —— 商业模板选择 Modal（plan slug
 * quiet-glittering-prism · Cut 7）。
 *
 * 把模板入口从右 Inspector 上提到 Composer 的「+ 模板」chip：用户点击
 * QuickPickRow 的模板 chip 后弹出此 Modal，浏览 14 个精选模板（4 大分组），
 * 选定后回填到 useCreatorStudio() 的 selectedTemplateId / templateFieldValues。
 *
 * 与 SessionRenameDialog 同模式：Form / state 隔离，靠 Portal mount/unmount
 * 重置。点击模板卡 → 调 selectCommercialTemplate(id) → 关 Modal。
 *
 * 缩略图 placeholder：emoji + 渐变背景（不依赖外部素材；正式上线后可替换为
 * 实际渲染示例图）。
 */

import * as React from "react";
import { ImagePlus, Layers } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import {
  commercialTemplates,
  getCommercialTemplatesByCategory,
  TEMPLATE_CATEGORY_LABEL,
  type CommercialTemplate,
  type CommercialTemplateCategory
} from "@/lib/templates/commercial-templates";
import { useCreatorStudio } from "@/components/creator/studio/CreatorStudioContext";
import { cn } from "@/lib/utils";

const CATEGORY_ORDER: CommercialTemplateCategory[] = [
  "ecommerce",
  "marketing",
  "content",
  "portrait_brand"
];

/** 每个模板的占位缩略 —— emoji + 渐变。后续替换为真实示例图。 */
const TEMPLATE_PLACEHOLDER: Record<string, { emoji: string; gradient: string }> = {
  tpl_ecommerce_main: { emoji: "🛒", gradient: "from-amber-100 to-orange-200" },
  tpl_product_background: { emoji: "🎨", gradient: "from-slate-100 to-slate-300" },
  tpl_lifestyle_scene: { emoji: "🏡", gradient: "from-emerald-100 to-teal-200" },
  tpl_product_compare: { emoji: "🔄", gradient: "from-blue-100 to-indigo-200" },
  tpl_product_detail: { emoji: "🔍", gradient: "from-zinc-100 to-zinc-300" },
  tpl_ad_banner: { emoji: "📢", gradient: "from-red-100 to-pink-200" },
  tpl_app_hero: { emoji: "🚀", gradient: "from-sky-100 to-blue-200" },
  tpl_promo_poster: { emoji: "🎁", gradient: "from-rose-100 to-red-200" },
  tpl_feed_ad: { emoji: "📱", gradient: "from-violet-100 to-purple-200" },
  tpl_social_cover: { emoji: "📸", gradient: "from-pink-100 to-rose-200" },
  tpl_wechat_header: { emoji: "📰", gradient: "from-yellow-100 to-amber-200" },
  tpl_youtube_thumb: { emoji: "🎬", gradient: "from-red-100 to-orange-200" },
  tpl_portrait_avatar: { emoji: "👤", gradient: "from-stone-100 to-stone-300" },
  tpl_brand_poster: { emoji: "🌟", gradient: "from-purple-100 to-fuchsia-200" },
  tpl_mask_local_edit: { emoji: "✂️", gradient: "from-gray-100 to-slate-200" }
};

const DEFAULT_PLACEHOLDER = {
  emoji: "🎨",
  gradient: "from-slate-100 to-slate-200"
} as const;

export type TemplatePickerDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export default function TemplatePickerDialog({
  open,
  onOpenChange
}: TemplatePickerDialogProps) {
  const { selectedTemplate, selectCommercialTemplate } = useCreatorStudio();

  const groups = React.useMemo(() => getCommercialTemplatesByCategory(), []);

  function handleSelect(template: CommercialTemplate) {
    selectCommercialTemplate(template.id);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-3xl max-h-[80vh] overflow-y-auto"
        data-testid="template-picker-dialog"
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Layers size={18} aria-hidden="true" />
            选择商业模板
          </DialogTitle>
          <DialogDescription>
            按场景分类的 {commercialTemplates.length} 个精选模板；选定后会
            自动套用尺寸 / 格式预设并填好字段默认值，可在 prompt 输入区进一步
            微调。
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-6 pt-2">
          {CATEGORY_ORDER.map((category) => {
            const categoryTemplates = groups[category];
            if (categoryTemplates.length === 0) {
              return null;
            }
            return (
              <section
                aria-label={TEMPLATE_CATEGORY_LABEL[category]}
                data-testid={`template-picker-group-${category}`}
                key={category}
              >
                <h3 className="mb-2 flex items-center gap-2 text-sm font-medium text-foreground">
                  <span>{TEMPLATE_CATEGORY_LABEL[category]}</span>
                  <span className="text-xs text-muted-foreground">
                    {categoryTemplates.length} 个模板
                  </span>
                </h3>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {categoryTemplates.map((template) => (
                    <TemplateCard
                      key={template.id}
                      template={template}
                      isActive={selectedTemplate?.id === template.id}
                      onSelect={() => handleSelect(template)}
                    />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function TemplateCard({
  template,
  isActive,
  onSelect
}: {
  template: CommercialTemplate;
  isActive: boolean;
  onSelect: () => void;
}) {
  const placeholder = TEMPLATE_PLACEHOLDER[template.id] ?? DEFAULT_PLACEHOLDER;
  const primaryFieldCount = template.fields.filter(
    (f) => (f.placement ?? "primary") === "primary" && f.type !== "constant"
  ).length;
  const advancedFieldCount = template.fields.filter(
    (f) => f.placement === "advanced" && f.type !== "constant"
  ).length;

  return (
    <button
      aria-label={`选择模板：${template.name}`}
      aria-pressed={isActive}
      className={cn(
        "template-card",
        isActive ? "template-card-active" : undefined
      )}
      data-active={isActive ? "true" : undefined}
      data-testid={`template-card-${template.id}`}
      onClick={onSelect}
      type="button"
    >
      <div
        aria-hidden="true"
        className={cn(
          "template-card-thumb bg-gradient-to-br",
          placeholder.gradient
        )}
      >
        <span className="template-card-emoji">{placeholder.emoji}</span>
      </div>
      <div className="template-card-body">
        <div className="template-card-header">
          <strong>{template.name}</strong>
          {template.requiresImage ? (
            <span
              aria-label="需要参考图"
              className="template-card-badge"
              title="需要参考图"
            >
              <ImagePlus size={10} aria-hidden="true" />
              图生图
            </span>
          ) : null}
        </div>
        <p className="template-card-desc">{template.description}</p>
        <div className="template-card-meta">
          <span>{template.defaultParams.size}</span>
          <span>·</span>
          <span>
            {primaryFieldCount} 主字段
            {advancedFieldCount > 0 ? ` + ${advancedFieldCount} 细节` : ""}
          </span>
        </div>
      </div>
    </button>
  );
}
