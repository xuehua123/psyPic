# CreatorWorkspace 拆分提取地图（活文档）

## 📍 下次会话从这里开始（READ ME FIRST）

**当前进度**：**plan slug `linear-stirring-acorn` 全部封板** 🎉🎉🎉
- Phase 4 ✅：17 / 17 子组件 + 1 / 1 legacy fallback + Context 91 → 81 字段
- Phase 5 ✅：6 / 6 视觉打磨刀（详见下面 Phase 5 完成清单）
- 衍生项 5/5 ✅：删 legacy fallback / shadcn Input ×7 / Select ×8 / Checkbox ×12 / Slider ×1
- 收尾扫荡 ✅：ChatHeader Board onClick / globals.css 孤儿规则清理
- **Phase 6 暗色模式 ✅**（commits `4d8b16a` / `8ff2b3c` / `bfc98ff`）：ThemeProvider 三态切换 + ThemeNoFlashScript 抗 FOUC + globals.css 全量 hex → CSS var + theme.test.tsx 6 用例
- **Plan Task 6 移动端 ✅**（commits `bad24be` / `9ec3201`）：工作台左 / 底 Sheet 抽屉 + 社区 chip 单行横滚 + 详情主图 mobile ≤ 55vh CTA 首屏可达
- **Plan Task 7 文档 + 全套验收 ✅**（commit `bb08205` + 验收）：docs/14 加暗色 + 移动端两章节、docs/17 加 6 路由走查表、docs/文档索引 加 extraction-map 路径、README 更新；`git diff --check` clean / `pnpm lint` ✅ / `pnpm typecheck` ✅ / `pnpm test` 49 files / 220 tests ✅ / `pnpm build` ✅

`components/creator/CreatorWorkspace.tsx`：4116 → **~1607 行** (-61%)；`components/creator/legacy/` 已整目录删除。
分支 `codex/fix-v1-review-findings`，最新状态：plan 全部出库，封板回归通过。

### 复制这一句开局（→ 粘到新 Claude Code 会话）

```
PsyPic UI 重构 plan slug `linear-stirring-acorn` 已全部封板：
- Phase 4 + Phase 5 + 衍生项 5/5 + 收尾扫荡：CreatorWorkspace 4116 → 1607 行
  （-61%），legacy 1244 行整目录出库，shadcn 元件全站收敛
- Phase 6 暗色模式：ThemeProvider 三态切换（亮 / 暗 / 跟随系统）+
  ThemeNoFlashScript 抗 FOUC + globals.css 全量 hex → CSS var
- Plan Task 6 移动端：工作台左 / 底 Sheet 抽屉，社区 chip 单行横滚，
  详情主图 ≤ 55vh CTA 首屏可达
- Plan Task 7：docs/14 + docs/17 + docs/文档索引 + README 同步，全套
  验收（git diff --check / lint / typecheck / test 220✅ / build）通过

下一波由 product 决定。可选项见 CLAUDE.md「后续可选项」段：
- 桌面 + 移动端真机走查 6 路由（docs/17 走查表）
- BatchWorkflowPanel state 上 Context 让移动端底抽屉也能展示
- 暗色 polish 跟踪：accent-soft 系少量字面量未迁移
- next-themes 迁移（如需 cookies-based 持久化或 multi-theme）
```

### Phase 6 暗色模式落地清单（3 / 3 ✅）

| 刀 | commit | 改动 | 文件 |
| --- | --- | --- | --- |
| P6-1 ✅ | `4d8b16a` | ThemeProvider + ThemeToggle 三态切换 + ThemeNoFlashScript 抗 FOUC + AppTopNav 嵌入 | +2 文件，174 / -2 行 |
| P6-2 ✅ | `8ff2b3c` | globals.css `.dark` block 扩展覆盖 17 legacy var；hex 字面量批量迁移到 var()（70+ 处）；3 处 raw `bg-white/8X` Badge → `bg-card/8X` | 5 文件，96 / -62 行 |
| P6-3 ✅ | `bfc98ff` | tests/components/theme.test.tsx（6 用例）+ vitest.setup.ts 加 matchMedia polyfill；ThemeProvider 重构以满足 react-hooks/set-state-in-effect 规则 | 3 文件，200 / -24 行 |

### Plan Task 6 移动端落地清单（2 / 2 ✅）

