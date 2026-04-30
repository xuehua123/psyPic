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

    expect(workflow).toContain("pnpm/action-setup");
    expect(workflow).toContain("DATABASE_URL");
  });
});
