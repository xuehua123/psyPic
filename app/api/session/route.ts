import { getKeyBinding, getSession, getUser } from "@/server/services/dev-store";
import { createRequestId, jsonOk } from "@/server/services/api-response";
import {
  getEffectiveImageLimits,
  getRuntimeFeatureFlags
} from "@/server/services/runtime-settings-service";
import { readSessionIdFromRequest } from "@/server/services/session-service";

function anonymousSessionData() {
  return {
    authenticated: false,
    user: null,
    binding: null,
    limits: getEffectiveImageLimits(),
    features: getRuntimeFeatureFlags()
  };
}

export async function GET(request: Request) {
  const requestId = createRequestId();
  const sessionId = readSessionIdFromRequest(request);
  const session = sessionId ? getSession(sessionId) : null;

  if (!session) {
    return jsonOk(anonymousSessionData(), requestId);
  }

  const user = getUser(session.user_id);
  const binding = getKeyBinding(session.key_binding_id);

  if (!user || !binding) {
    return jsonOk(anonymousSessionData(), requestId);
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
      limits: getEffectiveImageLimits(binding.limits),
      features: getRuntimeFeatureFlags()
    },
    requestId
  );
}
