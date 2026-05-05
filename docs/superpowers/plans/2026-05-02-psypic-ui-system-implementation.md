# PsyPic 整站 UI 系统 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 `docs/superpowers/specs/2026-05-02-psypic-ui-system-design.md` 落成可交付的整站 UI 重构，统一工作台、社区、详情、设置、管理台的产品壳、导航、视觉语义和移动端结构，同时不破坏当前新版 chat studio 的核心交互。

它现在也被视为 `19-图片工作台改造蓝图.md` 的实施层配套：这里只负责把工作台壳、版本流、任务 runtime、命令面板和项目侧栏做成一致的 UI 事实，不再单独假设它们是彼此无关的页面能力。

**Architecture:** 采用“全局产品壳优先、页面分层接入、工作台最后深调”的纵向切片策略。先建立站点级 shell 和导航，再把社区、详情、设置、管理台接入统一壳，最后收敛工作台内部重复入口和视觉系统，避免一开始就在 `CreatorWorkspace.tsx` 上进行过大的耦合改动。

**Tech Stack:** Next.js App Router、React Client Components、TypeScript、Vitest、Testing Library、CSS via `app/globals.css`、lucide-react。

## 当前状态

- `2026-05-02` 已完成 Task 1 至 Task 7 的落地实现。
- 已上线统一产品壳 `AppShell` / `AppTopNav`，并接入工作台、社区、作品详情、素材详情、设置页、管理台。
- 工作台已移除左侧重复的 `社区 / 设置` 站点级入口，保留 `项目 / 对话 / 分支 / Inspector` 语义分层。
- 已在 `app/globals.css` 完成全局导航、页面壳、工作台壳和移动端导航的统一样式收口。
- 已完成验证：`git diff --check`、`pnpm lint`、`pnpm typecheck`、`pnpm test`、`pnpm build`。

---

## 执行原则

- 每个行为变更先写失败测试，再实现，再回归。
- 先建立全局产品壳，再逐页接入，不直接在所有页面同时散改。
- 保持 chat studio 的左中右三层语义，不把工作台内部工具误提升为全局导航。
- 新旧 UI 共存阶段允许局部重复，但每个阶段都要消除新增重复入口。
- 每个阶段完成后至少运行对应测试、`pnpm lint`、`pnpm typecheck`。
- 最终收口前统一跑：`git diff --check`、`pnpm lint`、`pnpm typecheck`、`pnpm test`、`pnpm build`。

## Task 1: 建立全局产品壳与导航骨架

**Files:**
- Create: `components/layout/AppShell.tsx`
- Create: `components/layout/AppTopNav.tsx`
- Optionally create: `components/layout/AppPageHeader.tsx`
- Modify: `app/layout.tsx`
- Modify: `app/globals.css`
- Test: `tests/components/app-shell.test.tsx`

- [ ] **Step 1: 写失败测试**

为全局产品壳新增组件测试，覆盖：

- 在普通页面能显示 `PsyPic` 品牌。
- 主导航仅包含 `工作台`、`灵感社区`。
- utility 区包含 `设置`。
- `管理台` 支持条件显示，不默认出现在普通用户视图。

Run:

```bash
pnpm vitest --run tests/components/app-shell.test.tsx
```

Expected: FAIL because shell components do not exist.

- [ ] **Step 2: 实现全局产品壳**

创建统一的页面外壳组件：

- 品牌区
- 主导航区
- 右侧 utility 区
- 当前页高亮样式

要求：

- 不把 `项目`、`对话`、`模板`、`历史与素材` 放进主导航。
- 主导航只保留系统级页面。
- utility 区为设置、管理入口预留样式和布局。

- [ ] **Step 3: 实现全局导航视觉基础**

在 `app/globals.css` 中新增：

- 悬浮式 top nav
- 半透明表面
- 低对比 active pill
- 页面宽度容器与顶部安全间距

- [ ] **Step 4: 跑组件测试**

```bash
pnpm vitest --run tests/components/app-shell.test.tsx
```

Expected: PASS.

## Task 2: 社区、作品详情、素材详情接入统一产品壳

