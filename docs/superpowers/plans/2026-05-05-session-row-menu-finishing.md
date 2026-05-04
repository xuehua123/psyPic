# SessionRowMenu 剩 7 项菜单实做（落地版）

slug: `gentle-spinning-walnut`  完成: 2026-05-05

> 个人 plan 在 `~/.claude/plans/gentle-spinning-walnut.md`；这一份是落仓的精简版本。

## 背景

SessionRowMenu 11 项菜单上一轮（plan slug `clever-swimming-pumpkin` F 选项）实做 4 项（复制会话 ID / 复制深度链接 / 分叉到同一工作树 / 派生到新工作树），剩 7 项仍是 placeholder。用户拍板「都做了」。

按可行性分两类：
- **真做 4 项**（缺数据模型字段，加合并 store 即可）：置顶 / 重命名 / 归档 / 标记未读
- **明确占位 3 项**（web 端不可达，桌面 IPC 范围）：在资源管理器中打开 / 复制工作目录 / 在迷你窗口中打开 —— 升级 toast 文案明确告知

## 数据模型 · 合并 BranchMeta store

新建 IndexedDB store `psypic_branch_meta`：

```typescript
type StoredBranchMeta = {
  branchId: string;        // keyPath（version-graph 全局唯一，不需 projectId scope）
  customLabel?: string;    // 用户重命名后的标题
  isPinned?: boolean;      // 置顶 → 排到所有时间桶之前
  isArchived?: boolean;    // 归档 → 默认隐藏，「显示归档」toggle 显示
  lastReadAt?: string;     // ISO；< latestNode.createdAt 即未读
  updatedAt: string;
};
```

合并好处：1 个 store + 1 个 hook + 1 套 CRUD 路径，对照 4 个独立 store 节省 75% 代码量。

## 拆刀（一刀一 commit）

| 刀 | commit | 内容 | 文件数 |
| --- | --- | --- | --- |
| Cut 1 | `8bea756` | branch-meta-store + useBranchMeta hook + 12 单测（6 store fallback + 6 hook in-memory） | 4 新 |
| Cut 2 | `bec56be` | **置顶对话实做** + 一次铺好 4 项 callback 通路（pin / rename / archive / unread）；ProjectCard 拆 pinned/unpinned；CreatorWorkspace useBranchMeta；toast 分诊「已置顶」/「已取消置顶」 | 6 改 |
| Cut 3 | `5646787` | **重命名对话实做** —— 新 SessionRenameDialog（参考 ProjectRenameDialog）；customLabel 落库后渲染优先于 prompt；3 dialog 单测 + 2 集成 | 4 新 + 改 |
| Cut 4 | `0d57501` | **归档对话实做** —— 默认 filter 掉 isArchived；archivedCount > 0 时底部出现「显示归档（N）」/「隐藏归档」toggle；toast「已归档」/「已恢复」分诊；3 用例 | 2 改 |
| Cut 5 | `aac1811` | **标记未读实做** —— hasUnread derived from lastReadAt < latestNode.createdAt；row 加蓝点 indicator + 标题加粗；selectConversation 自动 markRead；2 用例 | 3 改 |
| Cut 6 | `680f0b7` | **桌面端独占占位升级** —— 「为桌面端功能」→「为桌面端独占功能 · 请使用 Tauri 客户端」；3 it.each 用例覆盖 explorer / cwd / mini | 3 改 |
| Cut 7 | (this) | 文档同步 + 推 main | 4+ |

## 落地结构

```
SessionRowMenu (11 项)
├─ Section 1: 项目管理
│   ├─ ✅ 置顶对话 / 取消置顶 → branch-meta isPinned
│   ├─ ✅ 重命名对话         → SessionRenameDialog → branch-meta customLabel
│   ├─ ✅ 归档对话 / 恢复对话 → branch-meta isArchived
│   └─ ✅ 标记为未读         → branch-meta lastReadAt = undefined
├─ ─── Separator ───
├─ Section 2: 桌面端独占（3 项 placeholder）
│   ├─ 🖥️ 在资源管理器中打开
│   ├─ 🖥️ 复制工作目录
│   ├─ ✅ 复制会话 ID
│   └─ ✅ 复制深度链接
├─ ─── Separator ───
└─ Section 3: 分叉
    ├─ ✅ 分叉到同一工作树   → 同项目 startVersionFork
    ├─ ✅ 派生到新工作树     → 新项目 + Composer 起点
    └─ 🖥️ 在迷你窗口中打开

数据流：
IndexedDB (psypic_branch_meta)
  └─ listBranchMeta() / patchBranchMeta() ─→ Map<branchId, StoredBranchMeta>
      └─ useBranchMeta() hook
          ├─ setPinned / setLabel / setArchived / markRead / markUnread
          └─ CreatorWorkspace
              └─ sidebarProjects useMemo merge metaById 进 branchSummaries
                  └─ ProjectCard 渲染时拆 pinned/unpinned + 过滤 archived
                      └─ SessionRow 渲染 unread indicator + customLabel
```

