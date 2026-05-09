import { getKeyBinding, getSession, getUser } from "@/server/services/dev-store";
import { createRequestId, jsonError, jsonOk } from "@/server/services/api-response";
import {
  getDatabaseKeyBindingForUser,
  lookupDatabaseSession,
  serializeAuthUser,
  shouldUseDatabaseAuthStore
} from "@/server/services/auth-service";
import {
  getEffectiveImageLimits,
  getRuntimeFeatureFlags
} from "@/server/services/runtime-settings-service";
import { readSessionIdFromRequest } from "@/server/services/session-service";

async function anonymousSessionData() {
  return {
    authenticated: false,
    user: null,
    binding: null,
    limits: await getEffectiveImageLimits(),
    features: await getRuntimeFeatureFlags()
  };
}

export async function GET(request: Request) {
  const requestId = createRequestId();
  const sessionId = readSessionIdFromRequest(request);

  if (sessionId) {
    const databaseViewer = await lookupDatabaseSession(sessionId);

    if (databaseViewer.status === "authenticated") {
      const bindingResult = databaseViewer.session.key_binding_id
        ? await getDatabaseKeyBindingForUser(
            databaseViewer.user.id,
            databaseViewer.session.key_binding_id
          )
        : null;
      const binding =
        bindingResult?.status === "ok" ? bindingResult.binding : null;

      return jsonOk(
        {
          authenticated: true,
          user: serializeAuthUser(databaseViewer.user),
          binding: binding
            ? {
                id: binding.id,
                base_url: binding.sub2api_base_url,
                default_model: binding.default_model,
                enabled_models: binding.enabled_models
              }
            : null,
          limits: await getEffectiveImageLimits(binding?.limits),
          features: await getRuntimeFeatureFlags()
        },
        requestId
      );
    }

    if (
      databaseViewer.status === "unavailable" &&
      shouldUseDatabaseAuthStore()
    ) {
      return jsonError({
        status: 503,
        code: "auth_store_unavailable",
        message: "身份服务暂不可用",
        requestId
      });
    }

    if (
      databaseViewer.status === "not_authenticated" &&
      shouldUseDatabaseAuthStore()
    ) {
      return jsonOk(await anonymousSessionData(), requestId);
    }
  }

  const session = sessionId ? getSession(sessionId) : null;

  if (!session) {
    return jsonOk(await anonymousSessionData(), requestId);
  }

  const user = getUser(session.user_id);
  const binding = getKeyBinding(session.key_binding_id);

  if (!user || !binding) {
    return jsonOk(await anonymousSessionData(), requestId);
  }

  return jsonOk(
    {
      authenticated: true,
      user: {
        id: user.id,
        display_name: user.display_name
      },
      binding: {
        id: binding.id,
        base_url: binding.sub2api_base_url,
        default_model: binding.default_model,
        enabled_models: binding.enabled_models
      },
      limits: await getEffectiveImageLimits(binding.limits),
      features: await getRuntimeFeatureFlags()
    },
    requestId
  );
}
