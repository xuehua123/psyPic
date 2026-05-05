# Composer quick-pick row + 模板/参数 上提（落地版）

slug: `quiet-glittering-prism`（主） + `calm-squishing-globe`（prompt 输入支线）
完成: 2026-05-06
出库 commit: `c6a8f5f`

> 本轮工作横跨两个 plan slug：主线 `quiet-glittering-prism` 14 刀做 Composer quick-pick 上提 + 模板/参数收纳；支线 `calm-squishing-globe` 5 刀做 Composer prompt 输入升级（长 prompt 展开 + 多参考图缩略图条 + 拖 / 粘贴 / + 添加图入口）。两条线在最后一刀汇流到同一个 commit。

## 背景

V1.0 创作台首屏一直被吐槽「参数挤」：右 Inspector 一栏既要装 14 个商业模板的卡片网格，又要装 size / quality / format / n / streaming / background / input_fidelity / style 等 8 个参数控件，还塞了 reference 上传区，导致：

- **首屏认知负担高**：用户进创作台先看到右栏一坨配置而不是 prompt 输入框
- **模板入口被埋**：要从右 Inspector 里翻才看到，新用户根本找不到「14 个商业场景模板」
- **参数耦合**：模板字段、Sub2API 原生参数、UI 偏好（style）混在一起没分层
- **prompt 输入逼仄**：单行 chat-prompt-input 写超过两行就溢出滚动；多张参考图缩略只能从右栏看不直观

用户拍板「把首屏聚焦在写 prompt + 选模板 + 选比例三件事」。

按可行性分两条主线：

- **主线 `quiet-glittering-prism`（14 刀）**：参数分层 + 模板入口上提到 Composer + 高级参数收抽屉
- **支线 `calm-squishing-globe`（5 刀）**：prompt 输入区本体升级（长展开 dialog + composer 内多参考图缩略 + 三入口上传：file picker / drop / paste / + 按钮）

两条线天然交叠在 `Composer.tsx` 上，所以一并出库。

## 关键设计决定

### 决定 1：模板入口从「右 Inspector 网格」上提到「Composer + 模板 chip」

旧：`inspector/TemplatesSection.tsx`（151 行）渲染 14 个卡片，永远占 Inspector 顶部一大块
新：`composer/TemplatePickerDialog.tsx`（207 行）做 Modal，靠 `quickpick-template-trigger` chip 触发；选中后 chip 文本切到模板名

收益：Inspector 不再背模板；模板从「常驻」变成「按需弹出」；模板分组（4 大场景）和缩略图（emoji + 渐变占位）更清晰。

### 决定 2：高级参数收抽屉，主流程 4 chip 一行解决

主流程暴露在首屏的只有 4 个 chip：模式（文 / 图）/ + 模板 / 比例 / 高级
其他参数（quality / n / background / input_fidelity / 流式 / 模板字段细节）全部塞进 `AdvancedParamsDrawer`（默认关闭）。

收益：首屏认知降到 4 选项；模板字段的 primary / advanced 分流（见决定 4）让 drawer 也不会爆炸。

### 决定 3：删 ParamsSection / TemplatesSection 不做兼容

两个 inspector 段（共 429 行）能力 100% 并入 Composer，没必要留 dead path。一刀删干净。

不动的边界：右 Inspector 仍保留 `ReferenceSection` 等其他段（参考图 / 历史 / favorite 等都还在），只是不再扛主流程参数。

### 决定 4：模板字段加 `placement: "primary" | "advanced"`

`commercial-templates.ts` 14 个模板的字段全部分流：

- `primary`：必填或最影响输出的（产品名 / 场景 / 主体描述等）→ Composer prompt 替代槽
- `advanced`：可选 / 调味用（光照 / 色调 / 文案 / 角度等）→ Drawer 里展开

收益：Drawer 一打开不会 30 个 input 砸脸；通用 `TemplateFieldEditor` 按 placement 分流渲染。

### 决定 5：尺寸预设业务化（11 个平台预设）

`commercial-size-presets.ts` 从 4 个 OpenAI 原生 size 扩到 11 个业务预设：电商主图 / 商详图 / 详情对比 / 横版 / 竖版 / banner / 朋友圈 / YouTube 缩略图 / 微信封面 / 头像 / 人像。每个绑定到 4 个原生 size 之一 + aspect 标签（1:1 / 16:9 / 9:16 / auto）。

