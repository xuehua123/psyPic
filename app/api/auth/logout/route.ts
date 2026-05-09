import { createHash } from "node:crypto";
import { revokeSession as revokeDatabaseSession } from "@/server/services/auth-service";
import { recordAuditLog } from "@/server/services/audit-log-service";
import { revokeSession as revokeDevSession } from "@/server/services/dev-store";
import { createRequestId, jsonOk } from "@/server/services/api-response";
import { getRequestViewer } from "@/server/services/request-user-service";
import {
  buildExpiredSessionCookie,
  readSessionIdFromRequest
} from "@/server/services/session-service";

export async function POST(request: Request) {
  const requestId = createRequestId();
  const sessionId = readSessionIdFromRequest(request);
  const viewer = sessionId ? await getRequestViewer(request) : null;

  if (sessionId) {
    await revokeDatabaseSession(sessionId);
    revokeDevSession(sessionId);
    await recordAuditLog({
      actorUserId: viewer?.user?.id ?? null,
      action: "auth.logout",
      targetType: "session",
      targetId: hashSessionAuditRef(sessionId),
      requestId,
      metadata: {}
    }).catch(() => undefined);
  }

  return jsonOk(
    {
      logged_out: true
    },
    requestId,
    {
      headers: {
        "set-cookie": buildExpiredSessionCookie()
      }
    }
  );
}

function hashSessionAuditRef(sessionId: string) {
  return `session_sha256_${createHash("sha256")
    .update(sessionId)
    .digest("hex")
    .slice(0, 16)}`;
}
