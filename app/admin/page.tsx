import AppShell from "@/components/layout/AppShell";
import AdminDashboardPage from "@/components/admin/AdminDashboardPage";
import { listAuditLogs } from "@/server/services/audit-log-service";
import { listCommunityReportsForAdmin } from "@/server/services/community-service";
import { summarizeImageUsageForUser } from "@/server/services/image-task-service";
import { getCurrentRequestViewer } from "@/server/services/request-user-service";
import { getRuntimeSettings } from "@/server/services/runtime-settings-service";

export default async function AdminPage() {
  const viewer = await getCurrentRequestViewer();
  const session = viewer.session;
  const user = viewer.user;

  if (!session || !user || !viewer.isAdmin) {
    return (
      <AppShell bodyClassName="product-page-body" currentPath="/admin">
        <main className="admin-shell">
          <section className="community-empty" role="alert">
            <h1>需要管理员权限</h1>
            <p>请使用管理员 session 后再访问管理端。</p>
          </section>
        </main>
      </AppShell>
    );
  }

  const reports = await listCommunityReportsForAdmin({ status: "open", limit: 30 });
  const auditLogs = await listAuditLogs({ limit: 30 });

  return (
    <AdminDashboardPage
      auditLogs={auditLogs.items}
      reports={reports.items}
      runtimeSettings={await getRuntimeSettings()}
      usage={await summarizeImageUsageForUser(user.id)}
    />
  );
}
