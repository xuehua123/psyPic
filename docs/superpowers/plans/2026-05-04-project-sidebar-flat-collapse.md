# ProjectSidebar 平铺折叠卡重构（落地版）

slug: `clever-swimming-pumpkin`  完成: 2026-05-04

> 个人 plan 在 `~/.claude/plans/clever-swimming-pumpkin.md`；这一份是落仓的精简版本。

## 背景

上一轮 sidebar 重构（plan slug `cosmic-tumbling-narwhal`）落了 IndexedDB CRUD + 4 桶时间分组 + 行级菜单，但布局沿用了「单 active 顶部 + 其他项目切换列表 + 单一 session 列」。三大体感问题：

1. 点别的项目 → 它跳到顶部当 active，原 active 退到中间，session 列表整体换内容 —— 用户原话："挑来跳去的"
2. 没法同时看到多个项目的 session
3. "active" 概念过强，点一下就重排版

参考 [desktop-cc-gui Sidebar.tsx](https://github.com/zhukunpenglinyutong/desktop-cc-gui/blob/main/src/features/app/components/Sidebar.tsx) + [WorkspaceCard.tsx](https://github.com/zhukunpenglinyutong/desktop-cc-gui/blob/main/src/features/app/components/WorkspaceCard.tsx) 的做法重构：项目们平铺成可折叠卡，每个独立 collapse，session 列表内嵌在卡内 —— 位置永远不变，"active" 仅外观，点行只 toggle 展开。

## 拆刀（一刀一 commit）

| 刀 | commit | 内容 | 行数 |
| --- | --- | --- | --- |
| Cut 1 | `5e9f8fe` | useCollapsedProjects hook（localStorage 持久化，SSR safe，垃圾值兜底）+ 7 单测 | +231 |
| Cut 2 | `b4301bd` | ProjectCard 组件（collapsible header + 内嵌 4 桶 session list + 全部对话 row + kebab）+ 6 用例 | +527 |
| Cut 3 | `e025eff` | 重写 ProjectSidebar 主体（删 ProjectHeader 单卡 + 删「其他项目」switcher + map ProjectCard）；改 sidebar 6 用例 | +131 -303 |
| Cut 4 | `ed6bb8f` | CRUD 测试适配（kebab 现在每卡一份，用 scoped getKebabIn helper） | +24 -7 |
| Cut 5 | `8a3460f` | creator-shell 切换用例适配（点 header 改 toggle / 点全部对话切 active） | +41 -16 |
| Cut 6 | `620394d` | 文档同步 + 推 main | 5+ |

## 续作 · 每卡「+ 新对话」 + Sidebar fork/派生实做（F 选项）

平铺折叠卡落地后又叠了几刀，把 SessionRowMenu 11 项菜单的 fork 类两项实做：

| 刀 | commit | 内容 |
| --- | --- | --- |
| 每卡「+ 新对话」 | `da95a7e` | ProjectCard header 加 MessageSquarePlus button：折叠/展开都可见，stopPropagation 不冒到 toggle；click → onSelectProject + onSelectConversation("new") |
| F · Cut 1 | `a7f1c43` | SessionRowMenu / ProjectCard / ProjectSidebar 加 fork 通路（onForkSame? / onForkNew? optional callbacks，不传时 fallback 走 onPlaceholder） + context-menu 测试 +3 用例 |
| F · Cut 2 | `4027f8d` | 「分叉到同一工作树」实做：handleForkSession 等价于 startVersionFork；切 active project + branch + setForkParentId(latestNode.id) + restoreVersionNodeParams + sidebar toast |
| F · Cut 3 | `4fba1fa` | 「派生到新工作树」实做：handleDeriveSession 创建 `${源项目} · 派生` 项目 → 切 new + 回填 prompt/params；jsdom 无 IndexedDB 走 fallback 仅填 Composer |
| F · Cut 4 | (this) | 文档同步 + 推 main |

至此 SessionRowMenu 11 项菜单实做 4 项（复制会话 ID / 复制深度链接 /
分叉到同一工作树 / 派生到新工作树），剩 7 项 placeholder。

## 落地结构

```
ProjectSidebar
├─ 顶部条：[创作台 + 新建对话]
├─ ProjectCardList（所有项目按 sortOrder 平铺）
│   └─ ProjectCard × N
│       ├─ Header (role=button, aria-expanded)：chevron + 文件夹 icon
│       │   + 项目名 + count badge + ProjectKebabMenu（stopPropagation）
│       └─ 展开时渲染：
│           ├─ 「全部对话」row（点击 selectProject + selectConversation('all')）
│           ├─ 4 桶 session（today / yesterday / thisWeek / earlier）
│           └─ session-list-empty 占位（branchSummaries 为空时）
└─ + 新建项目 button
```

## 数据流

```
useCollapsedProjects(projectIds, activeProjectId)
  ├─ Set<CreatorProjectId> 存折叠的 id
  ├─ 默认值：除 active 外全部折叠
  ├─ localStorage key: psypic_sidebar_collapsed_projects
  └─ active 切换不抢用户已 toggle 状态

CreatorWorkspace
  └─ ProjectSidebar { projects, activeProjectId, activeConversationId, 5 callback }
      └─ ProjectCard × N（map）
          ├─ kebab → onRename / onDelete / onPlaceholder
          ├─ 全部对话 → onSelectProject + onSelectConversation('all')
          └─ session row → onSelectProject + onSelectConversation('branch:...')
```

## 关键交互对照表

| 动作 | 旧行为 | 新行为 |
| --- | --- | --- |
| 点项目 row | 切 active project（项目跳到顶部） | toggle collapse（位置不变） |
| 点 session row | 切 active conversation | 同 → 同时把所属项目设为 active |
| 点「全部对话」 | 切到 active project 的 all 视图 | 切到该 card 项目的 all 视图（同时切 active） |
| 点 kebab → 重命名/删除 | 操作 active project | 操作该 card 项目 |
| 顶部「新建对话」 | 在 active project 下新建 | 不变 |
| 顶部「+ 新建项目」 | 弹 NewProjectDialog | 不变 |
| 多项目同时展开 | 不行 | 行（每卡独立 collapse state） |

## 不做（明确边界）

- ❌ 不改 `useProjects` hook、`projects-store`、`projects.ts` 类型
- ❌ 不改 `CreatorWorkspace.tsx`（ProjectSidebar 对外 props 契约零修改）
- ❌ 不引新依赖（用 CSS 做展开过渡，不上 framer-motion）
- ❌ 不改 SessionRowMenu / NewProjectDialog / RenameDialog / DeleteAlert / SidebarToast / ProjectKebabMenu —— 全部复用

## 关键文件

**新建**：
- `lib/creator/use-collapsed-projects.ts`（86 行）
- `components/creator/studio/ProjectCard.tsx`（318 行）
- `tests/unit/use-collapsed-projects.test.ts`（7 用例）
- `tests/components/project-card.test.tsx`（6 用例）

**改**：
- `components/creator/studio/ProjectSidebar.tsx`（370 → 198 行，-172）
- `tests/components/project-sidebar.test.tsx`（5 → 6 用例，重写 invariant）
- `tests/components/project-sidebar-crud.test.tsx`（kebab scope 化）
- `tests/components/creator-shell.test.tsx`（switches projects 用例改交互）

**完全不动**：
- `components/creator/CreatorWorkspace.tsx`
- `lib/creator/use-projects.ts` / `projects-store.ts` / `projects.ts` / `types.ts` / `session-buckets.ts`
- 所有现有 dialog / menu / toast 组件

## 验收

- ✅ `pnpm typecheck`
- ✅ `pnpm lint`（max-warnings=0）
- ✅ `pnpm test`（56 files / 259 tests / +13 用例）
- ✅ `pnpm build`
- 🚧 真机走查：1. sidebar 列出全部项目；2. 点非 active row 原地展开；3. 多项目可同时展开；4. 点 session 切 active；5. 刷新保留折叠；6. 桌面/移动/暗色 三维度

## 经验总结

1. **kebab 必须 stopPropagation** —— ProjectCard header 是 click toggle，里面又嵌 kebab button；不 stopPropagation 时点 kebab 会同时折叠/展开整张卡，体感反向。修法：kebab 外裹一层 div onClick stopPropagation。
2. **测试 testid 多卡 scope 化** —— `project-kebab-button` 现在每卡一份，`getByTestId` 会撞 multiple matches；统一新增 helper `getKebabIn(projectId)` 用 `within(getByTestId("project-card-{id}"))` 锁定。同理 `conversation-row-all` 改成 `conversation-row-all-{projectId}`。
3. **localStorage hook init 用 lazy state** —— `useState(() => readStored() ?? defaults)` 比 `useState(defaults)` + `useEffect(setX)` 干净，避开 ESLint set-state-in-effect 规则，也避免首屏闪一下。
4. **active vs collapse 解耦设计** —— 之前的「单 active 顶部」模型把"我在哪"和"看什么"绑死；解耦后用户能：① active=A 但同时看 B 的 session；② 折叠 active 自己也行（虽然没用，但是 free）。最终用户路径："点 X 看 X 不影响 Y"。
