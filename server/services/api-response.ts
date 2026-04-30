import { randomUUID } from "node:crypto";

export function createRequestId() {
  return `psypic_req_${randomUUID().replaceAll("-", "").slice(0, 24)}`;
}

export function jsonOk(data: unknown, requestId: string, init?: ResponseInit) {
  return Response.json(
    {
      data,
      request_id: requestId
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
}) {
  return Response.json(
    {
      error: {
        code: input.code,
        message: input.message,
        details: input.field ? { field: input.field } : undefined
      },
      request_id: input.requestId
    },
    {
      status: input.status,
      headers: {
        "cache-control": "no-store"
      }
    }
  );
}
