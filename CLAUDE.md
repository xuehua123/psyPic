# PsyPic 项目 · Claude Code 入口

> 自动加载：任何 Claude Code 会话进入本仓库时会读这份。
> 这里只放**当前正在进行的工作上下文**与**关键文档指针**，不重复代码已经表达的内容。

## 当前重点工作

**PsyPic UI 全面深度优化**（plan slug `linear-stirring-acorn`）—— 把整站前端调到 Linear / Figma / Codex 风格的专业创作 IDE 水准。

**状态**：**Phase 4 ✅ + Phase 5 ✅ + 衍生项 5/5 ✅ + 收尾扫荡 ✅ + Phase 6 ✅ + Plan Task 6 ✅ + Plan Task 7 ✅ —— 整 plan 全部出库 🎉🎉🎉**

**进度**：
- Phase 4 ✅：17 / 17 子组件 + 1 / 1 legacy fallback + Context 91 → 81 字段。CreatorWorkspace.tsx 4116 → ~1607 行（-61%）。
- Phase 5 ✅：6 / 6 视觉打磨刀（chat 中性白底层级 / SectionHeading / Linear 风 active / Empty 4 卡 / chips 单行 / shadcn Button ×32）。
- 衍生项 ①-⑤ ✅：删 legacy fallback / shadcn Input ×7 / Select ×8 / Checkbox ×12 / Slider ×1。
- 收尾扫荡 ✅：ChatHeader Board onClick / globals.css 孤儿规则清理。
- **Phase 6 暗色模式 ✅**（commits `4d8b16a` / `8ff2b3c` / `bfc98ff`）：
  - `4d8b16a`：ThemeProvider + ThemeToggle 三态切换（亮 / 暗 / 跟随系统），SSR 安全 + ThemeNoFlashScript 抗 FOUC，AppTopNav UtilityNav 加切换按钮
  - `8ff2b3c`：globals.css `.dark` block 扩展覆盖 17 个 legacy var；全量 hex 字面量迁移到 var()（`#ffffff` → `var(--surface)`、`#f8fafc` → `var(--control)`、`#e8eef5` → `var(--bg)` 等共 70+ 处）；3 处 raw `bg-white/8X` Badge → `bg-card/8X`
  - `bfc98ff`：tests/components/theme.test.tsx（6 用例）+ vitest.setup.ts 加 matchMedia polyfill
- **Plan Task 6 移动端结构重排 ✅**（commits `bad24be` / `9ec3201`）：
  - `bad24be`：工作台移动端左 / 底 shadcn Sheet 抽屉接通（汉堡按钮 + 「打开参数面板」），globals.css 加 `[data-mobile-drawer]` 范围样式让 Inspector 在抽屉内可见，creator-shell.test.tsx 加 2 个抽屉用例
  - `9ec3201`：CommunityFeedPage chip 行 mobile 单行横滚 / 详情页主图 mobile ≤ 55vh 让 CTA 首屏可达
- **Plan Task 7 文档收尾 + 全套验收 ✅**（commit `bb08205` + 验收）：
  - docs/14 增加暗色模式 + 移动端两个标准章节
  - docs/17 增加 UI 重构落地后回归章节 + 6 路由人工走查表
  - docs/文档索引.md 加 extraction-map 路径指针
  - README 更新 UI 重构条目 + 技术栈
  - 全套验收通过：`git diff --check` clean / `pnpm lint` ✅ / `pnpm typecheck` ✅ / `pnpm test` 49 files / 220 tests ✅ / `pnpm build` ✅

**整体增减**：CreatorWorkspace.tsx 4116 → ~1607 行（-2509 / -61%），legacy 1244 行整目录出库，shadcn 元件全站收敛，暗色 + 移动端封板。

## 接棒读哪一份

**先读**：`docs/superpowers/plans/2026-05-03-creatorworkspace-extraction-map.md`
顶部 **「📍 下次会话从这里开始」** 章节是行动入口，含开场白、下一刀、铁律、套路。

**辅助**：
- `docs/superpowers/plans/2026-05-02-psypic-ui-system-implementation.md` — Phase 0-8 完整 plan
- `docs/superpowers/specs/2026-05-02-psypic-ui-system-design.md` — 视觉/信息架构 spec
- `docs/superpowers/specs/2026-05-02-codex-chat-studio-design.md` — chat-studio 设计
- `docs/14-视觉与竞品对标标准.md` — 含暗色 + 移动端 UI 验收标准
- `docs/17-测试与验收用例.md` — 含 UI 重构落地后回归 + 6 路由人工走查表

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

## 后续可选项（plan 已完结，下一波由 product 决定）

- 桌面 + 移动端真机走查 6 路由（docs/17 走查表）
- ~~BatchWorkflowPanel state 上 Context（让移动端底抽屉也能展示）~~ ✅ commit `894ad93`：BatchProvider 持有 state + polling，桌面/移动双 mount 共享，222 tests pass
- ~~暗色 polish 跟踪：accent-soft 系字面量（`#f0fdfa` / `#85c7be` / `#e7f3f1` / `#fff5f3` / `#f0b8b1` / `#e6ebf1` / `#e6f4f1` / `#e6ebf1`）~~ ✅ commit `22bda89`：8 处全部走 var()，加 `--accent-border` / `--danger-soft` / `--danger-border` 3 个新 token
- next-themes 迁移：当前自写 ThemeProvider 已足够，若需要更复杂的 cookies-based 持久化或 multi-theme 调色板可考虑迁移

## 常用命令

```bash
pnpm dev               # webpack dev server (默认)
pnpm dev:turbo         # turbopack dev server (备选)
pnpm typecheck         # tsc --noEmit
pnpm lint              # eslint, max-warnings=0
pnpm test              # vitest
pnpm build             # next build
```
