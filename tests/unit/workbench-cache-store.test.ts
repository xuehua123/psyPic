import { describe, expect, it, beforeEach } from "vitest";
import {
  saveCachedProject,
  listCachedProjects,
  clearWorkbenchCache
} from "@/lib/creator/workbench-cache-store";
import "fake-indexeddb/auto";

describe("workbench-cache-store", () => {
  beforeEach(async () => {
    await clearWorkbenchCache();
  });

  it("saves and lists projects correctly", async () => {
    const proj = {
      id: "proj_1",
      user_id: "u1",
      title: "Title",
      sort_order: 0,
      collapsed: false,
      active_session_id: null,
      created_at: "2024-01-01T00:00:00Z",
      updated_at: "2024-01-01T00:00:00Z",
      deleted_at: null
    };

    await saveCachedProject(proj);
    const list = await listCachedProjects();

    expect(list).toHaveLength(1);
    expect(list[0]).toEqual(proj);
  });
});
