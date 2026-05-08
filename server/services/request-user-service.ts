import { cookies } from "next/headers";
import { lookupDatabaseSession } from "@/server/services/auth-service";
import { getSession, getUser } from "@/server/services/dev-store";
import {
  readSessionIdFromRequest,
  SESSION_COOKIE_NAME
} from "@/server/services/session-service";

export async function getCurrentRequestViewer() {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get(SESSION_COOKIE_NAME)?.value ?? "";
  return resolveViewerFromSessionId(sessionId);
}

export async function getRequestViewer(request: Request) {
  return resolveViewerFromSessionId(readSessionIdFromRequest(request));
}

export async function requireRequestUser(request: Request) {
  const viewer = await getRequestViewer(request);

  if (!viewer.session || !viewer.user) {
    return null;
  }

  return {
    session: viewer.session,
    user: viewer.user,
    isAdmin: viewer.isAdmin
  };
}

async function resolveViewerFromSessionId(sessionId: string) {
  const databaseViewer = await lookupDatabaseSession(sessionId);

  if (databaseViewer.status === "authenticated") {
    return {
      session: databaseViewer.session,
      user: databaseViewer.user,
      isAdmin: databaseViewer.user.role === "admin"
    };
  }

  if (databaseViewer.status === "not_authenticated") {
    return {
      session: null,
      user: null,
      isAdmin: false
    };
  }

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