| 刀 | commit | 改动 | 文件 |
| --- | --- | --- | --- |
| T6-1 ✅ | `bad24be` | ChatHeader 加 md:hidden 汉堡按钮；CreatorWorkspace 加 mobileSidebarOpen / mobileInspectorOpen state 用 shadcn Sheet 装 ProjectSidebar / Inspector；mobile-bottom-bar「打开参数面板」按钮接 onClick；globals.css 加 `[data-mobile-drawer]` 范围样式；creator-shell.test.tsx 加 2 抽屉用例 | 4 文件，182 / -5 行 |
| T6-2 ✅ | `9ec3201` | CommunityFeedPage chip 行 mobile flex-nowrap + overflow-x-auto；CommunityWorkDetail / LibraryAssetDetail 主图 max-h mobile 55vh 让 CTA 首屏可达 | 3 文件，18 / -13 行 |

### Plan Task 7 文档与验收清单（1 + 验收 ✅）

| 项 | commit / 状态 | 描述 |
| --- | --- | --- |
| docs/14 | `bb08205` | 增加「暗色模式标准（Phase 6 落地后）」+「移动端标准（Plan Task 6 落地后）」两章节 |
| docs/17 | `bb08205` | 增加「UI 重构落地后回归」章节 + 6 路由桌面+移动端人工走查表 |
| docs/文档索引 | `bb08205` | 把 extraction-map 加入「当前有效的 UI 设计与实施文档」表 |
| README | `bb08205` | 增补 UI 重构条目；技术栈 UI 行更新为「Tailwind v4 + shadcn/ui + lucide-react」 |
| `git diff --check` | ✅ | clean |
| `pnpm lint` | ✅ | pass |
| `pnpm typecheck` | ✅ | pass |
| `pnpm test` | ✅ | 49 files / 220 tests pass |
| `pnpm build` | ✅ | next build pass |

### Phase 5 收尾完成清单（6 / 6 ✅）

| 刀 | commit | 改动 | 文件 |
| --- | --- | --- | --- |
| P5-1 ✅ | `c97135b` | ChatTranscript gradient → var(--surface) 纯白，与左右 muted sidebar 形成层级 | globals.css 1 行 |
| P5-2 ✅ | `1d51d54` | 抽 SectionHeading 公共组件（`{icon, title, action?}`），3 处 inspector 替换 | +1 文件，72 / -22 行 |
| P5-3 ✅ | `5949d76` | ProjectSidebar active 删 inset 3px 左竖条 + rgba 边 → 1px accent 实色描边 | globals.css 2 段 |
| P5-4 ✅ | `3573c7d` | ChatEmptyState 删 dead studio-empty-canvas 装饰 → 4 个 mvpTemplates 快捷卡（点击套模板）；CSS 加网格 + mobile 单列；测试用 within() 限定避免同名按钮冲突 | 3 文件，91 / -26 行 |
| P5-5 ✅ | `07d3980` | Composer chips 行 flex-wrap → nowrap + overflow-x: auto，紧凑单行展示 | globals.css 1 段 |
| P5-6 ✅ | `926f71d` | shadcn Button 全站替换 32 处（11 文件），primary→default / secondary→secondary variant；Link / a download 用 asChild 模式；legacy 27 处保留 | 12 文件，109 / -103 行 |

### Phase 6 暗色模式入口（如果 product 排期了）

- `app/globals.css` L60-81 已预埋 `.dark` token（dark mode color scheme）
- 工作内容：在所有 `bg-*` / `text-*` / `border-*` 处加 `dark:` 覆盖；切换 UI 加在 ProjectSidebar 底部或 settings 页
- 风险：现有大量 raw className 无法直接 `dark:`，需要 CSS var 替代或额外 `.dark .xxx` 重载

### 进入项目后第一组动作

```bash
git status                  # 确认在 codex/fix-v1-review-findings、干净
git log --oneline -14       # 看最近 14 个 commit（前 12 个是 Phase 4 第 10-18 刀 + 第 19 刀文档收尾）
ls components/creator/studio/ components/creator/studio/inspector/   # 17 个已抽组件 ✅ + Context
ls lib/creator/             # 共享 helper 模块
pnpm typecheck              # 验证当前状态可编译
```

### 铁律（违反这些上一会话死过一次）

