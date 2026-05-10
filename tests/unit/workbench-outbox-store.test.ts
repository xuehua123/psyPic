import { describe, expect, it, beforeEach } from "vitest";
import {
  addOutboxOperation,
  listOutboxOperations,
  removeOutboxOperations,
  clearOutbox
} from "@/lib/creator/workbench-outbox-store";
import "fake-indexeddb/auto";

describe("workbench-outbox-store", () => {
  beforeEach(async () => {
    await clearOutbox();
  });

  it("adds and lists outbox operations", async () => {
    const op = {
      client_mutation_id: "mut_1",
      entity: "project" as const,
      action: "upsert" as const,
      data: { id: "proj_1", title: "Test" }
    };

    await addOutboxOperation(op);
    const list = await listOutboxOperations();

    expect(list).toHaveLength(1);
    expect(list[0].client_mutation_id).toBe("mut_1");
    expect(list[0].created_at).toBeDefined();

    await removeOutboxOperations(["mut_1"]);
    const listAfter = await listOutboxOperations();
    expect(listAfter).toHaveLength(0);
  });
});
