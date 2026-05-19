# Board Mode Cut 4 — Board export → /api/images/edits（计划）

> 接 Cut 3.1 stabilization 收口（commit `97a9796` 起，main 同步）。
> 上游 spec：`docs/20-多素材多图层画布（BoardMode）改造方案.md`、
> `docs/superpowers/plans/2026-05-12-board-mode-final.md`。

## 1. 目标 / 非目标

**目标**：让 Board 能驱动一次真实生成。最小可用链路：

```
Board (有图层) → 一键导出 reference PNG → Composer reference 槽
              → 提交 /api/images/edits（同时携带 board_* context）
```

完成后：用户在 board 拼好图 → 点「作为参考图编辑」→ Composer 自动收到导出
PNG → 用户点提交 → 请求落到 image-task pipeline，FormData 携带 board 字段。

**非目标（明确不做）**：

1. 不动 `/api/images/edits` 后端（已就绪，仅补前端契约）。
2. 不做 mask 导出（mask layer 走 Cut 5）。
3. 不做 BoardExport 服务端化 / `/api/workbench/boards/*` 系列接口。
4. 不做 VersionNode `board_*` 字段写入与回放（plan 2026-05-12 Cut 5 范围）。
5. 不做 undo/redo / 多选 / 图层组 / 吸附 / 对齐。
6. 不承诺端到端 image-task success（外部 Sub2API / API key / 环境会影响成功率，
   验收按"FormData 正确 + 后端不报 validation error"判定）。

## 2. 关键设计决定（来自 review 调整）

### 2.1 Konva stageRef 不进 BoardContext

BoardContext 仍是纯数据 / reducer，不混入 Konva runtime ref。改用局部
callback handle：

```ts
// components/creator/board/BoardStage.tsx
type BoardStageProps = {
  onStageReady?: (stage: Konva.Stage | null) => void;
};

// components/creator/board/BoardMode.tsx
const stageRef = useRef<Konva.Stage | null>(null);
<BoardStageDynamic onStageReady={(s) => (stageRef.current = s)} />
<BoardExportPanel onExport={...stageRef.current...} />
```

`BoardExportPanel` 从 `BoardMode` props 拿 export callback，不读 BoardContext
里的 stage。BoardContext 仍只暴露 `state` + `dispatch`。

### 2.2 `board_export_asset_id` 在 Cut 4 是 client temp id

Cut 4 不持久化 board 导出资产。`board_export_asset_id` 字段格式：

```
board-export-${timestamp}-${random4}
```

仅用于**本次 request context** 让 image-task 能溯源到一次 board 导出动作。
持久化 / 与 Asset 表挂钩在 Cut 5。

后端 `formDataToWorkbenchContext` 只把它当 string 透传，不做 asset id 查表
（已确认 `app/api/images/edits/route.ts` line 383-389 现状即如此）。

### 2.3 FormData 验收口径

```
✓ multipart 包含 image=<board-flatten.png>（作为 reference image）
✓ multipart 包含 board_document_id / board_snapshot / board_export_asset_id
✓ POST /api/images/edits 不返回 invalid_parameter
✗ 不强制要求 status=200 + image-task succeeded（依赖外部服务）
```

如果本地有可用 Sub2API key 配置，可加一个 manual smoke 走 success；不作为
自动化必达条件。

## 3. 拆刀（5 commits）

### Cut 4.1 — `feat(board): export flat board png`

**范围**

- 新增 `lib/creator/board/board-export.ts`：
  ```ts
  export function exportBoardToPng(
    stage: Konva.Stage,
    opts?: {
      pixelRatio?: 1 | 2;
      mimeType?: "image/png";
      excludeKinds?: BoardLayer["kind"][];  // 默认排除 "mask"
      excludeLayerNames?: string[];          // 默认排除 "board-background", "board-grid"
    }
  ): { dataUrl: string; blob: Blob; width: number; height: number };
  ```
  内部用 `stage.toDataURL({ pixelRatio, mimeType })`，再 `fetch(dataUrl).blob()`
  转 Blob。helper layer（背景、网格）通过 `layer.visible = false` 临时隐藏，
  导出后立即恢复，避免影响 UI。
- BoardStage 加 `onStageReady?: (stage: Konva.Stage | null) => void` prop，
  在 `useEffect` 里通过 stage ref 通知，组件 unmount 时再调一次 `null`。

**测试**

- jsdom 下 stage.toDataURL 不可用 → 用 vitest mock 一个 fake stage（带
  `toDataURL` 返回固定 data URL、`getLayers()` 返回带 `visible` 的 mock
  layer 数组），单测验：
  - `pixelRatio` / `mimeType` 透传
  - 默认 exclude `mask` kind 和 helper layer
  - 导出前后 helper layer 的 `visible` 状态被还原
  - dataUrl → blob 转换得到非空 Blob
- BoardStage `onStageReady` smoke：测试组件 mount 后回调被调一次，unmount
  后再调一次（参数 null）。

