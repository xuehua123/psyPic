import { fetchApi, type ApiResult } from "./api-result";
import type { AuthUser } from "./auth-api";

export type SessionBinding = {
  id: string;
  base_url: string;
  default_model: string;
  enabled_models: string[];
};

export type SessionData = {
  authenticated: boolean;
  user: AuthUser | null;
  binding: SessionBinding | null;
  limits: unknown;
  features: unknown;
};

export async function getSession(): Promise<ApiResult<SessionData>> {
  return fetchApi<SessionData>("/api/session");
}
