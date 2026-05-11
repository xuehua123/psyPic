import { describe, expect, it } from "vitest";

import {
  resolvePushResults,
  extractTombstones
} from "@/lib/creator/sync/conflict-resolver";
import type { WorkbenchSyncResult, WorkbenchSyncPullResponse } from "@/lib/creator/workbench-types";

describe("conflict-resolver: resolvePushResults", () => {
  it("classifies applied/replayed as cleared", () => {
    const results: WorkbenchSyncResult[] = [
      { client_mutation_id: "mut_1", entity: "project", action: "upsert", id: "p1", status: "applied" },
      { client_mutation_id: "mut_2", entity: "session", action: "upsert", id: "s1", status: "replayed" }
    ];

    const resolved = resolvePushResults(results);

    expect(resolved.clearedMutationIds).toEqual(["mut_1", "mut_2"]);
    expect(resolved.newConflicts).toHaveLength(0);
    expect(resolved.hasAuthError).toBe(false);
  });

  it("classifies conflict as new conflict with server_record", () => {
    const results: WorkbenchSyncResult[] = [
      {
        client_mutation_id: "mut_conflict",
        entity: "project",
        action: "upsert",
        id: "p_conflict",
        status: "conflict",
        server_record: { id: "p_conflict", title: "Server value" } as unknown as WorkbenchSyncResult["server_record"]
      }
    ];

    const resolved = resolvePushResults(results);

    expect(resolved.clearedMutationIds).toHaveLength(0);
    expect(resolved.newConflicts).toHaveLength(1);
    expect(resolved.newConflicts[0]).toMatchObject({
      clientMutationId: "mut_conflict",
      entity: "project",
      entityId: "p_conflict",
      serverRecord: { id: "p_conflict", title: "Server value" }
    });
    expect(resolved.newConflicts[0].detectedAt).toBeDefined();
  });

  it("detects auth errors from error results", () => {
    const results: WorkbenchSyncResult[] = [
      {
        client_mutation_id: "mut_auth",
        entity: "session",
        action: "upsert",
        id: "s1",
        status: "error",
        code: "unauthorized",
        message: "请先登录"
      }
    ];

    const resolved = resolvePushResults(results);

    expect(resolved.hasAuthError).toBe(true);
    // error 状态的 mutation 也被清除（不重试无效操作）
    expect(resolved.clearedMutationIds).toContain("mut_auth");
  });

  it("does NOT clear non-auth error mutations from outbox", () => {
    const results: WorkbenchSyncResult[] = [
      {
        client_mutation_id: "mut_bad",
        entity: "version_node",
        action: "upsert",
        id: "vn1",
        status: "error",
        code: "not_found",
        message: "找不到"
      }
    ];

    const resolved = resolvePushResults(results);

    expect(resolved.hasAuthError).toBe(false);
    // 非 auth error 不清除 outbox，保留 pending
    expect(resolved.clearedMutationIds).not.toContain("mut_bad");
    expect(resolved.nonAuthErrorCount).toBe(1);
  });
});

describe("conflict-resolver: extractTombstones", () => {
  it("extracts deleted entities from pull response", () => {
    const pulled: WorkbenchSyncPullResponse = {
      projects: [
        { id: "p_live", user_id: "u1", title: "Live", sort_order: 0, collapsed: false, active_session_id: null, created_at: "2024-01-01", updated_at: "2024-01-01", deleted_at: null },
        { id: "p_dead", user_id: "u1", title: "Dead", sort_order: 0, collapsed: false, active_session_id: null, created_at: "2024-01-01", updated_at: "2024-01-01", deleted_at: "2024-01-02" }
      ],
      sessions: [
        { id: "s_dead", project_id: "p_dead", title: "Dead", fork_parent_version_node_id: null, active_version_node_id: null, custom_label: null, is_pinned: false, is_archived: false, last_read_at: null, created_at: "2024-01-01", updated_at: "2024-01-01", deleted_at: "2024-01-02" }
      ],
      version_nodes: [
        { id: "vn_dead", project_id: "p_dead", session_id: "s_dead", parent_version_node_id: null, prompt_snapshot: "", params_snapshot: null, source_asset_ids: [], output_asset_ids: [], board_document_id: null, board_snapshot: null, board_export_asset_id: null, branch_label: null, status: "succeeded", created_at: "2024-01-01", updated_at: "2024-01-01", deleted_at: "2024-01-02" }
      ]
    };

    const tombstones = extractTombstones(pulled);

    expect(tombstones.deletedProjectIds).toEqual(["p_dead"]);
    expect(tombstones.deletedSessionIds).toEqual(["s_dead"]);
    expect(tombstones.deletedVersionNodeIds).toEqual(["vn_dead"]);
  });

  it("returns empty arrays when no tombstones", () => {
    const pulled: WorkbenchSyncPullResponse = {
      projects: [
        { id: "p1", user_id: "u1", title: "OK", sort_order: 0, collapsed: false, active_session_id: null, created_at: "2024-01-01", updated_at: "2024-01-01", deleted_at: null }
      ],
      sessions: [],
      version_nodes: []
    };

    const tombstones = extractTombstones(pulled);

    expect(tombstones.deletedProjectIds).toHaveLength(0);
    expect(tombstones.deletedSessionIds).toHaveLength(0);
    expect(tombstones.deletedVersionNodeIds).toHaveLength(0);
  });
});
