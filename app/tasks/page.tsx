import Link from "next/link";
import { ArrowRight, ListChecks, Sparkles } from "lucide-react";

import BatchWorkflowPanel from "@/components/creator/BatchWorkflowPanel";
import { BatchProvider } from "@/components/creator/studio/BatchContext";
import AppPageHeader from "@/components/layout/AppPageHeader";
import AppShell from "@/components/layout/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { isCurrentRequestAdmin } from "@/server/services/request-user-service";

export default async function TasksPage() {
  const showAdminLink = await isCurrentRequestAdmin();

  return (
    <AppShell currentPath="/tasks" showAdminLink={showAdminLink}>
      <main className="mx-auto flex w-full max-w-[1180px] flex-col gap-6 px-5 py-6">
        <AppPageHeader
          eyebrow="任务系统"
          title="任务队列"
          description="集中处理批量 Prompt、CSV 导入、重试和任务状态恢复。后续接入 Redis / DB-backed queue 时无需切换页面。"
          actions={
            <Button asChild variant="secondary">
              <Link href="/">
                <ArrowRight aria-hidden className="size-4 -rotate-180" />
                返回工作台
              </Link>
            </Button>
          }
        />

        <section
          aria-label="批量与队列"
          className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(280px,360px)]"
        >
          <Card className="overflow-hidden">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-[14px]">
                <ListChecks aria-hidden className="size-4 text-accent" />
                批量工作流
              </CardTitle>
            </CardHeader>
            <CardContent className="px-0 pb-0">
              <BatchProvider defaultSize="1024x1024">
                <BatchWorkflowPanel />
              </BatchProvider>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-[14px]">
                <Sparkles aria-hidden className="size-4 text-accent" />
                生产队列规则
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <p className="text-[13px] leading-relaxed text-muted-foreground">
                这里保留和创作台一致的批量入口。后续接入 Redis 或 DB-backed queue
                时，页面会继续承载排队、取消、重试、超时和并发限制状态。
              </p>
              <div className="flex flex-wrap gap-1.5">
                <Badge>queued</Badge>
                <Badge variant="secondary">running</Badge>
                <Badge variant="success">succeeded</Badge>
                <Badge variant="destructive">failed</Badge>
                <Badge variant="outline">canceled</Badge>
              </div>
            </CardContent>
          </Card>
        </section>
      </main>
    </AppShell>
  );
}
