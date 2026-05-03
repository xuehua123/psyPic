# CreatorWorkspace 拆分提取地图（活文档）

> 服务于 plan `linear-stirring-acorn` 的 Phase 4：把 `components/creator/CreatorWorkspace.tsx` 从 3778 行拆为 1 个 ≤300 行主壳 + 17 个语义子组件 + 1 个 legacy fallback。
>
> **更新规则**：每完成一个子组件抽取，就要回到本文档把对应行号 / 进度勾掉。**绝对不要**让下一个会话从头扫整个文件。

## 文件高层结构（截至 2026-05-03，ChatEmptyState 抽取后）

| 区段 | 行号 | 内容 | 改动策略 |
| --- | --- | --- | --- |
| Imports + types | L1-170 | lib/creator helper / lucide / react hooks / 内部类型 | 不动，子组件抽出后再删多余 imports |
| State 声明 | L171-249 | ~30 useState + 2 useRef + 7 useMemo | 主壳保留；子组件经 props 或 Context 读取 |
| useEffect | L354-518 | 6 个 effect（生命周期、SSE、轮询） | 主壳保留 |
| Helper functions | L777-1538 | ~30 个 inline 函数（事件处理 / 业务逻辑） | 已部分抽到 `lib/creator/*.ts`；剩下的随子组件迁出 |
| `useCodexChatStudio` 判定 | L1540-1551 | env 切换新旧 | 主壳保留 |
| **New chat-studio JSX** | **L1551-2768** | 新版三栏渲染 | 全部子组件源 |
| Legacy JSX | L2773-3794 | 旧三栏 fallback | 整段抽到 `legacy/LegacyCreatorWorkspace.tsx` |

## State 清单（30+ useState）

| 分组 | 变量 |
| --- | --- |
| Mode/template/prompt | `mode`, `selectedTemplateId`, `prompt`, `n`, `outputCompression`, `advancedOpen` |
| Generation | `streamEnabled`, `partialImageCount`, `isGenerating`, `errorMessage`, `partialImages`, `currentTask` |
| Prompt assist | `isAssistingPrompt` |
| History/favorites | `historyItems`, `promptFavorites` |
| Library | `libraryItems`, `libraryStatus`, `libraryFavoriteOnly`, `libraryTagFilter`, `publishAssetId`, `publishingAssetId`, `publishMessages` |
| Reference/mask | `referenceImages`, `maskEnabled`, `maskMode`, `maskBrushSize` (+ refs `maskCanvasRef`, `maskDrawingRef`) |
| Version graph | `versionNodes`, `activeNodeId`, `forkParentId`, `nodeProjectIds` |

## useMemo

| 名称 | 行号 |
| --- | --- |
| `referencePreviews` | 221 |
| `mvpTemplates` | 251 |
| `selectedTemplate` | 255 |
| `sidebarProjects` | 261 |
| `activeProjectGroup` | 296 |
| `displayedVersionNodes` | 309 |
| `activeVersionNode` | 339 |

## 子组件抽取清单

行号是**当前**（post-ChatEmptyState）大致区间。⭐ 简单（无状态/纯展示）/ ⭐⭐ 中等（少量 state、几个 callback）/ ⭐⭐⭐ 复杂（多 state + 多 effect + 内部 helper）。

