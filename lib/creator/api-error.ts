/**
 * 生成 / 任务 API 错误响应格式化。纯函数。
 */

import type {
  ApiGenerationResponse,
  ApiTaskResponse
} from "@/lib/creator/types";

export function formatApiError(body: ApiGenerationResponse): string {
  const message = body.error?.message ?? "生成失败，请稍后重试。";
  const requestIds = [
    body.request_id ? `request_id: ${body.request_id}` : "",
    body.upstream_request_id
      ? `upstream_request_id: ${body.upstream_request_id}`
      : ""
  ].filter(Boolean);

  if (requestIds.length === 0) {
    return message;
  }

  return `${message}（${requestIds.join(" · ")}）`;
}

export function formatTaskError(body: ApiTaskResponse): string {
  const message = body.error?.message ?? "任务操作失败，请稍后重试。";
  const requestIds = [
    body.request_id ? `request_id: ${body.request_id}` : "",
    body.upstream_request_id
      ? `upstream_request_id: ${body.upstream_request_id}`
      : ""
  ].filter(Boolean);

  return requestIds.length > 0
    ? `${message}（${requestIds.join(" · ")}）`
    : message;
}
