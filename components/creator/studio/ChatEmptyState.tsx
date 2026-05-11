"use client";

/**
 * 工作台对话流的空状态。
 *
 * 当 displayedVersionNodes 为空时由 ChatTranscript 渲染。
 *
 * 视觉历史：
 * - Phase 4 第一刀（4116 行单文件巨兽拆分）抽出时保留装饰画布
 *   `<div className="studio-empty-canvas">` 但 CSS 已经 `display: none`
 *   屏蔽该装饰，留下 dead JSX。
 * - Phase 5 第 4 刀：删 dead 装饰画布，改成 4 个常用模板快捷卡
 *   网格（来自 useCreatorStudio() 的 mvpTemplates 前 4 个），点击
 *   直接套模板，符合 spec 「让用户最快进入创作」要求。
 */

import SectionHeading from "@/components/creator/studio/SectionHeading";
import { useCreatorStudio } from "@/components/creator/studio/CreatorStudioContext";
import { Sparkles, KeyRound, AlertTriangle, WifiOff } from "lucide-react";
import { useSession } from "@/components/auth/SessionProvider";
import { useWorkbench } from "@/lib/creator/use-workbench";
import { useState } from "react";
import { AuthDialog } from "@/components/auth/AuthDialog";
import Link from "next/link";
import { Button } from "@/components/ui/button";

type ChatEmptyStateProps = {
  emptyTitle: string;
  emptyDescription: string;
};

export default function ChatEmptyState({
  emptyTitle,
  emptyDescription
}: ChatEmptyStateProps) {
  const { mvpTemplates, selectCommercialTemplate } = useCreatorStudio();
  const { state: sessionState } = useSession();
  const workbench = useWorkbench();
  const [authDialogOpen, setAuthDialogOpen] = useState(false);

  const quickTemplates = mvpTemplates.slice(0, 4);

  if (sessionState.status === "loaded" && !sessionState.data.authenticated) {
    return (
      <section className="chat-empty-state" data-testid="active-gallery">
        <div className="studio-empty-state-panel">
          <div className="studio-empty-state-copy">
            <span className="template-pill !bg-blue-500/10 !text-blue-600 dark:!text-blue-400">
              <KeyRound className="inline mr-1 size-3" /> 未登录
            </span>
            <h2>欢迎使用 PsyPic 工作台</h2>
            <p>登录以使用云端项目同步与 API 商业生图额度。</p>
            <div className="mt-4">
              <Button onClick={() => setAuthDialogOpen(true)}>登录 / 注册</Button>
              <AuthDialog onOpenChange={setAuthDialogOpen} open={authDialogOpen} />
            </div>
          </div>
        </div>
      </section>
    );
  }

  if (sessionState.status === "loaded" && sessionState.data.authenticated && !sessionState.data.binding) {
    return (
      <section className="chat-empty-state" data-testid="active-gallery">
        <div className="studio-empty-state-panel">
          <div className="studio-empty-state-copy">
            <span className="template-pill !bg-orange-500/10 !text-orange-600 dark:!text-orange-400">
              <AlertTriangle className="inline mr-1 size-3" /> 缺少 API Key
            </span>
            <h2>未绑定 API Key</h2>
            <p>您已登录，但尚未绑定生图服务凭证。请前往设置页面配置 Manual Key 后继续。</p>
            <div className="mt-4">
              <Button asChild>
                <Link href="/settings">前往设置</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="chat-empty-state" data-testid="active-gallery">
      <div className="studio-empty-state-panel">
        <div className="studio-empty-state-copy">
          <span className="template-pill">新对话</span>
          <h2>{emptyTitle}</h2>
          <p>{emptyDescription}</p>
          {workbench.mode === "fallback" && (
            <div className="mt-2 text-sm text-yellow-600 dark:text-yellow-500 flex items-center justify-center gap-1">
              <WifiOff className="size-4" /> 本地离线模式：云端同步不可用
              {workbench.retryAfter && ` (请稍后重试)`}
            </div>
          )}
        </div>
        {quickTemplates.length > 0 ? (
          <div className="studio-empty-templates" aria-label="常用模板快捷入口">
            <SectionHeading icon={Sparkles} title="从模板开始" />
            <div className="studio-empty-template-grid">
              {quickTemplates.map((tpl) => (
                <button
                  key={tpl.id}
                  className="studio-empty-template-card"
                  onClick={() => selectCommercialTemplate(tpl.id)}
                  type="button"
                >
                  <strong>{tpl.name}</strong>
                  <span className="studio-empty-template-desc">
                    {tpl.description}
                  </span>
                  <span className="template-pill">
                    {tpl.requiresImage ? "需参考图" : "文生图"}
                  </span>
                </button>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}
