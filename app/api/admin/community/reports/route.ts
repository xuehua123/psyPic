import { createRequestId, jsonError, jsonOk } from "@/server/services/api-response";
import { resolveAdminUser } from "@/server/services/admin-auth-service";
import {
  listCommunityReportsForAdmin,
  type CommunityReportStatus
} from "@/server/services/community-service";

const reportStatuses = new Set(["open", "reviewed", "dismissed", "all"]);

export async function GET(request: Request) {
  const requestId = createRequestId();
  const admin = resolveAdminUser(request);

  if (admin.status !== "ok") {
    return adminError(admin.status, requestId);
  }

  const url = new URL(request.url);
  const status = parseStatus(url.searchParams.get("status"));

  if (!status) {
    return jsonError({
      status: 400,
      code: "invalid_parameter",
      message: "status 必须是 open、reviewed、dismissed 或 all",
      field: "status",
      requestId
    });
  }

  const limit = Number.parseInt(url.searchParams.get("limit") ?? "", 10);
  const reports = listCommunityReportsForAdmin({
    status,
    cursor: url.searchParams.get("cursor"),
    limit
  });

  return jsonOk(
    {
      items: reports.items,
      next_cursor: reports.nextCursor
    },
    requestId
  );
}

function parseStatus(value: string | null) {
  const status = value?.trim() || "open";

  if (!reportStatuses.has(status)) {
    return null;
  }

  return status as CommunityReportStatus | "all";
}

function adminError(status: "unauthorized" | "forbidden", requestId: string) {
  return jsonError({
    status: status === "unauthorized" ? 401 : 403,
    code: status,
    message: status === "unauthorized" ? "请先登录管理员账号" : "需要管理员权限",
    requestId
  });
}
