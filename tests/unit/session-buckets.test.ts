import { describe, expect, it } from "vitest";

import { bucketByActivity } from "@/lib/creator/session-buckets";
import type { SidebarProjectBranchSummary } from "@/lib/creator/projects";
import type { CreatorVersionNode } from "@/lib/creator/version-graph";

/**
 * 用一个固定 `now`（2026-05-04 周一 14:00）作为锚点；周一为周首。
 *   今天     = 2026-05-04 ≥ 00:00
 *   昨天     = 2026-05-03（周日）00:00 ≤ … < 2026-05-04 00:00
 *   本周     = 2026-05-04 周一 00:00 之前的本周（即 2026-05-04 那个本周）
 *               —— 注意周首是周一，所以本周 = [上周一 00:00, 昨天 00:00)？
 *   等等，这里 anchor 是周一，所以本周一就是今天，weekStart === todayStart，
 *   "本周（不含今天和昨天）" 桶为空。改用周三 anchor 测更典型。
 */

const NOW = new Date("2026-05-06T14:00:00"); // 周三

function makeBranch(
  id: string,
  iso: string | null
): SidebarProjectBranchSummary {
  const latestNode = iso
    ? ({
        id: `node_${id}`,
        parentId: null,
        branchId: id,
        branchLabel: id,
        depth: 0,
        createdAt: iso,
        status: "succeeded",
        prompt: `prompt for ${id}`,
        params: {} as CreatorVersionNode["params"],
        images: [],
        source: "generation"
      } as CreatorVersionNode)
    : null;

  return {
    id,
    label: id,
    count: 1,
    latestNode
  };
}

describe("bucketByActivity", () => {
  it("places branches with createdAt today into the today bucket", () => {
    const items = [
      makeBranch("a", "2026-05-06T13:00:00"),
      makeBranch("b", "2026-05-06T00:01:00")
    ];
    const buckets = bucketByActivity(items, NOW);
    expect(buckets.today.map((branch) => branch.id)).toEqual(["a", "b"]);
    expect(buckets.yesterday).toHaveLength(0);
    expect(buckets.thisWeek).toHaveLength(0);
    expect(buckets.earlier).toHaveLength(0);
  });

  it("places branches with createdAt yesterday into the yesterday bucket", () => {
    const items = [makeBranch("a", "2026-05-05T22:00:00")];
    const buckets = bucketByActivity(items, NOW);
    expect(buckets.yesterday.map((branch) => branch.id)).toEqual(["a"]);
    expect(buckets.today).toHaveLength(0);
  });

  it("places branches earlier in the same week into the thisWeek bucket", () => {
    // 今天 = 周三 2026-05-06；本周一 = 2026-05-04
    const items = [
      makeBranch("monday", "2026-05-04T10:00:00"),
      makeBranch("tuesday", "2026-05-05T15:30:00")
    ];
    const buckets = bucketByActivity(items, NOW);
    // 周二是昨天
    expect(buckets.yesterday.map((branch) => branch.id)).toEqual(["tuesday"]);
    // 周一是本周
    expect(buckets.thisWeek.map((branch) => branch.id)).toEqual(["monday"]);
  });

  it("places branches before the week start into the earlier bucket", () => {
    // 上周日 2026-05-03 / 上个月 / 任意远日期
    const items = [
      makeBranch("lastSunday", "2026-05-03T18:00:00"),
      makeBranch("lastMonth", "2026-04-01T09:00:00")
    ];
    const buckets = bucketByActivity(items, NOW);
    expect(buckets.earlier.map((branch) => branch.id)).toEqual([
      "lastSunday",
      "lastMonth"
    ]);
  });

  it("places branches with no latestNode into earlier and never throws", () => {
    const items = [makeBranch("empty", null), makeBranch("a", "2026-05-06T01:00:00")];
    const buckets = bucketByActivity(items, NOW);
    expect(buckets.today.map((branch) => branch.id)).toEqual(["a"]);
    expect(buckets.earlier.map((branch) => branch.id)).toEqual(["empty"]);
  });

  it("sorts each bucket by latestNode.createdAt descending", () => {
    const items = [
      makeBranch("oldest-today", "2026-05-06T01:00:00"),
      makeBranch("newest-today", "2026-05-06T13:30:00"),
      makeBranch("mid-today", "2026-05-06T08:00:00")
    ];
    const buckets = bucketByActivity(items, NOW);
    expect(buckets.today.map((branch) => branch.id)).toEqual([
      "newest-today",
      "mid-today",
      "oldest-today"
    ]);
  });
});