**禁令**

- 不引入新依赖（用 Konva 自带 toDataURL）。
- 不持久化导出产物。
- 不动 BoardContext。

---

### Cut 4.2 — `feat(board): add board reference export action`

**范围**

- 新增 `components/creator/board/BoardExportPanel.tsx`：
  - 桌面挂在 BoardMode 右栏 inspector 底部一个 Section（不取代现有
    BoardInspector，挂在它下面）。
  - 移动挂在 outer scroll 区底部（与 inspector 同 order-3 区块内）。
  - 主 Action：「作为参考图编辑」按钮，`data-testid="board-export-as-reference"`。
  - 次要展示：当前画布尺寸、像素比 1x/2x 切换。
  - 空 board（layers.length === 0）时按钮 disabled，显示「画布无内容」。
- BoardMode 持 stageRef + 注入 export callback 到 BoardExportPanel。callback
  签名先这样：
  ```ts
  type BoardExportResult = {
    blob: Blob;
    dataUrl: string;
    width: number;
    height: number;
    boardDocumentId: string;
    boardExportAssetId: string;  // client temp id
    boardSnapshot: BoardDocument;
  };
  ```
  Cut 4.2 只把 BoardExportResult 放在一个 BoardExportPanel 内部 state（或
  console.log）观察，不投递。

**测试**

- 空 board → 按钮 disabled、有 hint。
- 有图层时点击 → `exportBoardToPng` 被调用一次（mock helper），返回
  BoardExportResult 写入 panel 内部 state，可通过 `data-testid` 断言。
- 像素比 toggle 切到 2x → 下次点击 helper 收到 `pixelRatio: 2`。

**禁令**

- 不直接 fetch /api/images/edits。
- 不动 Composer / generation-context。
- 不写 mask 按钮。

---

### Cut 4.3 — `feat(creator): inject board export into composer references`

**范围**

- 找到现有 LibrarySection 投递 reference 到 Composer 的路径（grep
  `setLibraryAssetDragData` 反向追到 Composer 接收端），复用同一 reference
  注入入口。优先方案：扩展现有 `useCreatorStudio()` 或 ImportExchange
  pattern，让 BoardExportPanel 能调一个 `addReferenceFromBlob(blob, source)`
  helper。
- BoardExportPanel 的「作为参考图编辑」按钮改为：
  1. 调 export callback 拿 BoardExportResult。
  2. 调 reference 注入 helper，把 `blob` 投到 Composer。
  3. 同时记录 `boardDocumentId / boardExportAssetId / boardSnapshot` 到一个
     新的 BoardCompositionRef context（client-side state，不持久化）。
  4. 切到 transcript tab（复用现有 `setView("transcript")`）。
- 提交链路本刀**不动**（generation-context 在 Cut 4.4 改）。这一刀提交后，
  Composer 已经显示 board 导出图，但提交时仍走旧路径，不带 board 字段。

**测试**

- BoardExportPanel 点击 → mock 的 reference 注入 helper 被调一次，参数包含
  blob 和 source 标记。
- BoardCompositionRef context 收到 boardDocumentId/boardExportAssetId/
  boardSnapshot。
- 自动切到 transcript（断言 `view === "transcript"` 或对应 testid 出现）。
- 现有 LibrarySection 拖图到 Composer 的路径行为不变（regression）。

**禁令**

- 不动 generation-context.ts。
- 不在 FormData 里加 board 字段。
- 不持久化 BoardCompositionRef 到 IndexedDB。

---

### Cut 4.4 — `feat(creator): submit board workbench context`

**范围**

- 扩展 `lib/creator/generation-context.ts`：
  - `GenerationWorkbenchContext` 加 3 个 optional 字段：
    ```ts
    boardDocumentId?: string;
    boardExportAssetId?: string;
    boardSnapshot?: BoardDocument;
    ```
  - `injectWorkbenchContext` / `appendWorkbenchContextToFormData` 都按
    "字段存在才注入" 规则带上 `board_document_id` / `board_export_asset_id` /
    `board_snapshot`（snapshot 序列化 JSON.stringify）。
  - 删除 line 9 / 39 / 62 的"显式不发送 board_\* 字段"注释（现在发了）。
- Composer 提交逻辑：从 BoardCompositionRef context 读 boardDocumentId 等
  字段；当且仅当存在时合并进 GenerationWorkbenchContext。普通 transcript
  reference（无 board 来源）**不**带 board 字段，符合 plan 2026-05-12 第 4
  节非破坏铁律。
- Composer 提交成功后清空 BoardCompositionRef，避免下次 transcript 提交错带
  board 字段。

**测试**

- `tests/unit/generation-context.test.ts`：
  - inject board context 时 JSON body / FormData 正确包含 3 字段。
  - 不带 board context 时旧路径输出**完全一致**（snapshot 测试）。
