# Phase C · Board Mode P1+P2 Implementation Plan

> 把 docs/20「BoardMode 改造方案」中的 P1（本地画布）+ P2（导出进入生成链路）一次拿出可生产版。依赖 Phase B 的 VersionNode（导出后落 server VersionNode 携带 board_* 字段）。

**Goal**：用户能从素材库 / 历史结果拖图到画布，手绘标注 + mask，一键导出 reference PNG 进入 `/api/images/edits`，结果回到 version 流形成新节点。

**Scope**：
- ✅ 含：4 类 layer（image / stroke / text / mask）、移动 / 缩放 / 旋转、undo / redo、扁平化导出、alpha mask 导出、edits 接入、VersionNode snapshot
- ✅ 含：BoardDocument IndexedDB local-first（P1）+ 服务端化（P3 前半）
- ❌ 不含：多画布页 / 对齐线吸附 / 预设版式 / 智能抠图（留 P4）
- ❌ 不含：实时协作 / 无限画布

**出口**：
- `components/creator/board/*` 6 件套 + `lib/creator/board/*` 6 件套到位
- ChatTranscript / Transcript 与 BoardMode tabs 切换
- 导出 PNG → `/api/images/edits` → VersionNode 携带 board_* 字段链路通
- BoardDocument 服务端化（`PSYPIC_BOARD_DOCUMENTS_STORE=database`）
- docs/07 图片工作台化验收剩 7 项中 4 项 `[ ]` → `[x]`（Board 相关）

**预计周期**：3-4 周。

---

## 关键设计决定

### 决定 1：Konva + react-konva（docs/20 已锁）

- `konva@10.x` MIT + `react-konva@19.x` MIT
- 不引 fabric / tldraw / excalidraw（理由见 docs/20 技术选型表）
- Konva Stage 实例**绝不**进入 React Context / 全局状态 / server API；只在 board 内部使用

### 决定 2：BoardDocument JSON 是 source of truth

UI 销毁 / 切换 tab / 重启浏览器 → Konva Stage 重建；唯一真相是 `BoardDocument.layers` JSON。

```
BoardDocument JSON ←→ Konva Stage 渲染
       ↑
   IndexedDB / DB
```

### 决定 3：导出协议绑定 docs/20 + Phase B VersionNode

```
BoardExport.kind ∈ { reference_png, mask_png, preview_png }
  → ImageAsset（普通资产，不区分 board 来源）
  → /api/images/edits 接收 image= + mask=（不知道 board）
  → VersionNode 携带 board_document_id / board_snapshot / board_export_asset_id（Phase B 已加字段）
```

### 决定 4：外链图片必须先进 PsyPic asset proxy

防 canvas tainted。从素材库 / 历史 / 社区拖入的图都已经在我们的 storage；社区同款草稿图同理。**不允许**直接 `<img src="https://外站">` 进 Konva。

### 决定 5：移动端 P1 + P2 体验降级

docs/20「移动端」节明确：第一版只支持查看 / 添加图片 / 移动缩放 / 画笔 / 导出。精细图层排序、批量对齐、裁剪入桌面端 only。

---

## 前置依赖

| # | 依赖 | 状态 | 检查方式 |
|---|---|---|---|
| 1 | Phase A 完成（v1.0 tag） | 🚧 | `git tag -l v1.0` |
| 2 | Phase B 完成（VersionNode 带 board_* 字段） | 🚧 | `pnpm prisma format` 看 schema |
| 3 | 对象存储就绪（Phase A Cut 3） | 🚧 | staging `ASSET_STORAGE_DRIVER=r2/s3` |

---

## Cut 1：依赖 + 类型定义 + 代码骨架

**Files**:
- Modify: `package.json`（+ `konva` + `react-konva`）
- Create: `lib/creator/board/types.ts`（BoardDocument / BoardLayer / BoardExport，按 docs/20 §对象模型）
- Create: `lib/creator/board/board-store.ts`（IndexedDB CRUD - 先空壳 + 类型签名）
- Create: `lib/creator/board/board-serialization.ts`（JSON ↔ runtime - 空壳）
- Create: `lib/creator/board/board-export.ts`（Stage → PNG - 空壳）
- Create: `lib/creator/board/board-history.ts`（undo / redo patch - 空壳）
- Create: `lib/creator/board/board-version-link.ts`（与 VersionNode 关联 - 空壳）
- Create: `components/creator/board/BoardMode.tsx`（壳）
- Create: `components/creator/board/BoardStage.tsx`（壳）
- Create: `components/creator/board/BoardToolbar.tsx`（壳）
- Create: `components/creator/board/BoardLayerList.tsx`（壳）
- Create: `components/creator/board/BoardInspector.tsx`（壳）
- Create: `components/creator/board/BoardExportPanel.tsx`（壳）
- Test: `tests/unit/board-types.test.ts`（类型 round-trip）

