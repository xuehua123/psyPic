# Board Mode Implementation Plan (Phase C)

## 1. Board Mode 与现有 Workbench / VersionNode 的关系
- **定位**：Board Mode（多素材多图层画布）是图片生成前的**视觉编排层**，也是图片生成后的**非破坏性版本快照层**。
- **与 Version Stream 的关系**：Board Mode **不替代** 现有的对话流（Chat Transcript）或版本树（Version Stream）。它作为 Main Canvas 的一个新视图 Tab（Transcript / Board）并存。
- **工作流**：用户在 Board 中进行素材拼接、排版、手绘 mask，然后将其展平（flatten）导出为参考图或 Mask，并携带 Prompt 提交给 `/api/images/edits`。生成的新结果会产生新的 VersionNode，该节点会关联并保存当时的 Board 快照，从而允许从历史节点一键恢复排版状态。

## 2. 后端已有 `board_*` 字段梳理
根据 `prisma/schema.prisma` 和 `lib/creator/workbench-types.ts`，`VersionNode` 模型已经具备以下支持 Board 的预留字段：
- **`board_document_id`** (`String?`)：关联的 BoardDocument 唯一标识符。
- **`board_snapshot`** (`Json?`)：生成或导出时，当前画布的完整 JSON 序列化数据（如 Konva state）。
- **`board_export_asset_id`** (`String?`)：画布展平后导出的成品图（PNG），作为新生成任务的直接参考图 Asset ID。
- *(注：暂无单独的 `board_position` 或 `board_transform` 字段，这些细节统一包含在 `board_snapshot` JSON 中)*

## 3. 前后端契约现状分析
- **后端已就绪**：
  - `VersionNode` 已经支持存储 Board 快照与关联关系。
  - `/api/images/edits` 原生支持接收 `image` (Reference) 和 `mask` 参数，只需前端将 Board 导出为这两种格式即可直接对接，无需后端新开“基于 Board 生成”的专用接口。
- **前端待实现**：
  - 基于 Konva 的 Board Canvas UI 及相关控制面板（Layer / Transform / Brush）。
  - BoardDocument 本地 IndexedDB 存储（local-first 策略）。
  - Board 展平导出逻辑（导出为主图 PNG 和 alpha mask PNG）。
  - `generation-context.ts` 中需要在发起生成请求时，补充附带 `board_document_id` 等字段到上下文中，以便写入 VersionNode。

## 4. 第一阶段核心禁令 (Non-breaking Rule)
- Board Mode 第一阶段**绝对不能破坏**现有的 Chat / VersionNode / Generation 流程。
- 如果用户不切换到 Board Tab，系统必须表现得像以前一样。所有原有 E2E 测试必须保持绿灯。

---

## 5. Cut 1 ~ 6 实施计划

### Cut 1: Board data model / client adapters
- **目标**：建立 BoardDocument 和 BoardLayer 的类型定义，并在前端实现 IndexedDB 的本地存储层。
- **文件范围**：
  - `lib/creator/board/types.ts`
  - `lib/creator/board/board-store.ts` (基于 idb 或类似封装)
- **验收条件**：定义完整的数据模型，并且可以通过单元测试进行存取验证。
- **禁止事项**：不要编写任何 React UI 代码，不要引入 Konva。

### Cut 2: Canvas shell and layout
- **目标**：将 Board Mode 骨架集成到 CreatorWorkspace，实现 Transcript 与 Board 的平滑切换。
- **文件范围**：
  - `components/creator/CreatorWorkspace.tsx`
  - `components/creator/board/BoardMode.tsx`
  - `components/creator/board/BoardStage.tsx`
- **验收条件**：用户可在顶部 Tab 切换 "Transcript" 和 "Board"。切换到 Board 时展示一个空白的 Konva Canvas 及空占位符面板。
- **禁止事项**：不要实现复杂的拖拽与图层操作逻辑。

### Cut 3: Asset/layer placement
- **目标**：实现图片与画笔从素材库向画布的投放及画布内的基础变换操作。
- **文件范围**：
  - `components/creator/board/BoardStage.tsx`
  - `components/creator/board/BoardLayerList.tsx`
  - `components/creator/board/BoardInspector.tsx`
- **验收条件**：可以从侧边栏素材库点击/拖拽素材到画布，生成 Image Layer；可以通过 Transformer 进行移动、缩放、旋转；支持最基础的文字或画笔涂鸦层。
- **禁止事项**：不要对接生成 API，不要实现复杂的 Undo/Redo 历史栈。

### Cut 4: Board-aware generation/edit context
- **目标**：实现 Board 的一键展平导出，并对接现有的 `/api/images/edits` 生成链路。
- **文件范围**：
  - `components/creator/board/BoardExportPanel.tsx`
  - `lib/creator/generation-context.ts`
  - `components/creator/CreatorWorkspace.tsx` (注入生成逻辑)
- **验收条件**：能将 Board 导出为 Reference PNG 或 Mask PNG。在 Board Mode 点击“生成”时，能自动提取导出图并向后端提交正确的 edit 参数。
- **禁止事项**：不要修改后端的 `/api/images/edits` 接口实现。

### Cut 5: Persistence/sync with VersionNode board_* fields
- **目标**：打通生成结果与 VersionNode 的 Board 字段绑定，实现快照持久化与历史回溯。
- **文件范围**：
  - `lib/creator/version-graph.ts` (及其他相关持久化辅助)
  - `components/creator/CreatorWorkspace.tsx` (处理任务完成回调)
- **验收条件**：生成成功后，新写入的 VersionNode 正确包含 `board_document_id`、`board_snapshot` 和 `board_export_asset_id`。并且当用户点击某个历史 VersionNode 且它包含 board 快照时，可以提示或一键恢复 Board 视图。
- **禁止事项**：不要强制所有原有文本生成的节点也带上 Board 字段。

### Cut 6: Visual QA and e2e smoke
- **目标**：全面验收 Board Mode 链路，确保无回归。
- **文件范围**：
  - `tests/e2e/workbench-board-events.spec.ts` (新建测试或在现有文件中追加)
- **验收条件**：通过 Playwright 模拟 "建画布 -> 拖素材 -> 涂鸦 -> 提交生成 -> 检查新节点恢复" 流程。
- **禁止事项**：不要做多浏览器兼容性暴力盲改，集中确保 Chromium 端通过即可。