- ❌ `Read CreatorWorkspace.tsx` 不带 `offset + limit`（2694 行整读仍会把后续 turn 推过 32MB request 上限直接挂掉会话）
- ❌ 一个会话内抽 **>3-4 个** ⭐⭐⭐ 组件（transcript 累加爆炸）
- ❌ 抽出 + 视觉重做混在**同一 commit**（视觉留给 Phase 5）
- ❌ 跳过 `pnpm typecheck`
- ❌ `git add -A` / `git add .`（用具体路径，避免误添加敏感文件）
- ❌ 在主壳里 `/compact` 或 `继续` 期望模型重读全文（必爆 32MB）
- ❌ 抽取期间打开浏览器测试 / 拍 playwright 截图（screenshot binary 加速 transcript）

### 抽取套路（已通过 9 次抽取验证）

每个子组件 = 1 commit，步骤：
1. **Grep 当前行号**（文件每抽一刀就会移位，地图行号仅供参考起点）
2. **Read 源区段**（offset+limit，**不读全文**）
3. 在 `components/creator/studio/` 下新建文件（含 `"use client";` + JSDoc 注释来源行号 + 组件目的）
4. `CreatorWorkspace.tsx` 加 import + 替换 inline JSX 为 `<X />`
5. 跑 `pnpm typecheck`
6. **更新本地图**：表格 # 列改为 ✅、行号改 `(已抽)` + 实际行数；推荐顺序勾掉
7. 顺手清理 CreatorWorkspace 中确认未再用的 lucide icons（grep 验证后再删）
8. commit（HEREDOC 格式，标题含 "Phase 4 第 N 刀"）+ push origin

---

## 文件高层结构（截至 2026-05-03，9 次抽取后）

| 区段 | 行号 | 内容 | 改动策略 |
| --- | --- | --- | --- |
| Imports + types | L1-132 | lib/creator helper / lucide / react / 内部常量（maskCanvasSize 等） | 不动；抽完 lucide icon 时逐个清未用 |
| State + useMemo + useRef | L133-310 | ~30 useState + 2 useRef + 7 useMemo | 主壳保留；子组件经 props 或 Context 读取 |
| useEffect | L316-518 | 6 个 effect（生命周期、SSE、轮询） | 主壳保留 |
| Helper functions | L739-~1493 | 内联函数（事件处理 / 业务逻辑） | 已部分抽到 `lib/creator/*.ts`；剩下的随子组件迁出 |
| **chat-studio JSX** | 主壳唯一 return | 三栏渲染（ChatHeader / ProjectSidebar / VersionStream / Branch / NodeInspector / CommunityPublish 已抽出）；2026-05-03 衍生项第 1 刀已删 `useCodexChatStudio` flag + legacy else 分支 | 仍是主子组件源 |

> 行号每抽一刀都会移位。要查最新位置：`Grep pattern="<className-anchor>" path="components/creator/CreatorWorkspace.tsx"`

## State 清单（30+ useState）

| 分组 | 变量 |
| --- | --- |
| Mode/template/prompt | `mode`, `selectedTemplateId`, `prompt`, `n`, `outputCompression`, `advancedOpen`, `moderation` |
| Generation | `streamEnabled`, `partialImageCount`, `isGenerating`, `errorMessage`, `partialImages`, `currentTask` |
| Prompt assist | `isAssistingPrompt` |
| History/favorites | `historyItems`, `promptFavorites` |
| Library | `libraryItems`, `libraryStatus`, `libraryFavoriteOnly`, `libraryTagFilter`, `publishAssetId`, `publishingAssetId`, `publishMessages` |
| Reference/mask | `referenceImages`, `maskEnabled`, `maskMode`, `maskBrushSize` (+ refs `maskCanvasRef`, `maskDrawingRef`) |
| Version graph | `versionNodes`, `activeNodeId`, `forkParentId`, `nodeProjectIds` |

## useMemo（当前行号）

| 名称 | 行号 |
| --- | --- |
| `referencePreviews` | 183 |
| `mvpTemplates` | 213 |
| `selectedTemplate` | 217 |
| `sidebarProjects` | 223 |
| `activeProjectGroup` | 258 |
| `displayedVersionNodes` | 271 |
| `activeVersionNode` | 301 |

## 关键 helper 函数（仍在主壳，按子组件需要随之搬出 / 转 Context）

