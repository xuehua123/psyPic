import { fetchApi, type ApiResult } from "./api-result";

export type AuthUser = {
  id: string;
  email: string | null;
  display_name: string | null;
  role: "user" | "admin";
  last_login_at: string | null;
};

export type AuthLoginResponse = {
  authenticated: true;
  user: AuthUser;
};

export async function login(
  email: string,
  password: string
): Promise<ApiResult<AuthLoginResponse>> {
  return fetchApi<AuthLoginResponse>("/api/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password })
  });
}

export async function register(
  email: string,
  password: string,
  displayName: string
): Promise<ApiResult<AuthLoginResponse>> {
  return fetchApi<AuthLoginResponse>("/api/auth/register", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password, display_name: displayName })
  });
}

export async function logout(): Promise<ApiResult<{ logged_out: true }>> {
  return fetchApi<{ logged_out: true }>("/api/auth/logout", {
    method: "POST"
  });
}
