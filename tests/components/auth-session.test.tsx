import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { SessionProvider } from "@/components/auth/SessionProvider";
import { SessionGate } from "@/components/auth/SessionGate";

const mockGetSession = vi.hoisted(() => vi.fn());
const mockLogin = vi.hoisted(() => vi.fn());
const mockRegister = vi.hoisted(() => vi.fn());
const mockLogout = vi.hoisted(() => vi.fn());

vi.mock("@/lib/client/session-api", () => ({
  getSession: mockGetSession
}));

vi.mock("@/lib/client/auth-api", () => ({
  login: mockLogin,
  register: mockRegister,
  logout: mockLogout
}));

describe("SessionGate and Auth Shell", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows login button when unauthenticated", async () => {
    mockGetSession.mockResolvedValue({
      success: true,
      data: { authenticated: false, user: null, binding: null, limits: null, features: null }
    });

    render(
      <SessionProvider>
        <SessionGate />
      </SessionProvider>
    );

    await waitFor(() => {
      expect(screen.getByText("未登录")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "登录 / 注册" })).toBeInTheDocument();
    });
  });

  it("shows user info and logout button when authenticated", async () => {
    mockGetSession.mockResolvedValue({
      success: true,
      data: {
        authenticated: true,
        user: { display_name: "Test User" },
        binding: null,
        limits: null,
        features: null
      }
    });

    render(
      <SessionProvider>
        <SessionGate />
      </SessionProvider>
    );

    await waitFor(() => {
      expect(screen.getByText("Test User")).toBeInTheDocument();
      expect(screen.getByText("未绑定 API Key")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "登出" })).toBeInTheDocument();
    });
  });

  it("shows offline fallback notice when auth store is unavailable", async () => {
    mockGetSession.mockResolvedValue({
      success: false,
      error: { code: "auth_store_unavailable", message: "Unavailable" }
    });

    render(
      <SessionProvider>
        <SessionGate />
      </SessionProvider>
    );

    await waitFor(() => {
      expect(screen.getByText("本地离线模式 (服务不可用)")).toBeInTheDocument();
    });
  });

  it("handles login flow and refreshes session", async () => {
    mockGetSession.mockResolvedValueOnce({
      success: true,
      data: { authenticated: false, user: null, binding: null, limits: null, features: null }
    });
    mockLogin.mockResolvedValue({ success: true, data: {} });
    mockGetSession.mockResolvedValueOnce({
      success: true,
      data: {
        authenticated: true,
        user: { display_name: "New User" },
        binding: null,
        limits: null,
        features: null
      }
    });

    render(
      <SessionProvider>
        <SessionGate />
      </SessionProvider>
    );

    const user = userEvent.setup();
    await waitFor(() => screen.getByRole("button", { name: "登录 / 注册" }));
    await user.click(screen.getByRole("button", { name: "登录 / 注册" }));
    
    // In dialog
    const emailInput = screen.getByLabelText("邮箱");
    const passwordInput = screen.getByLabelText("密码");
    await user.type(emailInput, "test@example.com");
    await user.type(passwordInput, "password");
    await user.click(screen.getByRole("button", { name: "登录" }));

    expect(mockLogin).toHaveBeenCalledWith("test@example.com", "password");
    await waitFor(() => {
      expect(mockGetSession).toHaveBeenCalledTimes(2);
      expect(screen.getByText("New User")).toBeInTheDocument();
    });
  });

  it("handles logout and clears session", async () => {
    mockGetSession.mockResolvedValueOnce({
      success: true,
      data: {
        authenticated: true,
        user: { display_name: "Test User" },
        binding: null,
        limits: null,
        features: null
      }
    });
    mockLogout.mockResolvedValue({ success: true });
    mockGetSession.mockResolvedValueOnce({
      success: true,
      data: { authenticated: false, user: null, binding: null, limits: null, features: null }
    });

    render(
      <SessionProvider>
        <SessionGate />
      </SessionProvider>
    );

    const user = userEvent.setup();
    await waitFor(() => screen.getByRole("button", { name: "登出" }));
    await user.click(screen.getByRole("button", { name: "登出" }));

    expect(mockLogout).toHaveBeenCalled();
    await waitFor(() => {
      expect(screen.getByText("未登录")).toBeInTheDocument();
    });
  });
});