| 函数 | 行号 | 用途 |
| --- | --- | --- |
| `commitGenerationResult` | 739 | SSE 完成回调，写入版本节点 + library |
| `buildGenerationRequest` | 802 | 把 UI state 组装为 ImageGenerationParams |
| `applyPromptFavorite` | 909 | 套用 prompt 收藏 |
| `handleReferenceInput / Drop / Paste` | 947+ | 参考图三种输入入口 |
| `selectReferenceImages / removeReferenceImage` | ~970-985 | 参考图列表管理 |
| `resetMaskCanvas / invertMaskCanvas` | ~990-1010 | mask 操作 |
| `startMaskStroke / continueMaskStroke / stopMaskStroke / drawMaskStroke` | ~1020-1075 | mask 涂抹 |
| `selectCommercialTemplate / updateTemplateFieldValue / applySelectedTemplate / applyTemplateRender / selectCommercialSize / renderTemplateField` | ~1080-1400 | 模板操作 |
| `defaultCommunityTitle / readFormString` | ~1400+ | 发布/表单工具 |
| `restoreVersionNodeParams / returnToVersionNode / startVersionFork` | ~1430+ | 版本流操作 |
| `selectProject / selectConversation` | ~1470+ | 项目/对话切换 |
| `submitGeneration / cancelCurrentTask / refreshTaskStatus` | (散落) | 生成主流程 |
| `handleResultAsReference / copyPrompt / handleHistoryContinueEdit / handleLibraryContinueEdit / toggleLibraryFavorite / publishLibraryItem / loadServerLibrary` | (散落) | 列表项交互 |

> 行号每抽一刀会偏移；用 `Grep pattern="function <name>"` 重新定位。

## 子组件抽取清单（9 / 17 ✅）

⭐ 简单（无状态/纯展示）/ ⭐⭐ 中等（少量 state、几个 callback）/ ⭐⭐⭐ 复杂（多 state + 多 effect + 内部 helper）。

| # | 组件 | 行号 | 主要 state/handler 依赖 | 难度 | 行数 |
| --- | --- | --- | --- | --- | --- |
| ✅ | `studio/ChatEmptyState.tsx` | (已抽) | `activeProject.{emptyTitle,emptyDescription}` | ⭐ | 44 |
| ✅ | `studio/PartialPreviewStrip.tsx` | (已抽) | `partialImages` | ⭐ | 42 |
| ✅ | `studio/TaskStatusStrip.tsx` | (已抽) | `currentTask`, `isGenerating`, refresh/cancel/retry handlers | ⭐⭐ | 105 |
| ✅ | `studio/ChatHeader.tsx` | (已抽) | `currentConversationTitle`, `forkParentId` | ⭐ | 39 |
| ✅ | `studio/NodeInspectorSection.tsx` | (已抽) | `activeVersionNode` | ⭐ | 44 |
| ✅ | `studio/BranchMapSection.tsx` | (已抽) | `projectVersionNodes`, `activeNodeId` | ⭐⭐ | 56 |
| ✅ | `studio/VersionStreamSection.tsx` | (已抽) | `projectVersionNodes`, `activeNodeId`, `forkParentId`, return/restore/fork handlers | ⭐⭐ | 113 |
| ✅ | `studio/CommunityPublishPanel.tsx` | (已抽) | `item: LibraryAssetItem`, `defaultTitle`, `isPublishing`, `onSubmit` | ⭐⭐ | 98 |
| ✅ | `studio/ProjectSidebar.tsx` | (已抽) | `sidebarProjects`, `activeProjectId`, `activeConversationId`, `activeProjectTitle`, select handlers | ⭐⭐ | 159 |
| ✅ | `studio/ChatTurn.tsx` | (已抽) | `displayedVersionNodes`(item), `activeNodeId`, `formatVersionNodeTime`, `summarizeNodeParams`, `returnToVersionNode`, `restoreVersionNodeParams`, `startVersionFork`, `copyPrompt`, `submitGeneration`, `handleResultAsReference` | ⭐⭐⭐ | 153 |
| ✅ | `studio/ChatTranscript.tsx` | (已抽) | 包裹 ChatEmptyState + ChatTurn + TaskStatusStrip 编排 | ⭐⭐ | 78 |
| ✅ | `studio/Composer.tsx` | (已抽) | 全部走 Context（消费 14 个扩展字段：prompt/setPrompt/mode/size/quality/outputFormat/n/streamEnabled/forkParentId/errorMessage/isAssistingPrompt/isGenerating/optimizePrompt/saveCurrentPromptFavorite + submitGeneration） | ⭐⭐⭐ | 107 |
| ✅ | `studio/inspector/Inspector.tsx` | (已抽) | children pattern 容器，无 state/handler 依赖 | ⭐⭐ | 29 |
| ✅ | `studio/inspector/ParamsSection.tsx` | (已抽) | 全部走 Context（22 字段：mode/size/quality/n/format/streamEnabled 6 read+6 write + 8 advanced 字段 + selectedCommercialSizeId + selectCommercialSize） | ⭐⭐⭐ | 255 |
| ✅ | `studio/inspector/ReferenceSection.tsx` | (已抽，含 mask-editor inline) | 全部走 Context（19 字段：referenceImages/Previews/Image + 4 input handler + maskEnabled/Mode/BrushSize + 6 mask handler + maskCanvasRef） | ⭐⭐⭐ | 198 |
| ➖ | ~~`studio/inspector/MaskEditor.tsx`~~ | (合并入 ReferenceSection) | mask-editor 强依赖 referenceImage 条件，独立组件价值不大 → 跳过原计划第 17 刀 | — | — |
| ✅ | `studio/inspector/TemplatesSection.tsx` | (已抽，含 renderTemplateField inline) | 全部走 Context（6 字段：mvpTemplates / selectedTemplate / templateFieldValues / updateTemplateFieldValue / selectCommercialTemplate / applySelectedTemplate） | ⭐⭐⭐ | 144 |
| ✅ | `studio/inspector/LibrarySection.tsx` | (已抽) | 全部走 Context（19 字段：libraryItems/Status/FavoriteOnly/TagFilter/promptFavorites/historyItems/publish 状态 4 字段 + 7 个 handler） | ⭐⭐⭐ | 246 |

