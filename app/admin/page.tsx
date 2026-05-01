import { cookies } from "next/headers";
import AdminDashboardPage from "@/components/admin/AdminDashboardPage";
import { listAuditLogs } from "@/server/services/audit-log-service";
import { listCommunityReportsForAdmin } from "@/server/services/community-service";
import { getSession, getUser } from "@/server/services/dev-store";
import { summarizeImageUsageForUser } from "@/server/services/image-task-service";
import { getRuntimeSettings } from "@/server/services/runtime-settings-service";
import { SESSION_COOKIE_NAME } from "@/server/services/session-service";

export default async function AdminPage() {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get(SESSION_COOKIE_NAME)?.value ?? "";
  const session = sessionId ? getSession(sessionId) : null;
  const user = session ? getUser(session.user_id) : null;

  if (!session || !user || user.role !== "admin") {
    return (
      <main className="admin-shell">
        <section className="community-empty" role="alert">
          <h1>需要管理员权限</h1>
          <p>请使用管理员 session 后再访问管理端。</p>
        </section>
      </main>
    );
  }

  const reports = listCommunityReportsForAdmin({ status: "open", limit: 30 });
  const auditLogs = await listAuditLogs({ limit: 30 });

  return (
    <AdminDashboardPage
      auditLogs={auditLogs.items}
      reports={reports.items}
      runtimeSettings={await getRuntimeSettings()}
      usage={summarizeImageUsageForUser(user.id)}
    />
  );
}
