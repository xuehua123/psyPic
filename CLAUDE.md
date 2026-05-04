# PsyPic 项目 · Claude Code 入口

> 自动加载：任何 Claude Code 会话进入本仓库时会读这份。
> 这里只放**当前正在进行的工作上下文**与**关键文档指针**，不重复代码已经表达的内容。

## 当前重点工作

**SessionRowMenu 11 项菜单全部完结**（plan slug `gentle-spinning-walnut`）—— 剩 7 项 placeholder 全部处理：4 项实做（置顶 / 重命名 / 归档 / 标记未读）+ 3 项桌面端独占占位文案明确化。

**状态**：**Cut 7/7 ✅ 全部出库 🎉**

**进度**：
- Cut 1 ✅ `8bea756`：branch-meta-store + useBranchMeta hook（IndexedDB 合并 store：customLabel / isPinned / isArchived / lastReadAt）+ 12 单测
- Cut 2 ✅ `bec56be`：**置顶对话实做** + 一次铺好 4 项 callback 通路
- Cut 3 ✅ `5646787`：**重命名对话实做** —— SessionRenameDialog + customLabel 优先于 prompt 渲染
- Cut 4 ✅ `0d57501`：**归档对话实做** + 「显示归档（N）」toggle
- Cut 5 ✅ `aac1811`：**标记未读实做** —— hasUnread 派生 + 蓝点 indicator + 自动 markRead
- Cut 6 ✅ `680f0b7`：桌面端独占 placeholder 文案升级（Tauri 客户端）
- Cut 7 ✅：文档同步 + push origin main

**整体增减**：59 files / 292 tests pass（比上轮 +3 files +27 tests）。SessionRowMenu 11 项菜单实做 **8 项** + 桌面端独占 3 项占位（资源管理器 / 工作目录 / 迷你窗口）。

至此创作台 sidebar **从「单 active + 4 hardcoded 项目」演进到「平铺折叠卡 + IndexedDB 项目 CRUD + 完整会话级菜单（置顶 / 重命名 / 归档 / 未读 / 复制 ID·链接 / 分叉 / 派生）+ Tauri 桌面端独占功能明确占位」**。

**之前重点（已封板，保留作历史）**：
- Sidebar fork / 派生 实做 + 平铺折叠卡（plan slug `clever-swimming-pumpkin`）
- ProjectSidebar Codex 风重构（plan slug `cosmic-tumbling-narwhal`）
- PsyPic UI 全面深度优化（plan slug `linear-stirring-acorn`）

## 接棒读哪一份

**先读**：`docs/superpowers/plans/2026-05-05-session-row-menu-finishing.md`
本轮的精简落地版本（合并 store 设计 + 拆刀对照表 + 经验总结）。

**前情提要**：
- `docs/superpowers/plans/2026-05-04-project-sidebar-flat-collapse.md` — 上一轮平铺折叠卡 + fork/派生
- `docs/superpowers/plans/2026-05-04-project-sidebar-codex-rewrite.md` — 更上一轮 sidebar 重构
- `docs/superpowers/plans/2026-05-03-creatorworkspace-extraction-map.md` — 更早一轮 UI 重构入口

**辅助**：
- `docs/19-图片工作台改造蓝图.md` — 文档侧总蓝图：project / session / version node / asset / job 的工作台化语言
- `docs/20-多素材多图层画布（Board Mode）改造方案.md` — Board Mode 专项：多素材多图层画布、手绘标注、mask、导出到 edits、version node snapshot
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
- Board Mode 若进入实现，优先按 `docs/20-多素材多图层画布（Board Mode）改造方案.md` 用 `components/creator/board/*` + `lib/creator/board/*` 隔离，不把 canvas 交互塞回 `CreatorWorkspace.tsx`
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
