export type ApiResult<T> =
  | { success: true; data: T; requestId: string }
  | {
      success: false;
      error: { code: string; message: string; details?: unknown };
      requestId?: string;
    };

export async function fetchApi<T>(
  url: string,
  options?: RequestInit
): Promise<ApiResult<T>> {
  try {
    const response = await fetch(url, options);
    const body = await response.json().catch(() => null);

    if (!response.ok || !body || body.error) {
      return {
        success: false,
        error: {
          code: body?.error?.code ?? `http_${response.status}`,
          message: body?.error?.message ?? "请求失败",
          details: body?.error?.details
        },
        requestId: body?.request_id
      };
    }

    return {
      success: true,
      data: body.data as T,
      requestId: body.request_id ?? ""
    };
  } catch {
    return {
      success: false,
      error: { code: "network_error", message: "网络错误，请检查网络连接。" }
    };
  }
}
