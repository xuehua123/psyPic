import { createRequestId, jsonError, jsonOk } from "@/server/services/api-response";
import { getSession } from "@/server/services/dev-store";
import { createCommunityReportForUser } from "@/server/services/community-service";
import { readSessionIdFromRequest } from "@/server/services/session-service";

const reportReasons = new Set([
  "privacy",
  "copyright",
  "unsafe",
  "spam",
  "other"
]);

export async function POST(request: Request) {
  const requestId = createRequestId();
  const sessionId = readSessionIdFromRequest(request);
  const session = sessionId ? getSession(sessionId) : null;

  if (!session) {
    return jsonError({
      status: 401,
      code: "unauthorized",
      message: "请先登录后再举报作品",
      requestId
    });
  }

  const parsed = parseReportBody(await request.json().catch(() => null));

  if (!parsed.success) {
    return jsonError({
      status: 400,
      code: "invalid_parameter",
      message: parsed.message,
      field: parsed.field,
      requestId
    });
  }

  const report = createCommunityReportForUser(session.user_id, parsed.data);

  if (!report) {
    return jsonError({
      status: 404,
      code: "not_found",
      message: "作品不存在",
      requestId
    });
  }

  return jsonOk(report, requestId);
}

function parseReportBody(value: unknown):
  | {
      success: true;
      data: { workId: string; reason: string; details: string | null };
    }
  | { success: false; message: string; field: string } {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { success: false, message: "请求体必须是对象", field: "body" };
  }

  const input = value as Record<string, unknown>;

  if (typeof input.work_id !== "string" || !input.work_id.trim()) {
    return { success: false, message: "work_id 不能为空", field: "work_id" };
  }

  if (
    typeof input.reason !== "string" ||
    !reportReasons.has(input.reason.trim())
  ) {
    return {
      success: false,
      message: "reason 必须是 privacy、copyright、unsafe、spam 或 other",
      field: "reason"
    };
  }

  if (
    input.details !== undefined &&
    input.details !== null &&
    typeof input.details !== "string"
  ) {
    return {
      success: false,
      message: "details 必须是字符串",
      field: "details"
    };
  }

  return {
    success: true,
    data: {
      workId: input.work_id.trim(),
      reason: input.reason.trim(),
      details: typeof input.details === "string" ? input.details : null
    }
  };
}
