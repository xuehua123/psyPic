import { describe, expect, it } from "vitest";
import {
  createEncryptedKeyBinding,
  decryptKeyBindingSecret,
  redactSensitiveValue
} from "@/server/services/key-binding-service";

describe("key binding service", () => {
  it("encrypts Sub2API keys and can decrypt them server-side", () => {
    const binding = createEncryptedKeyBinding({
      userId: "user_test",
      baseUrl: "https://sub2api.example.com/v1",
      apiKey: "secret-token-value",
      defaultModel: "gpt-image-2"
    });

    expect(binding.id).toMatch(/^kb_/);
    expect(binding.sub2api_api_key_ciphertext).not.toContain(
      "secret-token-value"
    );
    expect(decryptKeyBindingSecret(binding)).toBe("secret-token-value");
  });

  it("redacts sensitive values for logs and diagnostics", () => {
    expect(redactSensitiveValue("Bearer secret-token-value")).toBe("[REDACTED]");
    expect(redactSensitiveValue("psypic_session=sess_secret")).toBe("[REDACTED]");
    expect(redactSensitiveValue("safe metadata")).toBe("safe metadata");
  });
});
