# ProjectSidebar Codex 风重构（落地版）

slug: `cosmic-tumbling-narwhal`  完成: 2026-05-04

> 个人 plan 在 `~/.claude/plans/cosmic-tumbling-narwhal.md`；这一份是落仓的精简版本。

## 背景

`components/creator/studio/ProjectSidebar.tsx`（159 行）原本是 4 个 hardcoded 项目折叠树。三大体感问题：

1. 4 个项目 hardcoded，用户不能新建/重命名/删除
2. branch 列表无时间感，不像 ChatGPT/Codex 那样按今天/昨天/本周/更早分组
3. 没有右键菜单 / 三点菜单，常见动作做不了

目标：把 sidebar 调成「项目软种子（IndexedDB CRUD）+ 项目内 session 按时间分组 + 行级右键菜单」，全程不动 prisma / API 契约。

## 拆刀（一刀一 commit）

| 刀 | commit | 内容 | 文件数 / 行数 |
| --- | --- | --- | --- |
| Cut 1 | `44589cf` | useProjects hook + projects-store IndexedDB CRUD + CreatorWorkspace 接通；CreatorProjectId 加 `proj_${string}` | 6 / 500+ -7 |
| Cut 2 | (auto) | shadcn dropdown-menu / context-menu / alert-dialog + SidebarToast Provider + radix 三个 npm 包 | 6 / 966 |
| Cut 3 | `a8fdea7` | bucketByActivity + 6 用例（含桶内倒序）；周一为周首 | 2 / 220 |
| Cut 4 | `95afcfe` | ProjectSidebar 视觉骨架重写为 Codex 风 + 5 用例 + creator-shell 测试微调 | 3 / 441 -107 |
| Cut 5 | (auto) | ProjectKebabMenu + 3 个 dialog（New / Rename / DeleteAlert）+ 5 CRUD 用例 | 8 / 700+ |
| Cut 6 | `a848851` | SessionRowMenu（ContextMenu + DropdownMenu 共用 body 11 项）+ 3 用例 | 3 / 425 |
| Cut 7 | (this) | 文档同步 + 真机走查 checklist | 5 |

## 落地结构

```
ProjectSidebar
├─ 顶部条：[创作台 标题 + 新建对话 button]
├─ ProjectHeader：[icon + 项目名 + kebab DropdownMenu]
│   └─ 6 项：固定 / 资源管理器 / 工作树（占位）/ 重命名 ✅ / 归档（占位）/ 移除 ✅
├─ ProjectSwitcher：其他项目 row 列表 + 「+ 新建项目」 ✅
├─ SessionList：今天 / 昨天 / 本周 / 更早 4 桶
│   └─ 每个 session row：右键 ContextMenu + 三点 DropdownMenu，11 项菜单
│      ├─ ✅ 复制会话 ID（navigator.clipboard）
│      ├─ ✅ 复制深度链接（?project=...&conversation=branch:...）
│      └─ 占位 9 项（置顶 / 重命名对话 / 归档 / 标记未读 / 资源管理器 / 复制工作目录
│         / 分叉同 / 派生新 / 迷你窗口）
├─ NewProjectDialog
├─ ProjectRenameDialog
├─ ProjectDeleteAlert（projects.length<=1 禁用 Action 防呆）
└─ SidebarToastProvider（极简 inline toast，不引 sonner）
```

## 数据流

```
IndexedDB (psypic_projects)
  └─ listProjects / saveProject / renameProject / deleteProject / seed
      └─ useProjects() hook
          └─ CreatorWorkspace
              └─ ProjectSidebar { projects, createProject, renameProject, deleteProject }
                  └─ kebab / dialogs CRUD → hook.refresh → re-render
```

`nodeProjectIds` 仍是 CreatorWorkspace 内的纯 useState，本轮**不动**（兜底 `?? "commercial"` 保留）。

## 不做（明确边界）

- ❌ 不改 prisma / API 契约（菜单里需要 schema 字段的 9 项全 placeholder）
- ❌ 不引 sonner / 新状态库（自写 SidebarToast）
- ❌ 不动 nodeProjectIds 内存语义
- ❌ 不动主导航 2 项规则

## 关键文件

**新建**：
- `lib/creator/use-projects.ts`
- `lib/creator/session-buckets.ts`
- `components/ui/dropdown-menu.tsx` / `context-menu.tsx` / `alert-dialog.tsx`
- `components/creator/studio/SidebarToast.tsx`
- `components/creator/studio/ProjectKebabMenu.tsx`
- `components/creator/studio/NewProjectDialog.tsx`
- `components/creator/studio/ProjectRenameDialog.tsx`
- `components/creator/studio/ProjectDeleteAlert.tsx`
- `components/creator/studio/SessionRowMenu.tsx`
- `tests/unit/use-projects.test.ts`
- `tests/unit/session-buckets.test.ts`
- `tests/components/project-sidebar.test.tsx`
- `tests/components/project-sidebar-crud.test.tsx`
- `tests/components/project-sidebar-context-menu.test.tsx`

**改**：
- `components/creator/studio/ProjectSidebar.tsx`（159 → ~370 行 rewrite）
- `components/creator/CreatorWorkspace.tsx`（局部 line 88-92 / 189-196 / 1377-1417 / 1516-1525 / 1606-1622）
- `lib/creator/projects.ts`（已上一会话 rename）
- `lib/creator/projects-store.ts`（已上一会话写）
- `lib/creator/types.ts`（CreatorProjectId 加 proj_）
- `tests/components/creator-shell.test.tsx`（项目切换测试微调）

## 验收

- ✅ `pnpm typecheck`
- ✅ `pnpm lint`（max-warnings=0）
- ✅ `pnpm test`（54 files / 245 tests）
- ✅ `pnpm build`
- 🚧 真机 6 路由走查（沿用 docs/17 checklist）

## 经验总结

1. **CreatorWorkspace.tsx 绝不整读** —— Cut 1 / 5 / 6 全部用 Grep + offset/limit slice 避开 32MB 单 request 上限
2. **userEvent + clipboard** —— `navigator.clipboard` 不是 jsdom 自带，是 `userEvent.setup()` 内部装，所以 `vi.spyOn` 必须在 setup 之后；之前 `Object.defineProperty(navigator, "clipboard", { value })` 会被 user-event 覆盖
3. **Radix Item onSelect** —— `event.preventDefault()` 阻止 menu 关闭，但不会阻塞 handler 后续逻辑；不调 preventDefault 时 item 默认会关菜单
4. **ESLint set-state-in-effect** —— Dialog 内部表单 state 用 `useEffect(() => setX(initial), [open])` 重置会被 lint 拦；解法是把 form 拆成子组件，靠 Radix Portal 自动 mount/unmount 重置
