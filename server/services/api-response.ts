import { randomUUID } from "node:crypto";

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
      data,
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
        message: input.message,
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
