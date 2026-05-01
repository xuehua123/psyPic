import { getKeyBinding, getSession, getUser } from "@/server/services/dev-store";
import { createRequestId, jsonOk } from "@/server/services/api-response";
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
