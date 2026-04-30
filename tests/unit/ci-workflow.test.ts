import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("GitHub Actions CI", () => {
  it("runs the same quality gates used locally", () => {
    const workflow = readFileSync(".github/workflows/ci.yml", "utf8");

    for (const command of [
      "pnpm lint",
      "pnpm typecheck",
      "pnpm test",
      "pnpm build",
      "pnpm prisma validate"
    ]) {
      expect(workflow).toContain(command);
    }

    expect(workflow).toContain("DATABASE_URL");
    expect(workflow).toContain("package-manager-cache: false");
    expect(workflow).toContain("corepack prepare pnpm@10.30.2 --activate");
    expect(workflow).not.toContain("pnpm/action-setup");
  });
});