> `legacy/LegacyCreatorWorkspace.tsx`（Phase 4 第 19 刀曾抽出 1244 行）已于 2026-05-03 衍生项第 1 刀整目录删除。

## 推荐抽取顺序

**第一波（叶子）**：✅ 5/5 全部完成（ChatEmptyState / PartialPreviewStrip / TaskStatusStrip / ChatHeader / NodeInspectorSection）

**第二波（含 Inspector 中段）**：6/9 完成
- ✅ BranchMapSection / VersionStreamSection / CommunityPublishPanel / ProjectSidebar / ChatTurn / ChatTranscript
- ⏳ ReferenceSection / MaskEditor / LibrarySection

**第三波（重头戏）**：Context 已建（第 10 刀 ✅）+ 多次扩展（13-A、15-A、16、17、18 ✅），7/7 完成 ✅
- ✅ `studio/CreatorStudioContext.tsx` — 单 Context，81 个字段
- ✅ ChatTurn — 消费 Context 7 字段（第 11 刀）
- ✅ Composer — 消费 Context 14 字段（第 13 刀-B）
- ✅ Inspector — children pattern 容器壳（第 14 刀）
- ✅ ParamsSection — 消费 Context 22 字段（第 15 刀-B）
- ✅ ReferenceSection — 消费 Context 19 字段（第 16 刀，含 mask-editor inline）
- ✅ TemplatesSection — 消费 Context 6 字段（第 17 刀，含 renderTemplateField inline）
- ✅ LibrarySection — 消费 Context 19 字段（第 18 刀）

**结论**：17 / 17 子组件全部抽完 ✅ + 1 / 1 legacy fallback ✅ + Context 91 字段。**Phase 4 整体收尾完成 🎉**，主壳 3794 → 1607 行（-57.6%）。下一波 → Phase 5 视觉打磨（每组件单独 commit，参考末尾"视觉打磨（Phase 5）插槽"段）。

**结论**：**Phase 4 全部完成 ✅** — 17 / 17 子组件 + 1 / 1 legacy fallback。下一波是 Phase 5 视觉打磨。

## CreatorStudioContext 设计建议

> **状态**：✅ 已实现 — `components/creator/studio/CreatorStudioContext.tsx`（67 行）。
> 第一版只暴露 ChatTurn 需要的 7 字段；下文伪代码是**初稿**，留作扩展时参考。
> 实际签名以源文件为准；新增字段时复制此模板再加。

