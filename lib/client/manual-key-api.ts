import { fetchApi, type ApiResult } from "./api-result";

export type ManualKeyBindingResponse = {
  session_bound: boolean;
  binding_id: string;
  base_url: string;
  default_model: string;
  enabled_models: string[];
  limits: unknown;
};

export async function bindManualKey(
  baseUrl: string,
  apiKey: string,
  defaultModel: string
): Promise<ApiResult<ManualKeyBindingResponse>> {
  return fetchApi<ManualKeyBindingResponse>("/api/settings/manual-key", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      base_url: baseUrl,
      api_key: apiKey,
      default_model: defaultModel
    })
  });
}