**Steps**:
- [ ] **Step 1.1** `pnpm add konva react-konva`，确认 lockfile 改动
- [ ] **Step 1.2** 落 types.ts（直接抄 docs/20 §对象模型）
- [ ] **Step 1.3** 6 件 lib + 6 件 component 都先建空壳（仅 export 默认组件 / 默认函数 + 类型签名 + TODO 注释）
- [ ] **Step 1.4** `pnpm typecheck && pnpm lint` 通过
- [ ] **Step 1.5** commit 1：`feat(board): 加 konva 依赖 + types + 模块骨架（Phase C · Cut 1）`

**验收**：
- [ ] 依赖装好
- [ ] 12 个新文件都 typecheck 通过
- [ ] CreatorWorkspace 不需要任何改动

---

## Cut 2：BoardDocument 本地 store + serialization

**Files**:
- Modify: `lib/creator/board/board-store.ts`（IndexedDB store `psypic_board_documents`）
- Modify: `lib/creator/board/board-serialization.ts`（layers JSON 校验）
- Create: `lib/creator/board/use-board-document.ts`（hook：list / create / patch / delete by project + session）
- Test: `tests/unit/board-store.test.ts`（fake-indexeddb）
- Test: `tests/unit/board-serialization.test.ts`（schema 校验 + 边界值）
- Test: `tests/unit/use-board-document.test.ts`

**契约**：
- IndexedDB key path: `id`
- 每个 BoardDocument 有 `projectId` + `sessionId` 索引
- `layers` 数组 schema 严格按 docs/20 BoardLayer union（Zod 校验 stroke / mask points 数组、image src URL 同源、text 必填字段）

**Steps**:
- [ ] **Step 2.1** 失败测试：store CRUD（create + list by session + patch + delete）
- [ ] **Step 2.2** 失败测试：serialization 在异常 layer 上抛错
- [ ] **Step 2.3** 实现 store + serialization
- [ ] **Step 2.4** 实现 hook
- [ ] **Step 2.5** commit 2：`feat(board): BoardDocument IndexedDB store + serialization + useBoardDocument（Phase C · Cut 2）`

**验收**：
- [ ] 单测覆盖率 store + serialization > 90%
- [ ] hook 测试覆盖：mount cache / patch optimistic / delete

---

## Cut 3：BoardStage + BoardToolbar + BoardLayerList（4 类 layer 交互）

**Files**:
- Modify: `components/creator/board/BoardStage.tsx`（Konva Stage / Layer / Transformer）
- Modify: `components/creator/board/BoardToolbar.tsx`（图标按钮：选择 / 平移 / 画笔 / 橡皮 / 文字 / mask / 对齐 / 前移 / 后移 / 锁定 / 隐藏 / 删除）
- Modify: `components/creator/board/BoardLayerList.tsx`（图层列表 + 隐藏 / 锁定 / 排序 / 删除）
- Create: `lib/creator/board/use-board-tool.ts`（当前工具 + 画笔颜色 / 粗细 / 模式状态）
- Test: `tests/components/board-stage.test.tsx`
- Test: `tests/components/board-toolbar.test.tsx`
- Test: `tests/components/board-layer-list.test.tsx`

**4 类 layer 交互验收**（docs/20 §核心能力）：
- image：移动 / 缩放 / 旋转（Transformer）/ 锁定 / 隐藏 / 层级
- stroke：画笔 / 橡皮 / 颜色 / 粗细
- text：可编辑文字、字号、颜色（不烧进图，docs/20 §素材库）
- mask：独立涂抹工具，与 stroke 视觉区分（docs/14 视觉标准）