## 关键文件

**新建（5 个）**：
- `lib/creator/branch-meta-store.ts`（114 行）
- `lib/creator/use-branch-meta.ts`（130 行）
- `components/creator/studio/SessionRenameDialog.tsx`（118 行）
- `tests/unit/branch-meta-store.test.ts`（6 用例）
- `tests/unit/use-branch-meta.test.ts`（6 用例）
- `tests/components/session-rename-dialog.test.tsx`（3 用例）

**改（5 个）**：
- `lib/creator/projects.ts`（SidebarProjectBranchSummary +4 字段）
- `components/creator/studio/SessionRowMenu.tsx`（+4 onXxx? optional callbacks + isPinned/isArchived props + 文案双向切换）
- `components/creator/studio/ProjectCard.tsx`（pinned/unpinned 拆分 + showArchived state + unread indicator + customLabel 优先 + toast 文案升级）
- `components/creator/studio/ProjectSidebar.tsx`（+4 props + dialog state + handle wrappers + toast 分诊）
- `components/creator/CreatorWorkspace.tsx`（useBranchMeta + 4 个 handler + selectConversation auto markRead）
- `tests/components/project-sidebar-context-menu.test.tsx`（+10 用例）

**完全不动**：
- `lib/creator/types.ts` / `version-graph.ts` / `session-buckets.ts` / `projects-store.ts` / `use-projects.ts`
- `components/creator/studio/{NewProjectDialog,ProjectRenameDialog,ProjectDeleteAlert,ProjectKebabMenu,SidebarToast}.tsx`

## 不动的边界

- ❌ 不引新依赖（不上 sonner / dexie / dnd-kit）
- ❌ 不改 prisma / API 契约 / version-graph 节点结构
- ❌ 不动 CreatorConversationId 类型
- ❌ 桌面端 IPC（资源管理器 / 工作目录 / 迷你窗口）不在本轮范围

## 验收

- ✅ `pnpm typecheck`
- ✅ `pnpm lint`（max-warnings=0）
- ✅ `pnpm test`（59 files / 292 tests，比上轮 +3 files +27 tests）
- ✅ `pnpm build`
- 🚧 真机走查 7 项：4 实做 + 3 占位文案

## 关键交互对照表

| 动作 | 旧（placeholder） | 新（实做） |
| --- | --- | --- |
| 置顶对话 | toast「即将上线」 | branch-meta isPinned=true → 渲染到「置顶」桶；toast「已置顶对话」 |
| 取消置顶 | （无）| 同 row 二次点 → toast「已取消置顶」（菜单文案根据 isPinned 切） |
| 重命名对话 | toast「即将上线」 | 弹 SessionRenameDialog → 改 customLabel；留空恢复默认；toast「已重命名」 |
| 归档对话 | toast「即将上线」 | branch-meta isArchived=true → 默认隐藏；底部「显示归档（N）」toggle；toast「已归档对话」 |
| 标记为未读 | toast「即将上线」 | clear lastReadAt → row 出现蓝点 indicator + 标题加粗；toast「已标记为未读」 |
| 在资源管理器中打开 | toast「为桌面端功能」 | toast「为桌面端独占功能 · 请使用 Tauri 客户端」（明确化）|
| 复制工作目录 | toast「为桌面端功能」 | 同上 |
| 在迷你窗口中打开 | toast「为桌面端功能」 | 同上 |

## 经验总结

1. **合并 store 比拆 4 个 store 合算 75%** —— `branchId` 全局唯一时不需要 scope，单 store 就能装下 4 个独立字段；hook 里 partial-merge patch 函数最好维护
2. **一次铺通路 + 多刀填实做** —— Cut 2 一次性把 4 项 callback 通路（SessionRowMenu / ProjectCard / ProjectSidebar / CreatorWorkspace handler stub）全部铺好，后续 Cut 3-5 只填 UI 细节，避免反复改通路代码
3. **派生字段在 useMemo merge 阶段算** —— hasUnread 从 metaById + latestNode.createdAt 派生，不需要单独的 watcher / state
4. **toast 文案分诊明确化** —— 不要用「即将上线」混淆「真没做」和「桌面端独占」；后者升级到「为桌面端独占功能 · 请使用 Tauri 客户端」明确预期
5. **selectConversation 顺手 markRead** —— 不需要单独的「打开了 session」事件，复用 conversation 切换信号
6. **测试 testid 规范** —— 新增 `session-rename-dialog` / `session-rename-input` / `session-rename-submit` / `session-unread-indicator` / `toggle-archived-{projectId}`；既有 `session-menu-pin` / `-rename` / `-archive` / `-unread` testid 保持不变
