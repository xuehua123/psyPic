# Codex 式项目对话创作台设计

## 目标

把 PsyPic 创作台从画廊表单改成项目制 Chat Studio。用户进入首页后看到的是一个固定高度的创作 IDE：左侧管理项目和对话，中间是当前对话流，右侧是参数、模板、素材、批量、版本和分支 Inspector。Prompt Composer 永远固定在中间底部，不再需要滚动页面寻找输入区。

## 布局

```text
PsyPic Chat Studio
├─ Project Sidebar
│  ├─ 项目列表
│  ├─ 当前项目下的对话/分支
│  └─ 社区、设置入口
├─ Chat Workspace
│  ├─ 当前对话标题和 Board 入口
│  ├─ Transcript，仅此区域滚动
│  └─ Fixed Composer，始终贴底
└─ Inspector
   ├─ 生成参数
   ├─ 图生图参考图/遮罩
   ├─ 商业模板
   ├─ 版本流和分支图
   ├─ 批量工作流
   └─ 素材与历史
```

## 交互语义

- 项目制：当前阶段先用本地默认项目表达项目壳，后续接数据库模型。
- 对话制：每次生成渲染成用户 Prompt 消息和 PsyPic 结果消息。
- 非破坏分叉：从任意版本节点“从此分叉”只改变下一次生成的 parent，不删除旧后续。
- 回溯：恢复参数只写回 Composer；回到版本只切换 active node。
- 移动端：隐藏侧边栏和 Inspector，保留中间对话流与底部 Composer。

## 验收标准

- 页面本身不产生浏览器级滚动，左中右区域各自内部滚动。
- 桌面端 Composer 底边贴住视口底部。
- 移动端 Composer 底边贴住视口底部。
- 生成结果以对话消息形式出现，并包含图片、参数摘要、request id、usage。
- 版本流、分支图、Inspector 仍可查看和操作。
- 旧版画廊工作台可通过 `NEXT_PUBLIC_PSYPIC_LEGACY_CREATOR=1` 临时回退。