**Steps**:
- [ ] **Step 3.1** 失败测试：选中 image → Transformer 出现；拖动 → BoardDocument 更新
- [ ] **Step 3.2** 失败测试：画笔 → stroke layer 出现 points
- [ ] **Step 3.3** 失败测试：mask layer 与 stroke 视觉区分（class / data-attribute）
- [ ] **Step 3.4** 实现 BoardStage（Konva Stage 包装）
- [ ] **Step 3.5** 实现 BoardToolbar（lucide-react 图标 + tooltip）
- [ ] **Step 3.6** 实现 BoardLayerList
- [ ] **Step 3.7** 接入 use-board-tool + use-board-document
- [ ] **Step 3.8** commit 3：`feat(board): Stage + Toolbar + LayerList - 4 类 layer 交互（Phase C · Cut 3）`

**关键不变量**：
- Konva Stage 实例不漏出 BoardStage 文件外
- 所有用户操作都通过 patch BoardDocument JSON 更新 IndexedDB（即使 UI 销毁也能恢复）
- 工具切换互斥（移动端尤其重要，docs/20 §风险）

**验收**：
- [ ] 4 类 layer 都能添加 / 操作
- [ ] mask layer 视觉与 stroke 明显区分
- [ ] 工具切换互斥
- [ ] 桌面 + 移动端单测都过

---

## Cut 4：undo / redo + BoardInspector

**Files**:
- Modify: `lib/creator/board/board-history.ts`（patch-based history stack，上限 50 步）
- Modify: `components/creator/board/BoardInspector.tsx`（Layers / Transform / Brush / Export / Snapshot 5 段）
- Test: `tests/unit/board-history.test.ts`
- Test: `tests/components/board-inspector.test.tsx`

**Steps**:
- [ ] **Step 4.1** 失败测试：5 步操作 → undo 4 次 → redo 2 次，BoardDocument 状态符合预期
- [ ] **Step 4.2** 失败测试：超过 50 步上限自动丢弃最早 patch
- [ ] **Step 4.3** 实现 patch-based history（节流 snapshot，避免 IndexedDB 撑爆，docs/20 §风险）
- [ ] **Step 4.4** Inspector 5 段视觉按 docs/20 §UI 接入方案
- [ ] **Step 4.5** 接入键盘快捷键（Cmd+Z / Cmd+Shift+Z）
- [ ] **Step 4.6** commit 4：`feat(board): undo/redo + BoardInspector 5 段（Phase C · Cut 4）`

**验收**：
- [ ] undo/redo 可用
- [ ] 50 步上限触发
- [ ] Inspector 5 段都接通

---

## Cut 5：导出 PNG + 接入 edits

**Files**:
- Modify: `lib/creator/board/board-export.ts`（Stage → PNG / alpha PNG，pixelRatio 1x/2x，按 Images API 尺寸规则规整）
- Modify: `components/creator/board/BoardExportPanel.tsx`（导出 reference / mask / preview，作为参考图编辑 / 局部编辑 mask 入口）
- Modify: `app/api/assets/route.ts` 或新建 `app/api/board-exports/route.ts`（接收 PNG blob → 入对象存储 → 返回 ImageAsset）
- Modify: `components/creator/CreatorWorkspace.tsx`（接收 board export → Composer reference 字段 / edits mask 字段）
- Test: `tests/unit/board-export.test.ts`（基于 jsdom + canvas-mock）
- Test: `tests/components/board-export-panel.test.tsx`
- Test: `tests/api/board-exports.test.ts`

**契约（docs/20 §API 改造方向）**：

```
POST /api/board-exports
  body: { board_document_id, kind: 'reference_png' | 'mask_png' | 'preview_png', png_blob, width, height, pixel_ratio }
  response: { board_export_id, asset_id, kind, width, height, pixel_ratio }
```

**Steps**:
- [ ] **Step 5.1** 失败测试：board-export.ts 在 mock canvas 下产出指定尺寸 PNG
- [ ] **Step 5.2** 失败测试：board-exports API 接收 blob → 返回 asset_id
- [ ] **Step 5.3** 实现 board-export.ts（toDataURL + Blob conversion + 尺寸规整）
- [ ] **Step 5.4** 实现 board-exports API（多 part 接收 + 入对象存储 + ImageAsset 创建）
- [ ] **Step 5.5** BoardExportPanel 加按钮：「作为参考图编辑」/「作为局部编辑 mask」
- [ ] **Step 5.6** CreatorWorkspace 接 export 回调 → 切到 edits 模式 + reference / mask 字段填充
- [ ] **Step 5.7** commit 5：`feat(board): 导出 PNG + 接入 edits（Phase C · Cut 5）`