| # | 组件 | 行号 | 主要 state/handler 依赖 | 难度 | 目标行数 |
| --- | --- | --- | --- | --- | --- |
| ✅ | `studio/ChatEmptyState.tsx` | (已抽) | `activeProject.{emptyTitle,emptyDescription}` | ⭐ | 44 |
| ✅ | `studio/PartialPreviewStrip.tsx` | (已抽) | `partialImages` | ⭐ | 42 |
| ✅ | `studio/TaskStatusStrip.tsx` | (已抽) | `currentTask`, `isGenerating`, refresh/cancel/retry handlers | ⭐⭐ | 105 |
| 3 | `studio/ChatTurn.tsx` | ~L1700-1815 | `displayedVersionNodes`(item), `activeNodeId`, `formatVersionNodeTime`, `summarizeNodeParams`, `returnToVersionNode`, `restoreVersionNodeParams`, `startVersionFork`, `copyPrompt`, `submitGeneration`, `handleResultAsReference` | ⭐⭐⭐ | ~200 |
| 4 | `studio/ChatTranscript.tsx` | ~L1693-1881 | 包裹 ChatEmptyState + ChatTurn + TaskStatusStrip 编排 | ⭐⭐ | ~50 |
| ✅ | `studio/ChatHeader.tsx` | (已抽) | `currentConversationTitle`, `forkParentId` | ⭐ | 39 |
| 6 | `studio/Composer.tsx` | ~L1898-1967 | `prompt`, `setPrompt`, `mode`, `referenceImages`, `n`, `submitGeneration`, `applyPromptFavorite`, etc. | ⭐⭐⭐ | ~200 |
| 7 | `studio/ProjectSidebar.tsx` | ~L1561-1683 | `sidebarProjects`, `activeProjectId`, `activeConversationId`, `selectProject`, `selectConversation` | ⭐⭐ | ~250 |
| 8 | `studio/inspector/Inspector.tsx` | ~L1968-2768 | 容器 + section 编排 | ⭐⭐ | ~80 |
| 9 | `studio/inspector/ParamsSection.tsx` | ~L1968-2163 | `mode`, `n`, `selectedTemplate`, `outputCompression`, `streamEnabled`, `partialImageCount`, `advancedOpen` | ⭐⭐⭐ | ~250 |
| 10 | `studio/inspector/ReferenceSection.tsx` | ~L2163-2218 | `referenceImages`, `referencePreviews`, ref handlers | ⭐⭐ | ~150 |
| 11 | `studio/inspector/MaskEditor.tsx` | ~L2218-~2270 (mask sub-block) | `maskEnabled`, `maskMode`, `maskBrushSize`, mask ref & 6 个 stroke handler | ⭐⭐⭐ | ~200 |
| 12 | `studio/inspector/TemplatesSection.tsx` | ~L2270-2351 | `selectedTemplateId`, `mvpTemplates`, template field handlers, `renderTemplateField` (L1184) | ⭐⭐⭐ | ~250 |
| 13 | `studio/inspector/VersionStreamSection.tsx` | L2352-2428 | `versionNodes`, `displayedVersionNodes`, `activeVersionNode`, version handlers | ⭐⭐ | ~150 |
| 14 | `studio/inspector/BranchMapSection.tsx` | L2429-2462 | `versionNodes`, branch graph 数据 | ⭐⭐ | ~100 |
| 15 | `studio/inspector/NodeInspectorSection.tsx` | L2463-~2479 | `activeVersionNode` | ⭐ | ~100 |
| 16 | `studio/inspector/LibrarySection.tsx` | L2533-2622 | `libraryItems`, `libraryStatus`, `libraryFavoriteOnly`, `libraryTagFilter`, `historyItems` | ⭐⭐ | ~150 |
| 17 | `studio/inspector/CommunityPublishPanel.tsx` | L2623-~2710 | `publishAssetId`, `publishingAssetId`, `publishMessages`, publish handlers | ⭐⭐ | ~120 |
| 18 | `legacy/LegacyCreatorWorkspace.tsx` | L2773-3794 | 整段 legacy JSX + 重复 inspector sections；接口同主壳 | ⭐⭐ | ~1100 |

## 推荐抽取顺序

**第一波：纯叶子（独立、低风险，建议本会话或下个会话连做）**
1. ✅ ChatEmptyState
2. ✅ PartialPreviewStrip
3. ✅ TaskStatusStrip
4. ✅ ChatHeader
5. NodeInspectorSection ⭐

**第二波：中等（在抽前先建 Context 共享 state）**
6. ChatTurn ⭐⭐⭐
7. ProjectSidebar ⭐⭐
8. ChatTranscript ⭐⭐ (合并叶子)
9. ReferenceSection / MaskEditor ⭐⭐⭐
10. VersionStreamSection / BranchMapSection / LibrarySection / CommunityPublishPanel

**第三波：最复杂（依赖 Context 充分搭好）**
11. Composer ⭐⭐⭐
12. ParamsSection ⭐⭐⭐
13. TemplatesSection ⭐⭐⭐
14. Inspector（最后包装）
15. LegacyCreatorWorkspace（最后整段抽）

## 抽取套路（已通过 ChatEmptyState 验证）

每个子组件 = 1 commit，步骤：
1. 读源区段（offset+limit，**不读全文**）
2. 在 `components/creator/studio/` 下新建文件
3. `CreatorWorkspace.tsx` 加 import + 替换 inline JSX 为 `<X />`
4. 跑 `pnpm typecheck`
5. commit（消息含 "Phase 4 第 N 刀"）
6. **回到本文档，把表格里的"行号"列勾掉**

## ❌ 反模式（上一会话死于这些）

- ❌ 一个会话内尝试完成多于 3-4 个子组件（transcript 累加爆炸）
- ❌ 用 `Read` 不带 `offset+limit` 整读 CreatorWorkspace.tsx
- ❌ 在主壳里 `/compact` 或 `继续` 期望模型重读全文（必爆 32MB）
- ❌ 在抽取期间打开浏览器测试 / 拍 playwright 截图（screenshot binary 加速 transcript）
- ❌ 一次 commit 同时做"抽出 + 视觉重做"（应分两 commit，先抽位置后改外观）

## 视觉打磨（Phase 5）插槽

子组件抽完后再做（每个组件单独 commit）：
- ChatEmptyState：删 `studio-empty-canvas` 装饰画布；改成 4 个常用模板快捷卡网格
- ChatTranscript：去掉 22px dotted 背景
- ProjectSidebar：浅色 + accent 描边 active
- Composer：上下文 chips 简化为单行
- Inspector：所有 section 用 `<SectionHeading icon title action />` 统一