`quickpick-size-trigger` 显示「业务标签 + 比例」（如「横版 16:9」），不再是裸 size 字符串「1536x1024」。

### 决定 6：prompt 长文展开走 Dialog 不展开 textarea

新增 `PromptExpandedDialog.tsx`（calm-squishing-globe Cut 4），点开后大 textarea 编辑，保存回填到 `useCreatorStudio() prompt`。

不在 Composer 内 inline 展开的原因：保持 Composer 高度稳定；展开 dialog 复用 SessionRenameDialog 的 form-isolation 模式（Portal mount/unmount 自动重置 form state）。

### 决定 7：多参考图三入口（file picker / drop / paste）+ 「+ 添加图」按钮

`calm-squishing-globe` Cut 1-3 + Cut 5：
- File picker：`composer-upload-trigger` Button + 隐藏 `composer-upload-input`
- Drop：`reference-dropzone` 仍在 Inspector，新增 Composer 内的 add slot
- Paste：clipboardData 嗅探 image files
- + 添加图按钮：`composer-reference-add` 永远跟在缩略图条尾巴
- 上限 8 张，到达后 Button 切「已达 8 张上限」+ disabled

## 拆刀（按代码注释里的 plan slug · Cut N 锚点逆推）

> 本轮 19 刀（quiet-glittering-prism 14 + calm-squishing-globe 5）汇流到一个 commit `c6a8f5f`。原本的拆刀意图保留在代码注释 + 测试用例 description 里。

### quiet-glittering-prism · 主线 14 刀

| 刀 | 内容 | 关键文件 |
| --- | --- | --- |
| Cut 1 | image-params validation 升级（PNG 透明背景 / input_fidelity / n 上限 8→10 / 风格-介质-渲染语义） | `lib/validation/image-params.ts` |
| Cut 2 | commercial-size-presets 扩到 11 个业务预设 + aspect 分组 | `lib/templates/commercial-size-presets.ts` |
| Cut 3 | commercial-templates 字段类型系统升级（placement: primary \| advanced）+ 14 模板分类 | `lib/templates/commercial-templates.ts` `lib/creator/types.ts` `lib/creator/template-render.ts` |
| Cut 4 | CreatorStudioContext 加 background / input_fidelity / style 三字段 | `components/creator/studio/CreatorStudioContext.tsx` |
| Cut 5 | CreatorWorkspace 适配新参数 + background 解锁 transparent | `components/creator/CreatorWorkspace.tsx` |
| Cut 6 | 新建 QuickPickRow（mode / + 模板 / 比例 / 高级 4-chip + 风格 chip） | `components/creator/studio/composer/QuickPickRow.tsx`（363 行） |
| Cut 7 | 新建 TemplatePickerDialog（14 模板按 4 大分类 Modal） | `components/creator/studio/composer/TemplatePickerDialog.tsx`（207 行） |
| Cut 8 | 新建 AdvancedParamsDrawer（质量 / 数量 / 流式 / 模板细节字段） | `components/creator/studio/composer/AdvancedParamsDrawer.tsx` |
| Cut 9 | 新建 TemplateFieldEditor（通用字段编辑器，按 placement 分流） | `components/creator/studio/composer/TemplateFieldEditor.tsx` |
| Cut 10 | Composer.tsx 升级：挂 QuickPickRow + composer-reference-row + 长 prompt 入口 | `components/creator/studio/Composer.tsx` |
| Cut 11 | 删 inspector/ParamsSection.tsx（278 行能力并入 drawer） | `components/creator/studio/inspector/ParamsSection.tsx` (deleted) |
| Cut 12 | 删 inspector/TemplatesSection.tsx（151 行能力并入 picker） | `components/creator/studio/inspector/TemplatesSection.tsx` (deleted) |
| Cut 13 | 全局 CSS 新增 quick-pick / drawer / template card 样式 | `app/globals.css` (+425) |
| Cut 14 | 全套测试迁移 + 修复 mask 局部编辑 case + 文档 | `tests/components/creator-shell.test.tsx` `tests/components/composer-prompt-upgrade.test.tsx` |

### calm-squishing-globe · 支线 5 刀

