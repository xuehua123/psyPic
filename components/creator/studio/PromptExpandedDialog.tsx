"use client";

import * as React from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useCreatorStudio } from "@/components/creator/studio/CreatorStudioContext";

/**
 * Prompt 展开编辑 Modal —— 把当前 chat-prompt-input 的内容放到一个大尺寸
 * Dialog 里编辑，保存后回填到 useCreatorStudio() 的 prompt state。
 *
 * 与 SessionRenameDialog / ProjectRenameDialog 同模式：form state 隔离在
 * 子组件（PromptExpandedForm），靠 Portal mount/unmount 自动重置（避免
 * 在父组件 effect-setState 里同步 state）。
 *
 * 设计要点（plan slug calm-squishing-globe · Cut 4）：
 * - 取消按钮 / 关闭 Modal：不写回（现 prompt 不变）
 * - 保存按钮：调 setPrompt(value) 然后 onOpenChange(false)
 * - shadcn Textarea 自带 `field-sizing: content`，Modal 内 textarea 高度
 *   随内容自然增长；min-h-[50vh] 保证初始视野足够大
 * - 大尺寸 DialogContent (sm:max-w-2xl) —— 比默认更宽，适合长 prompt
 */
export type PromptExpandedDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export default function PromptExpandedDialog({
  open,
  onOpenChange
}: PromptExpandedDialogProps) {
  const { prompt, setPrompt } = useCreatorStudio();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-2xl"
        data-testid="prompt-expanded-dialog"
      >
        <PromptExpandedForm
          initialValue={prompt}
          onCancel={() => onOpenChange(false)}
          onSubmit={(value) => {
            setPrompt(value);
            onOpenChange(false);
          }}
        />
      </DialogContent>
    </Dialog>
  );
}

function PromptExpandedForm({
  initialValue,
  onCancel,
  onSubmit
}: {
  initialValue: string;
  onCancel: () => void;
  onSubmit: (value: string) => void;
}) {
  const [value, setValue] = React.useState(initialValue);

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    onSubmit(value);
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>展开编辑 Prompt</DialogTitle>
        <DialogDescription>
          用更大的视野编辑商业 prompt；保存后回填到对话输入框。
        </DialogDescription>
      </DialogHeader>
      <form className="grid gap-3" onSubmit={handleSubmit}>
        <Textarea
          autoFocus
          className="min-h-[50vh] max-h-[70vh]"
          data-testid="prompt-expanded-textarea"
          onChange={(event) => setValue(event.target.value)}
          placeholder="描述你要生成的商业图片"
          value={value}
        />
        <DialogFooter>
          <Button onClick={onCancel} type="button" variant="outline">
            取消
          </Button>
          <Button data-testid="prompt-expanded-submit" type="submit">
            保存
          </Button>
        </DialogFooter>
      </form>
    </>
  );
}
