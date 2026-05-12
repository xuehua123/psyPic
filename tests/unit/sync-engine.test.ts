import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  flushOutbox,
  pullChanges,
  dismissConflict,
  type SyncEngineDeps
} from "@/lib/creator/sync/sync-engine";
import type { SyncState } from "@/lib/creator/sync/sync-types";
import { INITIAL_SYNC_STATE, MAX_FLUSH_BATCH_SIZE } from "@/lib/creator/sync/sync-types";

function makeDeps(overrides?: Partial<SyncEngineDeps>): SyncEngineDeps {
  return {
    listOutboxOperations: vi.fn().mockResolvedValue([]),
    removeOutboxOperations: vi.fn().mockResolvedValue(undefined),
    pushWorkbenchChanges: vi.fn().mockResolvedValue({
      success: true,
      data: { push_results: [], pulled: null }
    }),
    pullWorkbenchChanges: vi.fn().mockResolvedValue({
      success: true,
      data: { projects: [], sessions: [], version_nodes: [] }
    }),
    applyCacheTombstones: vi.fn().mockResolvedValue(undefined),
    savePulledData: vi.fn().mockResolvedValue(undefined),
    ...overrides
  };
}

function makeOutboxOp(id: string, entity = "project" as const, action = "upsert" as const) {
  return {
    client_mutation_id: id,
    entity,
    action,
    data: { id: `${entity}_${id}`, title: "Test" },
    created_at: new Date().toISOString()
  };
}

