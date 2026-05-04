import { cookies } from "next/headers";
import { getSession, getUser } from "@/server/services/dev-store";
import { SESSION_COOKIE_NAME } from "@/server/services/session-service";

export async function getCurrentRequestViewer() {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get(SESSION_COOKIE_NAME)?.value ?? "";
  const session = sessionId ? getSession(sessionId) : null;
  const user = session ? getUser(session.user_id) : null;

  return {
    session,
    user,
    isAdmin: user?.role === "admin"
  };
}

export async function isCurrentRequestAdmin() {
  return (await getCurrentRequestViewer()).isAdmin;
}