| 刀 | 内容 | 关键文件 |
| --- | --- | --- |
| Cut 1 | 三入口参考图上传（file picker / drop / paste） | `components/creator/CreatorWorkspace.tsx` |
| Cut 2 | composer 内长 prompt 文案 + reference 行容器 | `app/globals.css` |
| Cut 3 | composer 多参考图缩略图条（不再只在 Inspector 看） | `app/globals.css` `components/creator/studio/Composer.tsx` |
| Cut 4 | PromptExpandedDialog（长 prompt 展开 Modal） | `components/creator/studio/PromptExpandedDialog.tsx`（118 行） |
| Cut 5 | + 添加图按钮（上限 8 张，到达后 disabled） | `components/creator/studio/Composer.tsx` `tests/components/composer-prompt-upgrade.test.tsx` |

## 落地结构

```
Composer.tsx
├─ QuickPickRow（4 chip + 风格 chip）
│   ├─ 模式 chip（文生图 / 图生图，aria-pressed）
│   ├─ + 模板 chip → 触发 TemplatePickerDialog
│   ├─ 比例 chip → DropdownMenu 11 业务预设
│   └─ 高级 chip → 触发 AdvancedParamsDrawer
├─ composer-reference-row（仅图生图模式 + 已有图）
│   ├─ N 张缩略图（hover X 移除）
│   └─ + 添加图 slot（< 8 张时渲染）
├─ chat-prompt-input（textarea）
└─ composer-actions
    ├─ 提示文本（独立分支 / 默认提示）
    ├─ + 添加图 Button（图生图模式总是渲染）
    ├─ 长 prompt 展开 Button → 触发 PromptExpandedDialog
    └─ 生成图片 Button

Modals / Drawers（Portal mount）：
├─ TemplatePickerDialog ······· 14 模板 × 4 分类
├─ AdvancedParamsDrawer ········ quality / n / streaming / 模板 advanced 字段
└─ PromptExpandedDialog ········ 大 textarea

Right Inspector（仍存在，但不再扛主流程）：
└─ ReferenceSection / VersionStream / TaskStatus / Library / etc.（不动）
```

## 关键文件

**新建（5 个 + 1 测试）**：
- `components/creator/studio/composer/QuickPickRow.tsx`（363 行）
- `components/creator/studio/composer/TemplatePickerDialog.tsx`（207 行）
- `components/creator/studio/composer/AdvancedParamsDrawer.tsx`
- `components/creator/studio/composer/TemplateFieldEditor.tsx`
- `components/creator/studio/PromptExpandedDialog.tsx`（118 行）
- `tests/components/composer-prompt-upgrade.test.tsx`（新增 composer 升级回归）

**删（2 个）**：
- `components/creator/studio/inspector/ParamsSection.tsx`（278 行）
- `components/creator/studio/inspector/TemplatesSection.tsx`（151 行）

**改（11 个）**：
- `app/globals.css`（+425 / quick-pick / drawer / template-card / composer-reference-row）
- `components/creator/CreatorWorkspace.tsx`（三入口上传 + 新参数 + 解锁 transparent background）
- `components/creator/studio/Composer.tsx`（QuickPickRow + reference-row + 长 prompt 入口）
- `components/creator/studio/CreatorStudioContext.tsx`（+ background / input_fidelity / style）
- `components/theme/ThemeToggle.tsx`（同期清理）
- `lib/creator/template-render.ts`（适配 placement: primary | advanced）
- `lib/creator/types.ts`（template field 类型升级）
- `lib/creator/use-collapsed-projects.ts`（同期清理）
- `lib/templates/commercial-size-presets.ts`（4 → 11 业务预设 + aspect 分组）
- `lib/templates/commercial-templates.ts`（14 模板字段全 placement 化）
- `lib/validation/image-params.ts`（透明背景 / input_fidelity / n 上限 / 风格语义）
- `tests/components/creator-shell.test.tsx`（已有 case 跟随 UI 重组迁移）
- `tests/unit/commercial-size-presets.test.ts`（11 业务预设回归）
- `tests/unit/commercial-templates.test.ts`（14 模板 + 4 分类回归）
- `tests/unit/image-params.test.ts`（透明背景 / 新字段验证）

**完全不动**：
- 右 Inspector 其他段（`ReferenceSection` / `VersionStream` / `TaskStatus` / `LibraryShelf` 等）
- Sub2API 协议 / API 契约 / Prisma schema
- 上一轮 SessionRowMenu / branch-meta / project-store

## 不动的边界

