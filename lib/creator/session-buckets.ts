import type { SidebarProjectBranchSummary } from "@/lib/creator/projects";

/**
 * 把 session（branch summary）按"最后活动时间"分到 4 个时间桶 ——
 * 今天 / 昨天 / 本周 / 更早，仿 Codex / ChatGPT 的 sidebar idiom。
 *
 * **SSR-safe**：函数纯，参数化 `now`；调用方在 client-side useEffect
 * 后传 `new Date()`，避免 hydration mismatch。
 *
 * **边界**（中国语境，周一为周首）：
 *   今天 = [今天 00:00, ∞)
 *   昨天 = [昨天 00:00, 今天 00:00)
 *   本周 = [本周一 00:00, 昨天 00:00)
 *   更早 = 其余（含 latestNode === null 的 branch，这种 branch 没生成
 *          过节点，按惯例放到底部 earlier 桶）
 *
 * 排序：每个桶内按 latestNode.createdAt 倒序（最近的在上）。
 */

export type SessionBuckets<T> = {
  today: T[];
  yesterday: T[];
  thisWeek: T[];
  earlier: T[];
};

type WithLatestNode = Pick<SidebarProjectBranchSummary, "latestNode">;

export function bucketByActivity<T extends WithLatestNode>(
  items: T[],
  now: Date = new Date()
): SessionBuckets<T> {
  const todayStart = startOfDay(now);
  const yesterdayStart = addDays(todayStart, -1);
  const weekStart = startOfWeek(todayStart);

  const result: SessionBuckets<T> = {
    today: [],
    yesterday: [],
    thisWeek: [],
    earlier: []
  };

  for (const item of items) {
    if (!item.latestNode) {
      result.earlier.push(item);
      continue;
    }

    const ts = new Date(item.latestNode.createdAt).getTime();
    if (Number.isNaN(ts)) {
      // 无效时间戳：保险归到 earlier，不丢
      result.earlier.push(item);
      continue;
    }

    if (ts >= todayStart.getTime()) {
      result.today.push(item);
    } else if (ts >= yesterdayStart.getTime()) {
      result.yesterday.push(item);
    } else if (ts >= weekStart.getTime()) {
      result.thisWeek.push(item);
    } else {
      result.earlier.push(item);
    }
  }

  // 桶内按时间倒序（latestNode === null 的 earlier 项排到桶尾）
  for (const bucket of [
    result.today,
    result.yesterday,
    result.thisWeek,
    result.earlier
  ]) {
    bucket.sort((left, right) => {
      const leftTs = left.latestNode
        ? new Date(left.latestNode.createdAt).getTime()
        : -Infinity;
      const rightTs = right.latestNode
        ? new Date(right.latestNode.createdAt).getTime()
        : -Infinity;
      return rightTs - leftTs;
    });
  }

  return result;
}

function startOfDay(date: Date): Date {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

/** 周一作为一周开始（中国语境）。getDay 返回 0=周日…6=周六。 */
function startOfWeek(todayStart: Date): Date {
  const day = todayStart.getDay();
  // 周日 (0) 时距离上周一为 6 天；其它 day 距离本周一为 (day - 1) 天
  const offset = day === 0 ? 6 : day - 1;
  return addDays(todayStart, -offset);
}
