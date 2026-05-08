import { revokeSession as revokeDatabaseSession } from "@/server/services/auth-service";
import { revokeSession as revokeDevSession } from "@/server/services/dev-store";
import { createRequestId, jsonOk } from "@/server/services/api-response";
import {
  buildExpiredSessionCookie,
  readSessionIdFromRequest
} from "@/server/services/session-service";

export async function POST(request: Request) {
  const requestId = createRequestId();
  const sessionId = readSessionIdFromRequest(request);

  if (sessionId) {
    await revokeDatabaseSession(sessionId);
    revokeDevSession(sessionId);
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