- ❌ 不引新依赖（不上 Konva / fabric / dnd-kit）
- ❌ 不改 prisma / API 契约 / version-graph 节点结构
- ❌ 不改右 Inspector 主结构（仅删两个段）
- ❌ Board Mode 不在本轮（留 Phase C `2026-05-06-board-mode-p1-p2.md`）

## 验收

- ✅ `pnpm typecheck`
- ✅ `pnpm lint`（max-warnings=0）
- ✅ `pnpm test`（60 files / 324 tests，比上轮 +1 file +32 tests）
- 🚧 `pnpm build`（未跑，下一会话补；本轮以 typecheck + lint + test 为底线）
- 🚧 真机走查：4 chip 行在桌面 / 移动 / 暗色下的视觉一致性 + Drawer / Modal 在小屏的滚动 / 触屏体验

## 关键交互对照表

| 动作 | 旧（V1.0 Inspector 里） | 新（Composer + Modal） |
| --- | --- | --- |
| 选模板 | 右 Inspector 顶部 14 卡片网格，常驻 | + 模板 chip → TemplatePickerDialog 弹出选择，chip 切显模板名 |
| 选比例 | Inspector size dropdown，纯 size 字符串 | 比例 chip → 11 业务预设按 aspect 分组，chip 显示「业务标签 + 比例」 |
| 调质量 / 数量 / 流式 | Inspector 永久显示 | 高级 chip → AdvancedParamsDrawer（默认关闭） |
| 调模板细节字段 | 模板下方一坨 input | AdvancedParamsDrawer 内按 placement: advanced 分流 |
| 长 prompt 编辑 | textarea 直接展开溢出 | 展开 Button → PromptExpandedDialog 大 textarea |
| 加参考图 | 右 Inspector dropzone 上传 | Composer + 添加图 Button / 直接拖图 / 粘贴；上限 8 张 |
| 看已加参考图 | 右 Inspector reference list | Composer 顶部缩略图条 + Inspector 同步 |
| 切模式 | mode segmented control | mode chip（aria-pressed，不是 role=radio） |

## 经验总结

1. **「上提 + 收纳」是 UI 简化的常用组合拳** —— 把高频低决策成本的（模板入口）上提到首屏，把低频高决策成本的（高级参数）收进 drawer；总数没变，但首屏认知量降到 1/3。
2. **`placement: primary | advanced` 是模板字段的核心抽象** —— 不分层就是 30 个 input 砸脸；分层后通用 `TemplateFieldEditor` 按 placement 分流渲染，drawer / picker 都能复用同一套逻辑。
3. **删旧 path 比留兼容值钱** —— ParamsSection / TemplatesSection 共 429 行一刀删干净，避免「主流程在两处」的诡异 bug 路径。代价是「这一轮的 commit 比较大」，但每一刀都有独立的 plan slug 锚点（注释 + 测试 description），事后可对照定位。
4. **mode chip 用 `aria-pressed` 不是 `role=radio`** —— `getByRole("button", { name: "图生图" })` 在 radio 角色下找不到；segment / toggle 模式应该用 `aria-pressed` 让 testing-library 默认能命中。
5. **业务尺寸预设 chip 显示「业务标签 + 比例」** —— 普通用户看到「1536x1024」会疑惑，看到「横版 16:9」立刻知道这是哪种用途。但测试断言要跟着改：用 aspect 标签 `横版 16:9` 而不是裸 size 字符串。
6. **Sheet portal 会 inert main content** —— Drawer 打开后再去 `getByRole("textbox", { name: "Prompt" })` 会失败（main content 被 inert）。先输 prompt 再开 drawer，或者关 drawer 再断言。
7. **TemplatePickerDialog 选中后 chip 文本会被替换** —— `getByRole("button", { name: /局部编辑/ })` 会同时命中 chip + 卡片，断言要用 testid（如 `template-card-tpl_mask_local_edit`）保持唯一性。
8. **两条线汇流到一个 commit 是无奈但可接受** —— `quiet-glittering-prism` + `calm-squishing-globe` 都改 `Composer.tsx`，分开 commit 会反复改同一个文件；plan slug 锚点保留在代码注释里足以追踪。下次要避免一条 commit 带两个 slug 时，提前设计哪条线先并好再开第二条。
9. **不要 Read 整个 CreatorWorkspace.tsx** —— 1700+ 行单读会逼近 32MB transcript 上限。本轮全靠 Grep 找 anchor 行号 + offset/limit Read 局部，这是 CLAUDE.md 里硬约束的真实价值。
