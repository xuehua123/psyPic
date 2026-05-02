"use client";

import {
  ClipboardList,
  Save,
  ShieldAlert,
  ShieldCheck,
  Star,
  Undo2
} from "lucide-react";
import { type FormEvent, useState } from "react";

import AppPageHeader from "@/components/layout/AppPageHeader";
import AppShell from "@/components/layout/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";

export type AdminRuntimeSettings = {
  max_n: number;
  max_upload_mb: number;
  max_size_tier: "2K" | "4K";
  allow_moderation_low: boolean;
  community_enabled: boolean;
  public_publish_enabled: boolean;
  stream_enabled: boolean;
};

export type AdminUsageSummary = {
  task_count: number;
  image_count: number;
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
  estimated_cost: string;
};

export type AdminCommunityReport = {
  report_id: string;
  work_id: string;
  reason: string;
  details: string | null;
  status: string;
  created_at: string;
  work: {
    work_id: string;
    title: string;
    review_status: string;
    visibility: string;
    featured: boolean;
  } | null;
};

export type AdminAuditLog = {
  audit_id: string;
  action: string;
  target_type: string;
  target_id: string;
  request_id: string;
  created_at: string;
};

export default function AdminDashboardPage({
  auditLogs,
  reports,
  runtimeSettings,
  usage
}: {
  auditLogs: AdminAuditLog[];
  reports: AdminCommunityReport[];
  runtimeSettings: AdminRuntimeSettings;
  usage: AdminUsageSummary;
}) {
  const [settings, setSettings] = useState<AdminRuntimeSettings>(runtimeSettings);
  const [saveState, setSaveState] = useState<
    "idle" | "saving" | "saved" | "failed"
  >("idle");

  return (
    <AppShell currentPath="/admin" showAdminLink>
      <main className="mx-auto flex w-full max-w-[1180px] flex-col gap-6 px-5 py-6">
        <AppPageHeader
          eyebrow="运营控制"
          title="管理端"
          description="运行时限制、社区审核和审计记录。危险操作不可逆，请确认后执行。"
        />

        {/* 紧凑指标条：spec 要求"密度感、控制感强、不抢主区" */}
        <section
          aria-label="usage 汇总"
          className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
        >
          <Metric label="生成任务" value={String(usage.task_count)} />
          <Metric label="生成图片" value={String(usage.image_count)} />
          <Metric label="总 tokens" value={String(usage.total_tokens)} />
          <Metric label="估算成本" value={usage.estimated_cost} />
        </section>

        <section className="grid gap-5 lg:grid-cols-[minmax(280px,360px)_minmax(0,1fr)]">
          {/* 运行时配置 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-[14px]">
                <ShieldCheck aria-hidden className="size-4 text-accent" />
                运行时配置
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form className="flex flex-col gap-4" onSubmit={(event) => void saveSettings(event)}>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="admin-max-n">最大生成数量</Label>
                  <Input
                    aria-label="最大生成数量"
                    id="admin-max-n"
                    max={8}
                    min={1}
                    onChange={(event) =>
                      setSettings({
                        ...settings,
                        max_n: Number(event.currentTarget.value)
                      })
                    }
                    type="number"
                    value={settings.max_n}
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="admin-max-upload">最大上传 MB</Label>
                  <Input
                    aria-label="最大上传 MB"
                    id="admin-max-upload"
                    max={100}
                    min={1}
                    onChange={(event) =>
                      setSettings({
                        ...settings,
                        max_upload_mb: Number(event.currentTarget.value)
                      })
                    }
                    type="number"
                    value={settings.max_upload_mb}
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="admin-max-size">最大尺寸层级</Label>
                  <Select
                    onValueChange={(value) =>
                      setSettings({
                        ...settings,
                        max_size_tier: value as "2K" | "4K"
                      })
                    }
                    value={settings.max_size_tier}
                  >
                    <SelectTrigger aria-label="最大尺寸层级" id="admin-max-size">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="2K">2K</SelectItem>
                      <SelectItem value="4K">4K</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex flex-col gap-2 border-t border-border pt-3">
                  <ToggleField
                    checked={settings.allow_moderation_low}
                    label="允许 moderation=low"
                    onChange={(value) =>
                      setSettings({ ...settings, allow_moderation_low: value })
                    }
                  />
                  <ToggleField
                    checked={settings.community_enabled}
                    label="启用社区"
                    onChange={(value) =>
                      setSettings({ ...settings, community_enabled: value })
                    }
                  />
                  <ToggleField
                    checked={settings.public_publish_enabled}
                    label="允许公开发布"
                    onChange={(value) =>
                      setSettings({ ...settings, public_publish_enabled: value })
                    }
                  />
                  <ToggleField
                    checked={settings.stream_enabled}
                    label="启用流式生成"
                    onChange={(value) =>
                      setSettings({ ...settings, stream_enabled: value })
                    }
                  />
                </div>

                <div className="flex items-center gap-3 pt-1">
                  <Button disabled={saveState === "saving"} type="submit">
                    <Save aria-hidden className="size-4" />
                    保存运行时配置
                  </Button>
                  {saveState === "saved" ? (
                    <span className="text-[12px] text-emerald-700">已保存</span>
                  ) : null}
                  {saveState === "failed" ? (
                    <span className="text-[12px] text-destructive">
                      保存失败，请检查管理员 session。
                    </span>
                  ) : null}
                </div>
              </form>
            </CardContent>
          </Card>

          {/* 举报队列 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-[14px]">
                <ShieldAlert aria-hidden className="size-4 text-amber-600" />
                举报队列
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {reports.length === 0 ? (
                <p className="text-[13px] text-muted-foreground">
                  当前没有待处理举报。
                </p>
              ) : (
                reports.map((report) => (
                  <article
                    className="flex flex-col gap-2 rounded-md border border-border bg-muted/40 p-3"
                    key={report.report_id}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <strong className="text-[13.5px] font-semibold">
                          {report.work?.title ?? report.work_id}
                        </strong>
                        <p className="mt-1 text-[12.5px] text-muted-foreground">
                          {report.reason}
                        </p>
                        {report.details ? (
                          <p className="mt-0.5 text-[12.5px] text-foreground/80">
                            {report.details}
                          </p>
                        ) : null}
                      </div>
                      <Badge variant="secondary">{report.status}</Badge>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      <Button
                        onClick={() => void moderateWork(report.work_id, "take-down")}
                        size="sm"
                        type="button"
                        variant="destructive"
                      >
                        下架
                      </Button>
                      <Button
                        onClick={() => void moderateWork(report.work_id, "restore")}
                        size="sm"
                        type="button"
                        variant="secondary"
                      >
                        <Undo2 aria-hidden className="size-3.5" />
                        恢复
                      </Button>
                      <Button
                        onClick={() => void featureWork(report.work_id, true)}
                        size="sm"
                        type="button"
                        variant="ghost"
                      >
                        <Star aria-hidden className="size-3.5" />
                        精选
                      </Button>
                    </div>
                  </article>
                ))
              )}
            </CardContent>
          </Card>
        </section>

        {/* 审计日志 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-[14px]">
              <ClipboardList aria-hidden className="size-4 text-muted-foreground" />
              审计日志
            </CardTitle>
          </CardHeader>
          <CardContent>
            {auditLogs.length === 0 ? (
              <p className="text-[13px] text-muted-foreground">暂无审计日志。</p>
            ) : (
              <div className="overflow-hidden rounded-md border border-border">
                <table className="w-full text-[12.5px]">
                  <thead className="bg-muted/60 text-[11px] uppercase tracking-wider text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2 text-left font-semibold">动作</th>
                      <th className="px-3 py-2 text-left font-semibold">对象</th>
                      <th className="px-3 py-2 text-left font-semibold">Request ID</th>
                    </tr>
                  </thead>
                  <tbody>
                    {auditLogs.map((log, index) => (
                      <tr
                        className={index % 2 === 0 ? "" : "bg-muted/20"}
                        key={log.audit_id}
                      >
                        <td className="px-3 py-2 font-medium">{log.action}</td>
                        <td className="px-3 py-2 text-muted-foreground">
                          {log.target_type} / {log.target_id}
                        </td>
                        <td className="px-3 py-2 font-mono text-[11.5px] text-muted-foreground">
                          {log.request_id}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </AppShell>
  );

  async function saveSettings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaveState("saving");

    try {
      const response = await fetch("/api/admin/runtime-settings", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(settings)
      });

      setSaveState(response.ok ? "saved" : "failed");
    } catch {
      setSaveState("failed");
    }
  }
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <Card className="p-4">
      <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div className="mt-1.5 text-2xl font-semibold leading-tight tracking-tight">
        {value}
      </div>
    </Card>
  );
}

function ToggleField({
  checked,
  label,
  onChange
}: {
  checked: boolean;
  label: string;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-3 rounded-md border border-border bg-card px-3 py-2 text-[13px] font-medium text-foreground transition-colors hover:bg-muted/50">
      <span>{label}</span>
      <input
        aria-label={label}
        checked={checked}
        className="size-4 cursor-pointer accent-accent"
        onChange={(event) => onChange(event.currentTarget.checked)}
        type="checkbox"
      />
    </label>
  );
}

async function moderateWork(workId: string, action: "take-down" | "restore") {
  await fetch(`/api/admin/community/works/${workId}/${action}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ reason: "admin dashboard" })
  });
}

async function featureWork(workId: string, featured: boolean) {
  await fetch(`/api/admin/community/works/${workId}/feature`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ featured })
  });
}
