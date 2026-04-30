import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import ApiSettingsForm from "@/components/settings/ApiSettingsForm";

describe("ApiSettingsForm", () => {
  it("keeps manual API key drafts out of long-term browser storage", async () => {
    const localStorageSpy = vi.spyOn(Storage.prototype, "setItem");
    const sessionStorageSpy = vi.spyOn(window.sessionStorage, "setItem");
    const indexedDbOpenSpy = vi.fn();
    Object.defineProperty(window, "indexedDB", {
      configurable: true,
      value: { open: indexedDbOpenSpy }
    });

    render(<ApiSettingsForm />);

    const user = userEvent.setup();
    await user.type(
      screen.getByLabelText("Sub2API Base URL"),
      "https://sub2api.example.com/v1"
    );
    await user.type(screen.getByLabelText("API Key"), "secret-token-value");

    expect(localStorageSpy).not.toHaveBeenCalledWith(
      expect.any(String),
      expect.stringContaining("secret-token-value")
    );
    expect(sessionStorageSpy).not.toHaveBeenCalledWith(
      expect.any(String),
      expect.stringContaining("secret-token-value")
    );
    expect(indexedDbOpenSpy).not.toHaveBeenCalled();
  });

  it("submits manual key drafts only to the BFF binding endpoint", async () => {
    const fetchSpy = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ data: { session_bound: true } }), {
        status: 200,
        headers: { "content-type": "application/json" }
      })
    );
    vi.stubGlobal("fetch", fetchSpy);

    render(<ApiSettingsForm />);

    const user = userEvent.setup();
    await user.type(
      screen.getByLabelText("Sub2API Base URL"),
      "https://sub2api.example.com/v1"
    );
    await user.type(screen.getByLabelText("API Key"), "secret-token-value");
    await user.click(screen.getByRole("button", { name: /保存到 BFF/ }));

    await waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(1));
    expect(fetchSpy).toHaveBeenCalledWith(
      "/api/settings/manual-key",
      expect.objectContaining({
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          base_url: "https://sub2api.example.com/v1",
          api_key: "secret-token-value",
          default_model: "gpt-image-2"
        })
      })
    );
  });
});
