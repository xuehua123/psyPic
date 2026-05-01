"use client";

import Link from "next/link";
import { Save, ShieldCheck, Star, Undo2 } from "lucide-react";
import { type FormEvent, useState } from "react";

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
  const [settings, setSettings] = useAdminSettings(runtimeSettings);
  const [saveState, setSaveState] = useSaveState();

  return (
    <main className="admin-shell">
      <header className="admin-header">
        <div>
          <h1>管理端</h1>
          <p>运行时限制、社区审核和审计记录。</p>
        </div>
        <Link className="secondary-button" href="/">
          返回创作台
        </Link>
      </header>

      <section className="admin-metric-grid" aria-label="usage 汇总">
        <Metric label="生成任务" value={String(usage.task_count)} />
        <Metric label="生成图片" value={String(usage.image_count)} />
        <Metric label="总 tokens" value={String(usage.total_tokens)} />
        <Metric label="估算成本" value={usage.estimated_cost} />
      </section>

      <section className="admin-grid">
        <form className="admin-panel" onSubmit={(event) => void saveSettings(event)}>
          <div className="panel-header">
            <div className="panel-title">
              <ShieldCheck size={16} aria-hidden="true" />
              运行时配置
            </div>
          </div>
          <div className="panel-body field-stack">
            <label className="field">
              <span>最大生成数量</span>
              <input
                aria-label="最大生成数量"
                className="input"
                min={1}
                max={8}
                type="number"
                value={settings.max_n}
                onChange={(event) =>
                  setSettings({
                    ...settings,
                    max_n: Number(event.currentTarget.value)
                  })
                }
              />
            </label>
            <label className="field">
              <span>最大上传 MB</span>
              <input
                aria-label="最大上传 MB"
                className="input"
                min={1}
                max={100}
                type="number"
                value={settings.max_upload_mb}
                onChange={(event) =>
                  setSettings({
                    ...settings,
                    max_upload_mb: Number(event.currentTarget.value)
                  })
                }
              />
            </label>
            <label className="field">
              <span>最大尺寸层级</span>
              <select
                aria-label="最大尺寸层级"
                className="select"
                value={settings.max_size_tier}
                onChange={(event) =>
                  setSettings({
                    ...settings,
                    max_size_tier: event.currentTarget.value as "2K" | "4K"
                  })
                }
              >
                <option value="2K">2K</option>
                <option value="4K">4K</option>
              </select>
            </label>
            <label className="toggle-row">
              <input
                aria-label="允许 moderation low"
                checked={settings.allow_moderation_low}
                type="checkbox"
                onChange={(event) =>
                  setSettings({
                    ...settings,
                    allow_moderation_low: event.currentTarget.checked
                  })
                }
              />
              允许 moderation=low
            </label>
            <label className="toggle-row">
              <input
                aria-label="启用社区"
                checked={settings.community_enabled}
                type="checkbox"
                onChange={(event) =>
                  setSettings({
                    ...settings,
                    community_enabled: event.currentTarget.checked
                  })
                }
              />
              启用社区
            </label>
            <label className="toggle-row">
              <input
                aria-label="允许公开发布"
                checked={settings.public_publish_enabled}
                type="checkbox"
                onChange={(event) =>
                  setSettings({
                    ...settings,
                    public_publish_enabled: event.currentTarget.checked
                  })
                }
              />
              允许公开发布
            </label>
            <label className="toggle-row">
              <input
                aria-label="启用流式生成"
                checked={settings.stream_enabled}
                type="checkbox"
                onChange={(event) =>
                  setSettings({
                    ...settings,
                    stream_enabled: event.currentTarget.checked
                  })
                }
              />
              启用流式生成
            </label>
            <button className="primary-button" disabled={saveState === "saving"} type="submit">
              <Save size={16} aria-hidden="true" />
              保存运行时配置
            </button>
            {saveState === "saved" ? <p className="settings-note">已保存</p> : null}
            {saveState === "failed" ? (
              <p className="error-message">保存失败，请检查管理员 session。</p>
            ) : null}
          </div>
        </form>

        <section className="admin-panel">
          <div className="panel-header">
            <div className="panel-title">举报列表</div>
          </div>
          <div className="panel-body admin-report-list">
            {reports.length === 0 ? (
              <p className="settings-note">当前没有待处理举报。</p>
            ) : (
              reports.map((report) => (
                <article className="admin-report-item" key={report.report_id}>
                  <div>
                    <strong>{report.work?.title ?? report.work_id}</strong>
                    <p>{report.reason}</p>
                    {report.details ? <p>{report.details}</p> : null}
                  </div>
                  <div className="history-actions">
                    <button
                      className="secondary-button"
                      onClick={() => void moderateWork(report.work_id, "take-down")}
                      type="button"
                    >
                      下架
                    </button>
                    <button
                      className="secondary-button"
                      onClick={() => void moderateWork(report.work_id, "restore")}
                      type="button"
                    >
                      <Undo2 size={15} aria-hidden="true" />
                      恢复
                    </button>
                    <button
                      className="secondary-button"
                      onClick={() => void featureWork(report.work_id, true)}
                      type="button"
                    >
                      <Star size={15} aria-hidden="true" />
                      精选
                    </button>
                  </div>
                </article>
              ))
            )}
          </div>
        </section>

        <section className="admin-panel admin-audit-panel">
          <div className="panel-header">
            <div className="panel-title">审计日志</div>
          </div>
          <div className="panel-body admin-audit-list">
            {auditLogs.length === 0 ? (
              <p className="settings-note">暂无审计日志。</p>
            ) : (
              auditLogs.map((log) => (
                <article className="admin-audit-item" key={log.audit_id}>
                  <strong>{log.action}</strong>
                  <span>{log.target_type} / {log.target_id}</span>
                  <span>{log.request_id}</span>
                </article>
              ))
            )}
          </div>
        </section>
      </section>
    </main>
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
    <article className="admin-metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}

function useAdminSettings(initial: AdminRuntimeSettings) {
  return useState(initial);
}

function useSaveState() {
  return useState<"idle" | "saving" | "saved" | "failed">("idle");
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
