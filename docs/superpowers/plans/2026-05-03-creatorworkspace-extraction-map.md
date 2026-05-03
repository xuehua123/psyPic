# CreatorWorkspace 拆分提取地图（活文档）

## 📍 下次会话从这里开始（READ ME FIRST）

**当前进度**：**9 / 17** 子组件 + **0 / 1** legacy fallback。
`components/creator/CreatorWorkspace.tsx`：3794 → **3358 行** (-436，-11.5%)。
分支 `codex/fix-v1-review-findings`，已同步 origin（最新 `9fc30e1`）。

### 复制这一句开局（→ 粘到新 Claude Code 会话）

```
接着推 PsyPic UI 重构 Phase 4。先读 docs/superpowers/plans/2026-05-03-
creatorworkspace-extraction-map.md 顶部"📍 下次会话从这里开始"section
按指示走；不要整读 components/creator/CreatorWorkspace.tsx。
```

### 下一刀（按依赖顺序）

1. **第 10 刀：建 `components/creator/studio/CreatorStudioContext.tsx`** — 把共享 state + dispatcher 收纳到 React Context。**理由**：剩下的 ChatTurn / Composer / Inspector 等组件每个都依赖 5-10 个共享 state/handler，继续 prop drilling 会让每个 import 写出 8-10 行 JSX 调用，且未来加新 state 要改所有调用方。
   - **暴露什么**：见下文「## State 清单」+「## 关键 helper 函数」两节。建议先暴露 ChatTurn 用到的 8 个 handler，其它后续按需加。
   - **不要试图一次到位** —— 暴露多少看下一个组件需要多少。
   - 跑 `pnpm typecheck`，commit "建 CreatorStudioContext skeleton (Phase 4 第 10 刀)"。

2. **第 11 刀：抽 `studio/ChatTurn.tsx`** — 第二波最复杂的叶子（⭐⭐⭐），但抽完后 ChatTranscript 才能裸装。Context 让 prop 接口干净。

3. 然后按"## 推荐抽取顺序"第三波继续。

### 进入项目后第一组动作

```bash
git status                  # 确认在 codex/fix-v1-review-findings、干净
git log --oneline -10       # 看最近 10 个 commit（前 9 个是本次 Phase 4）
ls components/creator/studio/   # 9 个已抽组件
ls lib/creator/             # 共享 helper 模块
pnpm typecheck              # 验证当前状态可编译
```

### 铁律（违反这些上一会话死过一次）