- `tests/api/image-edits.test.ts` 加一条：FormData 带
  `board_document_id` + `board_export_asset_id` + `board_snapshot` 时，
  `/api/images/edits` 不返回 `invalid_parameter` / `invalid_relation`。
- 集成测试：board 路径提交后 Composer 内 BoardCompositionRef 已清空。

**验收（人工）**

- desktop 1920：board 有图 → 「作为参考图编辑」→ Composer 出现 board PNG →
  点提交 → 用 DevTools Network 抓包确认 multipart 包含 `image=...` +
  3 个 `board_*` 字段。
- mobile 390：board outer 滚动到 BoardExportPanel → 同样链路通。
- transcript 路径：原 LibrarySection 拖图 → 提交 → Network 抓包**不**包含
  `board_*` 字段。

**禁令**

- 不写 task succeed 回调里的 VersionNode 写入（Cut 5）。
- 不强制 image-task succeeded（依赖外部 Sub2API key）。
- 不在前端做 `board_export_asset_id` 与持久化 Asset 表的绑定。

---

### Cut 4.5 — `docs(board): record cut4 completion notes`

**范围**

- 本计划文末尾追加 commit 链 + 实测网络抓包结果的 5 条 checklist。
- 更新 `CLAUDE.md`：
  - "当前重点工作"从 Cut 3.1 stabilization 切到 Cut 4 完结。
  - "接棒读哪一份"换指向本计划。
  - "后续可选项"加一条 "Cut 5 — 持久化 board 导出 + VersionNode 回放"。
- `docs/17-测试与验收用例.md` 6 路由人工走查 checklist 加一行 "board 流转
  generation"。

**禁令**

- 不引入新代码。
- 不阻塞功能（CLAUDE.md 这刀失败不卡 Cut 4 整体收口）。

## 4. 风险与对策

| 风险 | 影响 | 对策 |
|---|---|---|
| Konva canvas tainted by cross-origin asset | `stage.toDataURL` 抛 SecurityError | 现状所有 image src 来自 `/api/assets/...` 同源；测试加 negative case 兜底；导出失败时 panel 显示明确错误 |
| 大画布导出超过 max_upload_mb (默认 25MB) | 后端 413 | 导出前估算 `width×height×4×pixelRatio²`，超阈值时强制按 1x 重导一次，仍超就提示用户缩小画布 |
| Composer 已经有 reference 时被 board 注入覆盖 | UX 混乱 | 注入前若已有 reference 弹 confirm；首版先做"挤掉队尾"+ toast 通知 |
| BoardCompositionRef 没在提交后清空 → 下次 transcript 提交错带 board 字段 | 后端 task 误关联 | Cut 4.4 提交回调里强制清空 + 单测覆盖 |
| `injectWorkbenchContext` 改 API 后老调用方仍传旧 context 类型 | typecheck 失败 | board 字段全 optional，老调用方不动也通过 |
| mobile 真机 generation 流程没复测 | board → composer 切换可能出问题 | Cut 4.4 完成后必须做一次 mobile 真机走查再开 Cut 5 |

## 5. 验收

每刀必跑：

```bash
pnpm typecheck && pnpm lint && pnpm test && pnpm build
git diff --check && git status -sb
```

Cut 4 整体收口标准（4.1 → 4.5 全 push 完）：

- desktop 1920：board 有图 → 「作为参考图编辑」→ Composer 出现 board 导出
  PNG → 提交 → Network 抓包 multipart 包含 `image` + 3 个 `board_*` 字段，
  `/api/images/edits` 不返回 4xx validation error。
- mobile 390：上述链路通，board outer 滚动正常，composer 注入后无遮挡。
- 任何**不走 board** 的现有流程（transcript 拖图、纯文本 generation）行为
  完全无变 — 单测 regression 套件 + 人工抽测一条 transcript 提交 + Network
  抓包确认无 `board_*` 字段。

## 6. 接 Cut 5 的预留

Cut 5 范围（`feat(board): persist board export and link to version node`）
将处理：

- `board_export_asset_id` 从 client temp id 升级为持久化 Asset 表 id。
- VersionNode succeed 回调里写入 `board_document_id` / `board_snapshot` /
  `board_export_asset_id`。
- 历史 VersionNode 一键回放 board snapshot。
- BoardDocument 持久化到 IndexedDB（Cut 1 已建表，Cut 5 实际启用 read/write）。

Cut 4 不预先做这些字段的占位代码 / 接口约束，避免半成品引导 Cut 5 走偏。

## 7. 变更日志（落地后追加）

| commit | 子刀 | 说明 |
|---|---|---|
| (待) | 4.1 | feat(board): export flat board png |
| (待) | 4.2 | feat(board): add board reference export action |
| (待) | 4.3 | feat(creator): inject board export into composer references |
| (待) | 4.4 | feat(creator): submit board workbench context |
| (待) | 4.5 | docs(board): record cut4 completion notes |