把以下 state 与 dispatcher 暴露在 Context 中（**不需要一次到位**，按下一个组件需要逐渐添加）：

```typescript
type CreatorStudioContextValue = {
  // version graph
  activeNodeId: string | null;
  displayedVersionNodes: CreatorVersionNode[];
  returnToVersionNode: (node: CreatorVersionNode) => void;
  restoreVersionNodeParams: (node: CreatorVersionNode) => void;
  startVersionFork: (node: CreatorVersionNode) => void;
  // generation flow
  submitGeneration: () => void;
  isGenerating: boolean;
  copyPrompt: () => void;
  handleResultAsReference: (image: GenerationImage) => Promise<void>;
  // ... 按需扩展
};
```

主壳 `<CreatorStudioContext.Provider value={...}>` 包住整个 chat-studio 渲染区即可（L1506-2350 段）。

是否拆多个 Context（避免 re-render 性能问题）：先单 Context，等 React DevTools 出现明显 wasted render 再拆。

## 视觉打磨（Phase 5）已完成清单

子组件抽完后的视觉收尾，6 / 6 ✅（每条对应一个 commit）：

- ✅ ChatEmptyState：删 dead `studio-empty-canvas` 装饰画布；改成 4 个常用模板快捷卡网格（P5-4 `3573c7d`）
- ✅ ChatTranscript：去掉 gradient，改 var(--surface) 纯白底（P5-1 `c97135b`）
- ✅ ProjectSidebar：删 chunky 左竖条 inset，改细 1px accent 描边（P5-3 `5949d76`）
- ✅ Composer：上下文 chips 收敛单行（flex-wrap nowrap + overflow-x auto）（P5-5 `07d3980`）
- ✅ Inspector：抽 SectionHeading 公共组件 `<SectionHeading icon title action />` 统一（P5-2 `1d51d54`）
- ✅ 全站 `primary-button|secondary-button` → shadcn `<Button>` 替换 32 处（P5-6 `926f71d`，legacy 27 处保留）

## 已抽组件清单（速查）

```
components/creator/studio/
├── BranchMapSection.tsx          (56 行, ⭐⭐)
├── ChatEmptyState.tsx            (44 行, ⭐)
├── ChatHeader.tsx                (39 行, ⭐)
├── ChatTranscript.tsx            (78 行, ⭐⭐ — 编排 ChatEmpty + ChatTurn.map + TaskStatus + PartialPreview)
├── ChatTurn.tsx                  (153 行, ⭐⭐⭐ — 消费 Context 7 字段)
├── CommunityPublishPanel.tsx     (98 行, ⭐⭐)
├── Composer.tsx                  (107 行, ⭐⭐⭐ — 消费 Context 14 字段)
├── CreatorStudioContext.tsx      (200 行, infra — 91 字段，含第 19 刀新加 11 字段)
├── NodeInspectorSection.tsx      (44 行, ⭐)
├── PartialPreviewStrip.tsx       (42 行, ⭐)
├── ProjectSidebar.tsx            (159 行, ⭐⭐)
├── TaskStatusStrip.tsx           (105 行, ⭐⭐)
├── VersionStreamSection.tsx     (113 行, ⭐⭐)
└── inspector/
    ├── Inspector.tsx             (29 行, ⭐⭐ — children pattern 外壳)
    ├── LibrarySection.tsx        (246 行, ⭐⭐⭐ — 消费 Context 19 字段)
    ├── ParamsSection.tsx         (255 行, ⭐⭐⭐ — 消费 Context 22 字段)
    ├── ReferenceSection.tsx      (198 行, ⭐⭐⭐ — 消费 Context 19 字段，含 mask-editor inline)
    └── TemplatesSection.tsx      (144 行, ⭐⭐⭐ — 消费 Context 6 字段，含 renderTemplateField inline)

lib/creator/
├── api-error.ts
├── content-type.ts
├── edit-form.ts
├── projects.ts                   (新, creator 项目元数据 + Sidebar 派生类型)
├── sse-parser.ts
├── task-status.ts
├── template-render.ts
├── types.ts
└── version-graph.ts              (含 summarizeNodeParams、formatVersionNodeTime helper)
```
