# PsyPic 项目 · Claude Code 入口

> 自动加载：任何 Claude Code 会话进入本仓库时会读这份。
> 这里只放**当前正在进行的工作上下文**与**关键文档指针**，不重复代码已经表达的内容。

## 当前重点工作

**PsyPic UI 全面深度优化**（plan slug `linear-stirring-acorn`）—— 把整站前端调到 Linear / Figma / Codex 风格的专业创作 IDE 水准。

**正在进行**：Phase 5 ✅ **已收尾** + 衍生项 3/4 ✅（① 删 legacy fallback + 移除 useCodexChatStudio flag；② shadcn Input 全站替换 7 处；③ shadcn Select 全站替换 8 处 + Radix polyfills 入 vitest.setup）。下一波 → **Phase 6 暗色模式**（按 spec 规划，CSS var 已预埋 `.dark` token），或剩下 1 个原始衍生项（ChatHeader Board onClick）+ 收尾扫荡（Checkbox 12 处需装 `@radix-ui/react-checkbox` / Slider 1 处需装 `@radix-ui/react-slider` / `globals.css` form rule orphan 清理）。

**进度**：
- Phase 4 ✅：17 / 17 子组件 + 1 / 1 legacy fallback + Context 91 字段。CreatorWorkspace.tsx **1607 行**（起点 4116 / 3794 抽刀基线）。
- Phase 5 ✅：6 / 6 视觉打磨刀（chat 区中性白底层级 / SectionHeading 收敛 / Linear 风 active / Empty 4 卡 / chips 单行 / shadcn Button 32 处替换）。
- 衍生项 ① ✅：2026-05-03 删 LegacyCreatorWorkspace + 移除 useCodexChatStudio flag。CreatorWorkspace.tsx 1607 → ~1593 行；`components/creator/legacy/` 整目录删除；Context 91 → 81 字段。
- 衍生项 ② ✅：2026-05-03 shadcn Input 全站替换 7 处 (BatchWorkflowPanel / CommunityPublishPanel / LibrarySection / ParamsSection ×2 / ReferenceSection / TemplatesSection)。零测试改动。
- 衍生项 ③ ✅：2026-05-04 shadcn Select 全站替换 8 处 (ParamsSection ×6 / CommunityPublishPanel / TemplatesSection) + 5 处测试改造（selectOptions/toHaveValue → click + getByRole + toHaveTextContent 模式）+ vitest.setup.ts 加 Radix popover polyfills。
- 下一步 → Phase 6 暗色模式（待 product 排期；可参考 globals.css L60-81 已预埋的 .dark token），或收尾扫荡（Checkbox/Slider 都需先装 Radix 依赖再 scaffold ui 组件，ChatHeader Board onClick 是小颗粒可顺手并入）。

## 接棒读哪一份

**先读**：`docs/superpowers/plans/2026-05-03-creatorworkspace-extraction-map.md`
顶部 **「📍 下次会话从这里开始」** 章节是行动入口，含开场白、下一刀、铁律、套路。

**辅助**：
- `docs/superpowers/plans/2026-05-02-psypic-ui-system-implementation.md` — Phase 0-8 完整 plan
- `docs/superpowers/specs/2026-05-02-psypic-ui-system-design.md` — 视觉/信息架构 spec
- `docs/superpowers/specs/2026-05-02-codex-chat-studio-design.md` — chat-studio 设计

## 项目硬约束（出自 spec / plan）

- **TS strict mode**，pnpm 包管理
- 全局只用 **Tailwind v4 + shadcn/ui** 元件（已 Phase 0 装好）；新代码不写 raw `primary-button` className
- 主导航**严格 2 项**（工作台 / 灵感社区）；spec 命令不要把素材/模板/任务塞进顶栏
- **不引入新状态库**（不上 Zustand / Jotai，用 React Context）
- **不引入新图标库**（继续 lucide-react）
- 所有改动必须 `pnpm typecheck` 通过；建议 commit 前还跑 `pnpm lint && pnpm test`

## 与 CreatorWorkspace.tsx 打交道时

⚠️ **绝对不要 `Read` 整个文件** —— 当前 ~1593 行整读会让 transcript 单 turn 体积过大；Phase 4 期间 3358 行版本曾让上一会话死过一次（突破 32MB 单 request 上限）。

正确套路：
1. `Grep` 找 className anchor 拿当前行号
2. `Read` 带 `offset + limit` 只读相关区段（30-100 行）
3. 一个改动 = 一个 commit
4. 改完跑 `pnpm typecheck`（建议加 `pnpm lint`），再 commit

## 不动的边界

- 不改 Sub2API 协议、API 契约、数据模型
- 不动 `prisma/`、`scripts/`
- 不在本轮做 i18n
- 不在 Phase 6 之前做暗色模式

## 常用命令

```bash
pnpm dev               # webpack dev server (默认)
pnpm dev:turbo         # turbopack dev server (备选)
pnpm typecheck         # tsc --noEmit
pnpm lint              # eslint, max-warnings=0
pnpm test              # vitest
pnpm build             # next build
```