**关键不变量**：
- canvas tainted 检查：导出前确认所有 image layer 的 src 都是同源（docs/20 §风险）
- 尺寸按 16 倍数规整 + 长宽比 ≤ 3:1（沿用 V1.0 image-params validation）
- mask layer 单独导出 alpha PNG（不混 stroke layer）

**验收**：
- [ ] 桌面端能导出 reference PNG → 切到 edits → 提交
- [ ] 桌面端能导出 alpha mask PNG → 提交带 mask 的 edits
- [ ] 提交结果回到 ChatTranscript

---

## Cut 6：VersionNode 关联 + BoardMode tab 切换

**Files**:
- Modify: `app/api/images/edits/route.ts`（Phase B 已加 workbench context；本 cut 加 `board_document_id` / `board_export_asset_id` 接收）
- Modify: `server/services/version-node-service.ts`（VersionNode 落 `board_*` 字段）
- Modify: `components/creator/CreatorWorkspace.tsx`（顶部 tabs：Transcript / Board）
- Modify: `components/creator/board/BoardMode.tsx`（含 Stage / Toolbar / LayerList / Inspector / ExportPanel 装配）
- Test: `tests/api/image-edits-board.test.ts`
- Test: `tests/components/creator-board-tab.test.tsx`
- Test E2E: `tests/e2e/board-mode.spec.ts`（关键：素材库拖入 → 标注 → 导出 → edits → 新版本节点）

**Steps**:
- [ ] **Step 6.1** 失败测试：edits 带 `board_document_id` + `board_export_asset_id` → 创建的 VersionNode 落对应字段
- [ ] **Step 6.2** 失败 E2E：素材库拖图到 Board → 画一笔 → 导出 → 提交 edits → version 流出现新节点 + 节点能恢复 board snapshot
- [ ] **Step 6.3** 实现 edits 接收 board 字段
- [ ] **Step 6.4** 实现 BoardMode 顶层装配
- [ ] **Step 6.5** 实现 Transcript / Board tabs（CreatorWorkspace 顶部）
- [ ] **Step 6.6** 实现「从 VersionNode 恢复 board snapshot」入口
- [ ] **Step 6.7** commit 6：`feat(board): tabs 切换 + VersionNode board_* 字段 + E2E（Phase C · Cut 6）`

**验收**：
- [ ] tabs 切换无白屏
- [ ] E2E 端到端通
- [ ] VersionNode 带 board_* 字段
- [ ] 从节点恢复 board snapshot 可用

---

## Cut 7：服务端化（BoardDocument + BoardExport 入库）

**Files**:
- Modify: `prisma/schema.prisma`（+ BoardDocument + BoardExport model，按 docs/13）
- Create: `prisma/migrations/{ts}_board_documents/migration.sql`
- Create: `app/api/workbench/boards/route.ts`（GET list / POST create）
- Create: `app/api/workbench/boards/[boardId]/route.ts`（GET / PATCH / DELETE）
- Create: `app/api/workbench/boards/[boardId]/export/route.ts`（POST 导出，替代 Cut 5 的 board-exports）
- Modify: `lib/creator/board/board-store.ts`（接入 sync layer，与 Phase B 一致：server 优先 + IndexedDB cache）
- Test: `tests/api/workbench-boards.test.ts`

**双轨开关**：`PSYPIC_BOARD_DOCUMENTS_STORE=indexeddb|database`（docs/部署已占好 env）。

**Steps**:
- [ ] **Step 7.1** schema + migration
- [ ] **Step 7.2** API 测试覆盖（同 Phase B 模式：鉴权 + 跨用户 + 双轨开关）
- [ ] **Step 7.3** 实现 boards API
- [ ] **Step 7.4** board-store 接 sync layer（复用 Phase B 的 sync-engine）
- [ ] **Step 7.5** staging migration 演练
- [ ] **Step 7.6** commit 7：`feat(board): BoardDocument 服务端化 + sync layer 接入（Phase C · Cut 7）`

**验收**：
- [ ] 跨设备同步可用
- [ ] 双轨开关切换无数据丢失
- [ ] BoardExport 入对象存储 + DB 元数据

---

