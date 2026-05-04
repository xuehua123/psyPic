# PsyPic 项目 · Claude Code 入口

> 自动加载：任何 Claude Code 会话进入本仓库时会读这份。
> 这里只放**当前正在进行的工作上下文**与**关键文档指针**，不重复代码已经表达的内容。

## 当前重点工作

**Sidebar fork / 派生 实做**（plan slug `clever-swimming-pumpkin` 续作 · F 选项）—— SessionRowMenu 11 项菜单的「分叉到同一工作树」/「派生到新工作树」从 placeholder 变实做。原 plan 还含两小升级：每卡「+ 新对话」icon button + sidebar 平铺折叠卡。

**状态**：**全部出库 🎉**

**最近进度**（自下而上时间线）：
- F · Cut 3 ✅ `4fba1fa`：「派生到新工作树」—— createProject(`${源项目} · 派生`) + 切 new + 回填 prompt/params；fallback 路径（jsdom 无 IndexedDB 时只填 Composer 不切项目）
- F · Cut 2 ✅ `4027f8d`：「分叉到同一工作树」—— 一步到位等价于 startVersionFork（切 active project + branch + setForkParentId(latestNode.id) + restoreVersionNodeParams）
- F · Cut 1 ✅ `a7f1c43`：SessionRowMenu / ProjectCard / ProjectSidebar 加 fork 通路（onForkSame? / onForkNew? optional callbacks，不传时 fallback 走 onPlaceholder）
- 每卡「+ 新对话」 ✅ `da95a7e`：ProjectCard header 加 MessageSquarePlus 一步直达
- 平铺折叠卡 ✅ `5e9f8fe`/`b4301bd`/`e025eff`/`ed6bb8f`/`8a3460f`/`620394d`：6 cut 完成 sidebar 重构

**整体测试覆盖**：56 files / 265 tests pass。SessionRowMenu 11 项菜单实做 **4 项** / 占位 7 项（置顶 / 重命名对话 / 归档 / 标记未读 / 资源管理器 / 复制工作目录 / 迷你窗口）。

**之前重点（已封板，保留作历史）**：
- ProjectSidebar Codex 风重构（plan slug `cosmic-tumbling-narwhal`）—— IndexedDB CRUD + 4 桶时间分组 + 行级菜单
- PsyPic UI 全面深度优化（plan slug `linear-stirring-acorn`）—— Phase 4-6 + Plan Task 6/7 全部出库

## 接棒读哪一份

**先读**：`docs/superpowers/plans/2026-05-04-project-sidebar-flat-collapse.md`
平铺折叠卡的精简落地版本（也含 F 续作的进度尾巴）。

**前情提要**：
- `docs/superpowers/plans/2026-05-04-project-sidebar-codex-rewrite.md` — 上一轮 sidebar 重构（CRUD + 4 桶 + 菜单），本轮改的是它的视觉结构
- `docs/superpowers/plans/2026-05-03-creatorworkspace-extraction-map.md` — 更上一轮 UI 重构入口

**辅助**：
- `docs/superpowers/plans/2026-05-02-psypic-ui-system-implementation.md` — Phase 0-8 完整 plan
- `docs/superpowers/specs/2026-05-02-psypic-ui-system-design.md` — 视觉/信息架构 spec
- `docs/superpowers/specs/2026-05-02-codex-chat-studio-design.md` — chat-studio 设计
- `docs/14-视觉与竞品对标标准.md` — 含暗色 + 移动端 + sidebar 平铺折叠卡 UI 验收标准
- `docs/17-测试与验收用例.md` — 含 sidebar 平铺折叠卡回归 + 6 路由人工走查表

## 项目硬约束（出自 spec / plan）

- **TS strict mode**，pnpm 包管理
- 全局只用 **Tailwind v4 + shadcn/ui** 元件（已 Phase 0 装好）；新代码不写 raw `primary-button` className
- 主导航**严格 2 项**（工作台 / 灵感社区）；spec 命令不要把素材/模板/任务塞进顶栏
- **不引入新状态库**（不上 Zustand / Jotai，用 React Context）
- **不引入新图标库**（继续 lucide-react）
- 所有改动必须 `pnpm typecheck` 通过；建议 commit 前还跑 `pnpm lint && pnpm test`
- 主题切换：通过 `<ThemeProvider>` + `useTheme()` hook，**不再加任何 raw 字面量颜色**（统一走 CSS var 或 Tailwind semantic class）

## 与 CreatorWorkspace.tsx 打交道时

⚠️ **绝对不要 `Read` 整个文件** —— 当前 ~1700 行整读会让 transcript 单 turn 体积过大；Phase 4 期间 3358 行版本曾让上一会话死过一次（突破 32MB 单 request 上限）。

正确套路：
1. `Grep` 找 className anchor 拿当前行号
2. `Read` 带 `offset + limit` 只读相关区段（30-100 行）
3. 一个改动 = 一个 commit
4. 改完跑 `pnpm typecheck`（建议加 `pnpm lint`），再 commit

## 不动的边界

- 不改 Sub2API 协议、API 契约、数据模型
- 不动 `prisma/`、`scripts/`
- 不在本轮做 i18n

## 后续可选项（4 / 4 已收口，真机走查 checklist 已备待走）

- 📋 桌面 + 移动端真机走查 6 路由（commit `9028827`）：docs/17 加 6 路由 ✕ 桌面/移动/暗色 详细 checklist + 18 格走查日志骨架，等走查者拿浏览器逐项打钩回填
- ~~BatchWorkflowPanel state 上 Context（让移动端底抽屉也能展示）~~ ✅ commit `894ad93`：BatchProvider 持有 state + polling，桌面/移动双 mount 共享，222 tests pass
- ~~暗色 polish 跟踪：accent-soft 系字面量（`#f0fdfa` / `#85c7be` / `#e7f3f1` / `#fff5f3` / `#f0b8b1` / `#e6ebf1` / `#e6f4f1` / `#e6ebf1`）~~ ✅ commit `22bda89`：8 处全部走 var()，加 `--accent-border` / `--danger-soft` / `--danger-border` 3 个新 token
- ~~next-themes 迁移~~ ✅ commit `e6ee979`：自写 ThemeProvider → next-themes 0.4.6 wrapper，140 → 70 行（-71），221 tests pass，build ✅；保 useTheme noop fallback、storageKey 兼容老用户、`<html class="dark">` 切法不变

## 常用命令

```bash
pnpm dev               # webpack dev server (默认)
pnpm dev:turbo         # turbopack dev server (备选)
pnpm typecheck         # tsc --noEmit
pnpm lint              # eslint, max-warnings=0
pnpm test              # vitest
pnpm build             # next build
```