**Files:**
- Modify: `components/community/CommunityFeedPage.tsx`
- Modify: `components/community/CommunityWorkDetailPage.tsx`
- Modify: `components/library/LibraryAssetDetailPage.tsx`
- Modify: `app/globals.css`
- Test: `tests/components/community-feed.test.tsx`
- Test: `tests/components/community-work-detail.test.tsx`
- Optionally create/modify: `tests/components/library-detail-page.test.tsx`

- [ ] **Step 1: 为页面壳接入写失败测试**

扩展或新增测试，覆盖：

- 社区页使用统一产品壳，而不是孤立 `返回创作台` 页头。
- 作品详情页保留同款主 CTA，并接入统一页面壳。
- 素材详情页保留 `继续编辑` 主动作，并接入统一页面壳。

Run:

```bash
pnpm vitest --run tests/components/community-feed.test.tsx tests/components/community-work-detail.test.tsx
```

Expected: FAIL until markup is updated.

- [ ] **Step 2: 重构社区页头**

移除社区页孤立的页面头部模式，改成：

- 外层全局壳
- 内层页面标题区
- 筛选区
- 作品网格

保持现有排序、场景、标签逻辑不变。

- [ ] **Step 3: 重构作品详情页壳**

将详情页改为：

- 全局壳
- 页面主体双栏
- 主图 + 信息侧栏

保持：

- 点赞
- 收藏
- 举报
- `生成同款草稿`
- `套用到创作台`

- [ ] **Step 4: 重构素材详情页壳**

将详情页头部从“返回创作台 + 品牌标题”迁移到全局产品壳下。

重点保留：

- 下载
- 继续编辑
- 素材元信息

- [ ] **Step 5: 跑组件测试**

```bash
pnpm vitest --run tests/components/community-feed.test.tsx tests/components/community-work-detail.test.tsx
```

Expected: PASS.

## Task 3: 设置页与管理台接入统一产品壳

**Files:**
- Modify: `app/settings/page.tsx`
- Modify: `components/settings/ApiSettingsForm.tsx`
- Modify: `app/admin/page.tsx`
- Modify: `components/admin/AdminDashboardPage.tsx`
- Modify: `app/globals.css`
- Test: `tests/components/settings-page.test.tsx`
- Test: `tests/components/admin-dashboard.test.tsx`

- [ ] **Step 1: 写失败测试**

覆盖：

- 设置页接入统一产品壳后仍保留安全说明和 BFF 语义。
- 管理台在统一产品壳下仍保留指标、运行时配置、举报、审计结构。
- 管理台入口属于 utility 语义，而不是主导航项。

Run:

```bash
pnpm vitest --run tests/components/admin-dashboard.test.tsx tests/components/settings-page.test.tsx
```

Expected: FAIL until page shell changes land.

- [ ] **Step 2: 重构设置页结构**

要求：

- 使用全局壳。
- 保持页面安静、可信、偏系统工具页面。
- 强化输入项、说明、成功/失败提示之间的层级。

- [ ] **Step 3: 重构管理台结构**

要求：

- 使用全局壳。
- 保持管理台稳定、密度高、控制感强。
- 危险动作语义清晰，不能被品牌展示稀释。

- [ ] **Step 4: 跑组件测试**

```bash
pnpm vitest --run tests/components/admin-dashboard.test.tsx tests/components/settings-page.test.tsx
```

Expected: PASS.

## Task 4: 工作台接入全局产品壳并清理重复导航

**Files:**
- Modify: `components/creator/CreatorWorkspace.tsx`
- Modify: `app/(creator)/page.tsx`
- Modify: `app/globals.css`
- Modify: `tests/components/creator-shell.test.tsx`

- [ ] **Step 1: 写失败测试**

覆盖：

- chat studio 页面接入全局产品壳。
- 左侧 sidebar 保持项目 / 对话语义，不新增站点级导航。
- 左侧底部重复的 `社区 / 设置` 入口被移除、降级，或不再作为主导航。
- 右侧 Inspector 仍保留参数、模板、历史、素材语义。

Run:

```bash
pnpm vitest --run tests/components/creator-shell.test.tsx
```

Expected: FAIL until shell integration is complete.

- [ ] **Step 2: 将工作台包进全局壳**

要求：

- 顶部全局导航属于站点层。
- chat studio 本体仍保持左中右三列。
- 不改动项目 / 对话 / 分支核心数据流。

