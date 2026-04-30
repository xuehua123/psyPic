import { createId } from "@/server/services/key-binding-service";

export const SESSION_COOKIE_NAME = "psypic_session";

export type PsyPicSession = {
  id: string;
  user_id: string;
  key_binding_id: string;
  expires_at: string;
  created_at: string;
  last_seen_at: string;
  revoked_at?: string;
};

export function createSession(userId: string, keyBindingId: string): PsyPicSession {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  return {
    id: createId("sess"),
    user_id: userId,
    key_binding_id: keyBindingId,
    expires_at: expiresAt.toISOString(),
    created_at: now.toISOString(),
    last_seen_at: now.toISOString()
  };
}

export function readSessionIdFromRequest(request: Request) {
  const cookieHeader = request.headers.get("cookie") ?? "";
  const cookies = cookieHeader
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean);
  const sessionCookie = cookies.find((cookie) =>
    cookie.startsWith(`${SESSION_COOKIE_NAME}=`)
  );

  return sessionCookie?.slice(`${SESSION_COOKIE_NAME}=`.length) ?? "";
}

export function buildSessionCookie(sessionId: string) {
  return [
    `${SESSION_COOKIE_NAME}=${encodeURIComponent(sessionId)}`,
    "HttpOnly",
    "Secure",
    "SameSite=Lax",
    "Path=/",
    "Max-Age=2592000"
  ].join("; ");
}

export function buildExpiredSessionCookie() {
  return [
    `${SESSION_COOKIE_NAME}=`,
    "HttpOnly",
    "Secure",
    "SameSite=Lax",
    "Path=/",
    "Max-Age=0"
  ].join("; ");
}