## Cut 8：视觉打磨 + 移动端验收 + 文档同步

**Files**:
- Modify: `app/globals.css`（Board 工具条 / 选中框 / mask vs stroke 视觉 token）
- Modify: `components/creator/board/*`（按 docs/14 §Board Mode 视觉标准 polish）
- Modify: `docs/07-验收清单.md`（图片工作台化验收 4 项 Board 相关 `[ ]` → `[x]`）
- Modify: `docs/17-测试与验收用例.md`（加 Board Mode 真机走查 checklist）
- Modify: `CLAUDE.md`（当前重点工作切到 Phase D / 后续）
- Modify: `README.md`（Board Mode 状态从「方案已完成」→「P1+P2 落地」）

**docs/14 §Board Mode 视觉标准全要点**：
- 图标按钮 + tooltip 工具条
- 默认 checkerboard 或中性底
- Transformer 控制点清晰但不遮主图
- mask vs stroke 明显视觉区分
- 导出预览显示尺寸 / 倍率 / 用途
- 移动端 Board 优先保留查看 / 移动缩放 / 画笔 / 导出
- 暗色态下 transform 控制点 / 选中框 / 图标按钮 / tooltip 都可见

**Steps**:
- [ ] **Step 8.1** 桌面 + 移动端真机走查 Board Mode（暗色 + 亮色）
- [ ] **Step 8.2** 修走查发现的 ⚠️
- [ ] **Step 8.3** 文档同步（07 / 17 / CLAUDE.md / README）
- [ ] **Step 8.4** commit 8：`docs(board): P1+P2 落地完成 + 视觉打磨 + 走查回归（Phase C · Cut 8）`
- [ ] **Step 8.5** push main

**验收**：
- [ ] docs/07 工作台化验收 4 项 Board 相关全 `[x]`
- [ ] CLAUDE.md 当前重点切到下个阶段
- [ ] 真机走查全 ✅

---

## 全局验收闸

```bash
git diff --check
pnpm lint
pnpm typecheck
pnpm test
pnpm prisma validate
pnpm build
pnpm e2e
```

docs/07 图片工作台化验收 4 项：
- [ ] Board Mode 能添加多张素材、手绘标注和 mask layer，并导出 reference PNG / alpha mask PNG
- [ ] 素材库能按分类筛选并拖入 Board
- [ ] Board 导出后可进入 `/api/images/edits`，生成结果形成新 version node
- [ ] VersionNode 能保存 `board_document_id`、`board_snapshot` 和 `board_export_asset_id`

---

## 风险与缓解（docs/20 §风险与缓解 全列）

| 风险 | 影响 | 缓解 |
|---|---|---|
| 大图 + 多图层导致内存高 | 页面卡顿、导出失败 | 限制画布像素 ≤ 4096²、图层数 ≤ 30、缩略图预览 |
| 外链图片 canvas tainted | 无法导出 PNG | 所有图片先进 PsyPic asset proxy，再加载同源 URL |
| 导出质量不稳定 | AI edit 输入模糊或过大 | pixelRatio 1x/2x 可选，按 Images API 尺寸规则规整 |
| undo / redo 状态膨胀 | IndexedDB 快照过大 | patch-based history + 节流 + 上限 50 |
| mask 语义混乱 | 用户不知道涂哪里 | mask layer 独立开关 + 视觉区分（docs/14） |
| 移动端手势复杂 | 误触 + 滚动冲突 | 工具互斥 + 平移 / 缩放 / 画笔分离 |
| 授权风险 | 后续商业化不确定 | 仅用 MIT 的 Konva / react-konva |

## 不允许的捷径

- 引 fabric / tldraw / excalidraw 替换 Konva
- 把 Konva Stage 实例放进 React Context
- 直接 `<img src="https://外站">` 进 Konva（必跨域 tainted）
- 把 Board 交互塞回 CreatorWorkspace.tsx（CLAUDE.md 已警告）
- 跳过 Phase B 直接做 Phase C（VersionNode board_* 字段依赖 Phase B）
- 在 P1 + P2 阶段引入多人协作 / 无限画布 / AI 自动构图

## 经验预告（填完后补）

1. Konva 在 React 19 / Next 15 下的最大坑
2. canvas tainted 实际遇到的边界
3. 移动端手势第一个被踩中的雷
4. undo/redo 节流策略的真实手感