- [ ] **Step 3: 清理 sidebar 底部重复入口**

按 spec 收敛：

- `社区`
- `设置`

避免与全局导航重复。

- [ ] **Step 4: 校正工作台内部视觉层级**

重点处理：

- 当前对话头部
- 对话消息
- 版本流动作
- Composer
- Inspector section heading

确保语义清楚但不过度装饰。

- [ ] **Step 5: 跑工作台测试**

```bash
pnpm vitest --run tests/components/creator-shell.test.tsx
```

Expected: PASS.

## Task 5: 统一视觉令牌、按钮层级、卡片与状态样式

**Files:**
- Modify: `app/globals.css`
- Modify: `components/community/CommunityFeedPage.tsx`
- Modify: `components/community/CommunityWorkDetailPage.tsx`
- Modify: `components/library/LibraryAssetDetailPage.tsx`
- Modify: `components/admin/AdminDashboardPage.tsx`
- Modify: `components/settings/ApiSettingsForm.tsx`
- Modify: `components/creator/CreatorWorkspace.tsx`

- [ ] **Step 1: 收敛按钮系统**

统一：

- `primary-button`
- `secondary-button`
- `ghost-button`
- icon utility button

要求：

- 各页面主 CTA 只有一个视觉主按钮。
- 危险动作与普通 secondary 分离。

- [ ] **Step 2: 收敛卡片系统**

统一：

- 作品卡
- 结果卡
- 指标卡
- 设置/管理面板

要求：

- 圆角、描边、hover、阴影语义一致。
- 图片卡片固定比例。

- [ ] **Step 3: 收敛标签与状态**

统一：

- `template-pill`
- status strip
- chips
- badge

要求：

- 精选、可同款、运行状态、分支标签等都使用统一节奏。

- [ ] **Step 4: 手动视觉检查**

桌面端确认：

- 工作台、社区、详情、设置、管理台像同一个产品。
- 不出现“有的像工具、有的像后台、有的像旧页面”的割裂感。

## Task 6: 移动端结构重排

**Files:**
- Modify: `app/globals.css`
- Modify: `components/creator/CreatorWorkspace.tsx`
- Modify: `components/community/CommunityFeedPage.tsx`
- Modify: `components/community/CommunityWorkDetailPage.tsx`
- Modify: `components/library/LibraryAssetDetailPage.tsx`
- Modify: `components/admin/AdminDashboardPage.tsx`
- Test: `tests/components/creator-shell.test.tsx`
- Optionally modify/create: mobile-focused component tests

- [ ] **Step 1: 写失败断言或补现有测试**

覆盖：

- 工作台移动端仍保留主流程。
- 社区筛选不会把首屏挤爆。
- 详情页 CTA 在移动端首屏可达。

- [ ] **Step 2: 重排工作台移动端**

目标：

- 全局导航收纳。
- 左侧对话抽屉化。
- Inspector 底部抽屉化。
- Composer 固底。

- [ ] **Step 3: 重排社区与详情移动端**

目标：

- 社区筛选转 chips + 抽屉。
- 作品详情主图优先。
- 素材详情 `继续编辑` 不能沉底不可见。

- [ ] **Step 4: 重排设置和管理台移动端**

目标：

- 保证基础可用，不追求桌面密度复制。

## Task 7: 文档、验收与最终回归

**Files:**
- Modify: `docs/14-视觉与竞品对标标准.md`
- Modify: `docs/17-测试与验收用例.md`
- Modify: `README.md`
- Optionally modify: `docs/文档索引.md`

- [ ] **Step 1: 更新文档索引和验收项**

将新的 UI 系统 spec 和 implementation plan 纳入文档索引，并为：

- 全局壳
- 工作台
- 社区
- 详情
- 设置
- 管理台
- 移动端

补充验收项。

- [ ] **Step 2: 跑完整验证**

```bash
git diff --check
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Expected: all pass.

- [ ] **Step 3: 人工走查**

桌面端与移动端至少走查：

- `/`
- `/community`
- `/community/works/[workId]`
- `/library/[assetId]`
- `/settings`
- `/admin`

确认：

- 导航层级清楚
- 主 CTA 清楚
- 页面壳统一
- 没有遗留旧样式孤岛
