import { getSession, getUser } from "@/server/services/dev-store";
import { readSessionIdFromRequest } from "@/server/services/session-service";

export function resolveAdminUser(request: Request) {
  const sessionId = readSessionIdFromRequest(request);
  const session = sessionId ? getSession(sessionId) : null;
  const user = session ? getUser(session.user_id) : null;

  if (!session || !user) {
    return { status: "unauthorized" as const };
  }

  if (user.role !== "admin") {
    return { status: "forbidden" as const };
  }

  return {
    status: "ok" as const,
    session,
    user
  };
}
