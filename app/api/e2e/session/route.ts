import { createRequestId, jsonError, jsonOk } from "@/server/services/api-response";
import {
  createAdminSessionForDev,
  createManualKeySession
} from "@/server/services/dev-store";
import { buildSessionCookie } from "@/server/services/session-service";

type E2ESessionRole = "admin" | "user";

export async function POST(request: Request) {
  const requestId = createRequestId();
  const token = process.env.PSYPIC_E2E_TOKEN;

  if (
    process.env.NODE_ENV === "production" ||
    !token ||
    request.headers.get("x-psypic-e2e-token") !== token
  ) {
    return jsonError({
      status: 404,
      code: "not_found",
      message: "Not found",
      requestId
    });
  }

  const body = (await request.json().catch(() => ({}))) as Record<
    string,
    unknown
  >;
  const role = parseRole(body.role);

  if (!role) {
    return jsonError({
      status: 400,
      code: "invalid_parameter",
      message: "role 必须是 admin 或 user",
      field: "role",
      requestId
    });
  }

  const bound =
    role === "admin"
      ? createAdminSessionForDev()
      : createManualKeySession({
          baseUrl:
            typeof body.base_url === "string" && body.base_url.trim()
              ? body.base_url
              : "https://sub2api.example.com/v1",
          apiKey:
            typeof body.api_key === "string" && body.api_key.trim()
              ? body.api_key
              : "e2e-placeholder-key",
          defaultModel: "gpt-image-2"
        });

  return jsonOk(
    {
      session_bound: true,
      session_id: bound.session.id,
      user_id: bound.user.id,
      role: bound.user.role
    },
    requestId,
    {
      headers: {
        "set-cookie": buildSessionCookie(bound.session.id)
      }
    }
  );
}

function parseRole(value: unknown): E2ESessionRole | null {
  if (value === "admin" || value === "user") {
    return value;
  }

  return null;
}
