import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("Prisma v0.2 data model", () => {
  it("defines the foundation models required by the MVP plan", () => {
    const schema = readFileSync("prisma/schema.prisma", "utf8");

    for (const model of ["User", "Session", "KeyBinding", "AuditLog"]) {
      expect(schema).toContain(`model ${model}`);
    }

    expect(schema).toContain("sub2apiApiKeyCiphertext");
    expect(schema).toContain("requestId");
  });
});