- ❌ `Read CreatorWorkspace.tsx` 不带 `offset + limit`（3358 行整读会把后续 turn 推过 32MB request 上限直接挂掉会话）
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
| `useCodexChatStudio` 判定 | L1495-1506 | env 切换新旧 JSX | 主壳保留 |
| **New chat-studio JSX** | **L1506-~2350** | 新版三栏渲染（ChatHeader / ProjectSidebar / VersionStream / Branch / NodeInspector / CommunityPublish 已抽出） | 仍是主子组件源 |
| Legacy JSX | L2353-3358 | 旧三栏 fallback | 整段抽到 `legacy/LegacyCreatorWorkspace.tsx`（地图最后一刀） |

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
| 1 | `studio/ChatTurn.tsx` | 用 grep `chat-turn` 找 | `displayedVersionNodes`(item), `activeNodeId`, `formatVersionNodeTime`, `summarizeNodeParams`, `returnToVersionNode`, `restoreVersionNodeParams`, `startVersionFork`, `copyPrompt`, `submitGeneration`, `handleResultAsReference` | ⭐⭐⭐ | ~200 |
| 2 | `studio/ChatTranscript.tsx` | 用 grep `chat-transcript` 找 | 包裹 ChatEmptyState + ChatTurn + TaskStatusStrip 编排 | ⭐⭐ | ~50 |
| 3 | `studio/Composer.tsx` | 用 grep `chat-composer` 找 | `prompt`, `setPrompt`, `mode`, `referenceImages`, `n`, `submitGeneration`, `applyPromptFavorite`, etc. | ⭐⭐⭐ | ~200 |
| 4 | `studio/inspector/Inspector.tsx` | 用 grep `inspector-scroll` 找 | 容器 + section 编排 | ⭐⭐ | ~80 |
| 5 | `studio/inspector/ParamsSection.tsx` | 用 grep `<section className="inspector-section">` 第 1 处 | `mode`, `n`, `selectedTemplate`, `outputCompression`, `streamEnabled`, `partialImageCount`, `advancedOpen` | ⭐⭐⭐ | ~250 |
| 6 | `studio/inspector/ReferenceSection.tsx` | 用 grep `reference-dropzone` 找 | `referenceImages`, `referencePreviews`, ref handlers；包嵌 MaskEditor | ⭐⭐ | ~150 |
| 7 | `studio/inspector/MaskEditor.tsx` | 用 grep `mask-editor` 找（有 2 处，新版在前） | `maskEnabled`, `maskMode`, `maskBrushSize`, mask ref & 6 个 stroke handler | ⭐⭐⭐ | ~200 |
| 8 | `studio/inspector/TemplatesSection.tsx` | 用 grep `commercial-template-list` 找 | `selectedTemplateId`, `mvpTemplates`, template field handlers, `renderTemplateField` | ⭐⭐⭐ | ~250 |
| 9 | `studio/inspector/LibrarySection.tsx` | 用 grep `素材与历史` 找 | `libraryItems`, `libraryStatus`, `libraryFavoriteOnly`, `libraryTagFilter`, `historyItems`, `promptFavorites`, 9+ handler | ⭐⭐ | ~190 |
| - | `legacy/LegacyCreatorWorkspace.tsx` | grep `legacy-workbench-shell`，整段往下到文件末 | 整段 legacy JSX + 重复 inspector sections；接口同主壳 | ⭐⭐ | ~1000 |

## 推荐抽取顺序

**第一波（叶子）**：✅ 5/5 全部完成（ChatEmptyState / PartialPreviewStrip / TaskStatusStrip / ChatHeader / NodeInspectorSection）

**第二波（含 Inspector 中段）**：4/9 完成
- ✅ BranchMapSection / VersionStreamSection / CommunityPublishPanel / ProjectSidebar
- ⏳ ChatTurn / ChatTranscript / ReferenceSection / MaskEditor / LibrarySection

**第三波（重头戏，必须先建 Context）**：0/5 未开始
- ChatTurn → 必须先建 Context（需要 8 个 handler）
- Composer / ParamsSection / TemplatesSection（每个 5-10 个 state）
- Inspector wrapper（最后包装）
- LegacyCreatorWorkspace（最后整段抽，会一次性 -1000 行）

**结论**：下一会话第一刀 → 建 `CreatorStudioContext`，然后抽 ChatTurn。

## CreatorStudioContext 设计建议

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

## 视觉打磨（Phase 5）插槽

子组件抽完后做（每组件单独 commit）：
- ChatEmptyState：删 `studio-empty-canvas` 装饰画布；改成 4 个常用模板快捷卡网格
- ChatTranscript：去掉 22px dotted 背景
- ProjectSidebar：浅色 + accent 描边 active（spec 要求）
- Composer：上下文 chips 简化为单行
- Inspector：所有 section 用 `<SectionHeading icon title action />` 统一
- 全站 grep `primary-button|secondary-button|ghost-button` → 替换为 shadcn `<Button>`

## 已抽组件清单（速查）

```
components/creator/studio/
├── BranchMapSection.tsx          (56 行, ⭐⭐)
├── ChatEmptyState.tsx            (44 行, ⭐)
├── ChatHeader.tsx                (39 行, ⭐)
├── CommunityPublishPanel.tsx     (98 行, ⭐⭐)
├── NodeInspectorSection.tsx      (44 行, ⭐)
├── PartialPreviewStrip.tsx       (42 行, ⭐)
├── ProjectSidebar.tsx            (159 行, ⭐⭐)
├── TaskStatusStrip.tsx           (105 行, ⭐⭐)
└── VersionStreamSection.tsx      (113 行, ⭐⭐)

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
