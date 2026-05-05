# 画廊工作台与对话式版本流设计

## 目标

把创作台从“三栏表单工具”升级为“画廊工作台 + 对话式版本流”。生成结果成为主视野；每次生成都是一个可回溯节点；从历史节点继续生成时不删除后续节点，而是创建新的分支系对话。

这份设计现在也可以视为图片工作台版本节点层的底座：它描述的是 version node、branch、Composer 回填和非破坏分叉的核心语义，而不只是一个局部画廊 UI。

## 核心原则

- 图片结果优先：主区用于浏览、对比、选择多版本结果。
- 参数可追溯：每个节点保存 prompt、模型、尺寸、质量、格式、压缩、moderation、参考图摘要、request id、耗时和 token。
- 分叉非破坏：从任意历史节点继续生成时，新节点挂到该节点下，形成新分支，不覆盖、不截断旧路径。
- 回溯分两层：恢复参数只把节点参数带回 Composer；回到版本会把主画廊切到该节点结果。
- Board 可演进：第一阶段用分支图预览节点关系，后续主区可切换为可拖拽 Board。

## 信息架构

```text
顶部栏
  PsyPic / 当前项目 / 运行状态 / 设置

左侧轨道
  模板
  素材
  历史
  批量

中间主区
  当前节点标题与分支路径
  当前批次图片画廊
  多图选择、对比、下载、继续编辑、作为参考图
  空状态时展示模板入口与最近节点

右侧 Inspector
  当前选中图片
  当前节点参数快照
  引用链：父节点、参考图、来源作品
  操作：恢复参数、从此分叉、发布、举报/隐私入口

底部 Composer
  Prompt 输入
  关键参数快捷项
  生成按钮
  当前上下文提示：基于哪个节点继续

版本流 / 分支图
  对话式节点列表
  每个节点显示 prompt 摘要、参数摘要、结果缩略图、状态
  分支图显示 parent -> child 关系
```

## 数据模型

前端第一阶段用 `CreatorVersionNode` 表达创作节点：

```ts
type CreatorVersionNode = {
  id: string;
  parentId: string | null;
  branchId: string;
  branchLabel: string;
  depth: number;
  createdAt: string;
  status: "succeeded" | "failed" | "running" | "queued";
  prompt: string;
  params: ImageGenerationParams;
  images: GenerationImage[];
  selectedImageId?: string;
  requestId?: string;
  upstreamRequestId?: string;
  usage?: GenerationResult["usage"];
  durationMs?: number;
  source: "generation" | "edit" | "history" | "same";
};
```

本地历史继续使用 IndexedDB，但扩展可选字段：

- `images?: GenerationImage[]`
- `parentTaskId?: string | null`
- `branchId?: string`
- `branchLabel?: string`
- `versionNodeId?: string`

旧历史没有这些字段时，作为独立根节点导入。

## 分叉语义

- 当前没有活动节点时生成：创建根节点，`parentId = null`。
- 从当前最新节点生成：新节点作为当前节点的 child。
- 用户选中历史节点 A 后点击“从此分叉”：Composer 上下文变成 A；下一次生成的新节点 parent 为 A。
- 如果 A 已经有后续节点，新节点使用新的 `branchId` 和 `branchLabel`，旧子节点保留。
- UI 不做“删除分叉之后所有内容”的 destructive 操作。

## 回溯语义

- `恢复参数`：只恢复 prompt 和参数到 Composer，不切换主画廊。
- `回到版本`：切换 activeNodeId，主画廊显示该节点图片，Inspector 显示该节点参数。
- `从此分叉`：先回到该节点，再标记 Composer 的 `forkParentId`。

## 第一阶段范围

- 重排 CreatorWorkspace 为画廊工作台。
- 引入版本节点 state 与本地历史兼容转换。
- 生成成功后写入版本节点。
- 版本流展示节点、参数摘要、缩略图。
- 支持恢复参数、回到版本、从此分叉。
- 支持右侧 Inspector 查看当前节点参数。
- 增加轻量分支图预览，使用 CSS 布局展示层级和连接关系。

## 暂不做

- 不做真正无限画布拖拽。
- 不做多人协作。
- 不做完整项目级云端版本图。
- 不改 Sub2API 请求协议。
- 不破坏现有素材库、社区发布、批量任务接口。

## 验收标准

- 一次生成多张图时，主区有足够空间浏览所有版本。
- 每次生成后版本流出现一条节点，节点可看到 prompt 和参数摘要。
- 从历史节点分叉生成后，旧节点和旧后续仍保留，新节点显示为新分支。
- 点击恢复参数后 Composer 与参数控件回到该节点快照。
- 点击回到版本后主画廊显示该节点图片。
- 移动端主流程仍能生成、查看版本、恢复参数。
