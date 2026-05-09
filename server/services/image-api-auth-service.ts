import {
  getDatabaseKeyBindingForUser,
  lookupDatabaseSession,
  shouldUseDatabaseAuthStore,
  type AuthSession
} from "@/server/services/auth-service";
import { getKeyBinding, getSession } from "@/server/services/dev-store";
import type { KeyBinding } from "@/server/services/key-binding-service";
import type { PsyPicSession } from "@/server/services/session-service";
import { readSessionIdFromRequest } from "@/server/services/session-service";

export type ImageApiAuthResult =
  | {
      status: "authenticated";
      session: AuthSession | PsyPicSession;
      binding: KeyBinding;
    }
  | { status: "unauthorized" }
  | { status: "forbidden" }
  | { status: "auth_store_unavailable" };

export async function resolveImageApiAuth(
  request: Request
): Promise<ImageApiAuthResult> {
  const sessionId = readSessionIdFromRequest(request);

  if (!sessionId) {
    return { status: "unauthorized" };
  }

  const databaseViewer = await lookupDatabaseSession(sessionId);
  if (databaseViewer.status === "authenticated") {
    if (!databaseViewer.session.key_binding_id) {
      return { status: "forbidden" };
    }

    const binding = await getDatabaseKeyBindingForUser(
      databaseViewer.user.id,
      databaseViewer.session.key_binding_id
    );

    if (binding.status === "unavailable") {
      return { status: "auth_store_unavailable" };
    }

    if (binding.status !== "ok" || binding.binding.status !== "active") {
      return { status: "forbidden" };
    }

    return {
      status: "authenticated",
      session: databaseViewer.session,
      binding: binding.binding
    };
  }

  if (shouldUseDatabaseAuthStore()) {
    return databaseViewer.status === "unavailable"
      ? { status: "auth_store_unavailable" }
      : { status: "unauthorized" };
  }

  const session = getSession(sessionId);

  if (!session) {
    return { status: "unauthorized" };
  }

  const binding = getKeyBinding(session.key_binding_id);

  if (!binding || binding.status !== "active") {
    return { status: "forbidden" };
  }

  return {
    status: "authenticated",
    session,
    binding
  };
}
