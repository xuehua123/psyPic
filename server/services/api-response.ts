import { randomUUID } from "node:crypto";
import { redactSensitiveValue } from "@/server/services/key-binding-service";

export function createRequestId() {
  return `psypic_req_${randomUUID().replaceAll("-", "").slice(0, 24)}`;
}

export function jsonOk(
  data: unknown,
  requestId: string,
  init?: ResponseInit & { upstreamRequestId?: string }
) {
  return Response.json(
    {
      data: redactApiResponsePayload(data),
      request_id: requestId,
      ...(init?.upstreamRequestId
        ? { upstream_request_id: init.upstreamRequestId }
        : {})
    },
    {
      ...init,
      headers: {
        "cache-control": "no-store",
        ...(init?.headers ?? {})
      }
    }
  );
}

export function jsonError(input: {
  status: number;
  code: string;
  message: string;
  requestId: string;
  field?: string;
  upstreamRequestId?: string;
}) {
  return Response.json(
    {
      error: {
        code: input.code,
        message: redactSensitiveValue(input.message),
        details: input.field ? { field: input.field } : undefined
      },
      request_id: input.requestId,
      ...(input.upstreamRequestId
        ? { upstream_request_id: input.upstreamRequestId }
        : {})
    },
    {
      status: input.status,
      headers: {
        "cache-control": "no-store"
      }
    }
  );
}

function redactApiResponsePayload(value: unknown): unknown {
  if (typeof value === "string") {
    return redactSensitiveValue(value);
  }

  if (Array.isArray(value)) {
    return value.map(redactApiResponsePayload);
  }

  if (!value || typeof value !== "object") {
    return value;
  }

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, item]) => [
      key,
      isSensitiveResponseKey(key) ? "[REDACTED]" : redactApiResponsePayload(item)
    ])
  );
}

function isSensitiveResponseKey(key: string) {
  return /authorization|bearer|api[_-]?key|(?:access|refresh|auth|session|secret)[_-]?token|secret|cookie|psypic_session|password|ciphertext/i.test(
    key
  );
}