describe("sync-engine: flushOutbox", () => {
  let state: SyncState;

  beforeEach(() => {
    state = { ...INITIAL_SYNC_STATE };
  });

  it("returns synced when outbox is empty", async () => {
    const deps = makeDeps();
    const result = await flushOutbox(state, deps);

    expect(result.status).toBe("synced");
    expect(result.pendingCount).toBe(0);
    expect(deps.pushWorkbenchChanges).not.toHaveBeenCalled();
  });

  it("clears applied mutations from outbox after successful push", async () => {
    const deps = makeDeps({
      listOutboxOperations: vi.fn().mockResolvedValue([
        makeOutboxOp("mut_1"),
        makeOutboxOp("mut_2")
      ]),
      pushWorkbenchChanges: vi.fn().mockResolvedValue({
        success: true,
        data: {
          push_results: [
            { client_mutation_id: "mut_1", status: "applied", entity: "project", id: "proj_1" },
            { client_mutation_id: "mut_2", status: "replayed", entity: "project", id: "proj_2" }
          ],
          pulled: null
        }
      })
    });

    const result = await flushOutbox(state, deps);

    expect(result.status).toBe("synced");
    expect(result.pendingCount).toBe(0);
    expect(deps.removeOutboxOperations).toHaveBeenCalledWith(["mut_1", "mut_2"]);
  });

  it("enters offline status on 503 without losing outbox", async () => {
    const deps = makeDeps({
      listOutboxOperations: vi.fn().mockResolvedValue([makeOutboxOp("mut_1")]),
      pushWorkbenchChanges: vi.fn().mockResolvedValue({
        success: false,
        error: { code: "workbench_store_unavailable", message: "unavailable" },
        retryAfter: "30"
      })
    });

    const result = await flushOutbox(state, deps);

    expect(result.status).toBe("offline");
    expect(result.pendingCount).toBe(1);
    expect(result.retryAfter).toBe("30");
    // outbox 不被清理
    expect(deps.removeOutboxOperations).not.toHaveBeenCalled();
  });

  it("enters offline status on network error", async () => {
    const deps = makeDeps({
      listOutboxOperations: vi.fn().mockResolvedValue([makeOutboxOp("mut_1")]),
      pushWorkbenchChanges: vi.fn().mockRejectedValue(new Error("network"))
    });

    const result = await flushOutbox(state, deps);

    expect(result.status).toBe("offline");
    expect(result.pendingCount).toBe(1);
  });

  it("enters needs_attention on 401/403 instead of offline", async () => {
    const deps = makeDeps({
      listOutboxOperations: vi.fn().mockResolvedValue([makeOutboxOp("mut_1")]),
      pushWorkbenchChanges: vi.fn().mockResolvedValue({
        success: false,
        error: { code: "unauthorized", message: "请先登录" }
      })
    });

    const result = await flushOutbox(state, deps);

    expect(result.status).toBe("needs_attention");
    expect(result.pendingCount).toBe(1);
    // 不把 401 当 offline 成功
    expect(deps.removeOutboxOperations).not.toHaveBeenCalled();
  });

  it("records conflicts from push results as needs_attention", async () => {
    const deps = makeDeps({
      listOutboxOperations: vi.fn().mockResolvedValue([makeOutboxOp("mut_conflict")]),
      pushWorkbenchChanges: vi.fn().mockResolvedValue({
        success: true,
        data: {
          push_results: [
            {
              client_mutation_id: "mut_conflict",
              status: "conflict",
              entity: "project",
              id: "proj_conflict",
              server_record: { id: "proj_conflict", title: "Server wins" }
            }
          ],
          pulled: null
        }
      })
    });

    const result = await flushOutbox(state, deps);

    expect(result.status).toBe("needs_attention");
    expect(result.conflicts).toHaveLength(1);
    expect(result.conflicts[0].clientMutationId).toBe("mut_conflict");
    expect(result.conflicts[0].serverRecord).toEqual({ id: "proj_conflict", title: "Server wins" });
    // conflict 不从 outbox 清除
    expect(deps.removeOutboxOperations).not.toHaveBeenCalledWith(
      expect.arrayContaining(["mut_conflict"])
    );
  });

  it("applies tombstones from pull response to cache", async () => {
    const deps = makeDeps({
      listOutboxOperations: vi.fn().mockResolvedValue([makeOutboxOp("mut_1")]),
      pushWorkbenchChanges: vi.fn().mockResolvedValue({
        success: true,
        data: {
          push_results: [
            { client_mutation_id: "mut_1", status: "applied", entity: "project", id: "proj_1" }
          ],
          pulled: {
            projects: [
              { id: "proj_deleted", deleted_at: "2024-01-01T00:00:00Z", user_id: "u1", title: "Del", sort_order: 0, collapsed: false, active_session_id: null, created_at: "2024-01-01T00:00:00Z", updated_at: "2024-01-01T00:00:00Z" }
            ],
            sessions: [
              { id: "sess_deleted", deleted_at: "2024-01-01T00:00:00Z", project_id: "proj_deleted", title: "Del", fork_parent_version_node_id: null, active_version_node_id: null, custom_label: null, is_pinned: false, is_archived: false, last_read_at: null, created_at: "2024-01-01T00:00:00Z", updated_at: "2024-01-01T00:00:00Z" }
            ],
            version_nodes: []
          }
        }
      })
    });

    const result = await flushOutbox(state, deps);

    expect(deps.applyCacheTombstones).toHaveBeenCalledWith({
      deletedProjectIds: ["proj_deleted"],
      deletedSessionIds: ["sess_deleted"],
      deletedVersionNodeIds: []
    });
    expect(result.status).toBe("synced");
  });

  it("respects MAX_FLUSH_BATCH_SIZE", async () => {
    const ops = Array.from({ length: 30 }, (_, i) => makeOutboxOp(`mut_${i}`));
    const deps = makeDeps({
      listOutboxOperations: vi.fn().mockResolvedValue(ops),
      pushWorkbenchChanges: vi.fn().mockResolvedValue({
        success: true,
        data: {
          push_results: ops.slice(0, MAX_FLUSH_BATCH_SIZE).map((op) => ({
            client_mutation_id: op.client_mutation_id,
            status: "applied" as const,
            entity: "project" as const,
            id: `proj_${op.client_mutation_id}`
          })),
          pulled: null
        }
      })
    });

    await flushOutbox(state, deps);

    // push 只发了 MAX_FLUSH_BATCH_SIZE 个
    const pushCall = (deps.pushWorkbenchChanges as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(pushCall.operations).toHaveLength(MAX_FLUSH_BATCH_SIZE);
  });

  it("shows offline when remaining > 0 after bounded batch", async () => {
    const ops = Array.from({ length: 30 }, (_, i) => makeOutboxOp(`mut_${i}`));
    const deps = makeDeps({
      listOutboxOperations: vi.fn().mockResolvedValue(ops),
      pushWorkbenchChanges: vi.fn().mockResolvedValue({
        success: true,
        data: {
          push_results: ops.slice(0, MAX_FLUSH_BATCH_SIZE).map((op) => ({
            client_mutation_id: op.client_mutation_id,
            status: "applied" as const,
            entity: "project" as const,
            id: `proj_${op.client_mutation_id}`
          })),
          pulled: null
        }
      })
    });

    const result = await flushOutbox(state, deps);

    // 剩余 5 个未推送 → 不能显示 synced
    expect(result.pendingCount).toBe(5);
    expect(result.status).toBe("offline");
  });

  it("enters needs_attention on non-auth error results without clearing outbox", async () => {
    const deps = makeDeps({
      listOutboxOperations: vi.fn().mockResolvedValue([makeOutboxOp("mut_bad")]),
      pushWorkbenchChanges: vi.fn().mockResolvedValue({
        success: true,
        data: {
          push_results: [
            {
              client_mutation_id: "mut_bad",
              status: "error",
              entity: "project",
              action: "upsert",
              id: "proj_bad",
              code: "not_found",
              message: "找不到"
            }
          ],
          pulled: null
        }
      })
    });

    const result = await flushOutbox(state, deps);

    expect(result.status).toBe("needs_attention");
    // 非 auth error 不清除 outbox
    expect(deps.removeOutboxOperations).not.toHaveBeenCalled();
    expect(result.pendingCount).toBe(1);
  });

  it("does not touch generation/edit context or Board Mode", async () => {
    // 验证 flushOutbox 不引用任何 generation/edit/board 概念
    const deps = makeDeps();
    const result = await flushOutbox(state, deps);
    expect(result).toBeDefined();
    // 只验证没有意外属性
    expect(result).not.toHaveProperty("generationContext");
    expect(result).not.toHaveProperty("boardMode");
  });
});

describe("sync-engine: pullChanges", () => {
  it("applies tombstones and saves pulled data", async () => {
    const deps = makeDeps({
      pullWorkbenchChanges: vi.fn().mockResolvedValue({
        success: true,
        data: {
          projects: [
            { id: "proj_tomb", deleted_at: "2024-01-01T00:00:00Z", user_id: "u1", title: "Del", sort_order: 0, collapsed: false, active_session_id: null, created_at: "2024-01-01T00:00:00Z", updated_at: "2024-01-01T00:00:00Z" }
          ],
          sessions: [],
          version_nodes: [],
          last_sync_time: "2024-01-01T01:00:00Z"
        }
      })
    });

    const result = await pullChanges(INITIAL_SYNC_STATE, deps);

    expect(deps.applyCacheTombstones).toHaveBeenCalledWith({
      deletedProjectIds: ["proj_tomb"],
      deletedSessionIds: [],
      deletedVersionNodeIds: []
    });
    expect(deps.savePulledData).toHaveBeenCalled();
    expect(result.lastSyncTime).toBe("2024-01-01T01:00:00Z");
  });

  it("enters offline on network error", async () => {
    const deps = makeDeps({
      pullWorkbenchChanges: vi.fn().mockRejectedValue(new Error("offline"))
    });

    const result = await pullChanges(INITIAL_SYNC_STATE, deps);
    expect(result.status).toBe("offline");
  });
});

describe("sync-engine: dismissConflict", () => {
  it("removes conflict and updates status", () => {
    const state: SyncState = {
      ...INITIAL_SYNC_STATE,
      status: "needs_attention",
      conflicts: [
        { clientMutationId: "mut_1", entity: "project", entityId: "p1", serverRecord: null, detectedAt: "2024-01-01" },
        { clientMutationId: "mut_2", entity: "session", entityId: "s1", serverRecord: null, detectedAt: "2024-01-01" }
      ]
    };

    const result = dismissConflict(state, "mut_1");
    expect(result.conflicts).toHaveLength(1);
    expect(result.conflicts[0].clientMutationId).toBe("mut_2");
    expect(result.status).toBe("needs_attention");

    const final = dismissConflict(result, "mut_2");
    expect(final.conflicts).toHaveLength(0);
    expect(final.status).toBe("synced");
  });
});
