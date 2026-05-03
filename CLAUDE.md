# PsyPic 项目 · Claude Code 入口

> 自动加载：任何 Claude Code 会话进入本仓库时会读这份。
> 这里只放**当前正在进行的工作上下文**与**关键文档指针**，不重复代码已经表达的内容。

## 当前重点工作

**PsyPic UI 全面深度优化**（plan slug `linear-stirring-acorn`）—— 把整站前端调到 Linear / Figma / Codex 风格的专业创作 IDE 水准。

**正在进行**：Phase 4 — 把 4116 行的 `components/creator/CreatorWorkspace.tsx` 拆为 1 个 ≤300 行主壳 + 17 个语义子组件 + 1 个 legacy fallback。

**进度**：9 / 17 子组件完成，CreatorWorkspace.tsx **3358 行**（起点 3794）。下一刀 → 建 `CreatorStudioContext`，再抽 ChatTurn。

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

⚠️ **绝对不要 `Read` 整个文件** —— 3358 行整读会让 transcript 突破 32MB request 上限直接挂掉会话（上一会话因此死过一次）。

正确套路：
1. `Grep` 找 className anchor 拿当前行号
2. `Read` 带 `offset + limit` 只读相关区段（30-100 行）
3. 一个子组件 = 一个 commit
4. 改完跑 `pnpm typecheck`，再 commit

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
