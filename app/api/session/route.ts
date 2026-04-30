import { getKeyBinding, getSession, getUser } from "@/server/services/dev-store";
import { createRequestId, jsonOk } from "@/server/services/api-response";
import { readSessionIdFromRequest } from "@/server/services/session-service";

const anonymousSessionData = {
  authenticated: false,
  user: null,
  binding: null,
  limits: {
    max_n: 1,
    max_upload_mb: 20,
    max_size_tier: "2K"
  },
  features: {
    community: false,
    public_publish: false,
    stream: false
  }
};

export async function GET(request: Request) {
  const requestId = createRequestId();
  const sessionId = readSessionIdFromRequest(request);
  const session = sessionId ? getSession(sessionId) : null;

  if (!session) {
    return jsonOk(anonymousSessionData, requestId);
  }

  const user = getUser(session.user_id);
  const binding = getKeyBinding(session.key_binding_id);

  if (!user || !binding) {
    return jsonOk(anonymousSessionData, requestId);
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
      limits: {
        max_n: binding.limits.max_n,
        max_upload_mb: binding.limits.max_upload_mb,
        max_size_tier: binding.limits.max_size_tier
      },
      features: {
        community: false,
        public_publish: false,
        stream: false
      }
    },
    requestId
  );
}
