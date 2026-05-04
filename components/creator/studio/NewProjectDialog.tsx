"use client";

import * as React from "react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * 新建项目对话框 —— 输入标题，确认后调 onSubmit。
 *
 * 内部 form state 隔离在 NewProjectForm 子组件里，借 DialogContent 的
 * Portal mount / unmount 自然每次开窗都拿到全新 state（避免在 effect 里
 * setState 触发 react-hooks/set-state-in-effect）。
 */
export type NewProjectDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (title: string) => Promise<void> | void;
};

export default function NewProjectDialog({
  open,
  onOpenChange,
  onSubmit
}: NewProjectDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-testid="new-project-dialog">
        <NewProjectForm onCancel={() => onOpenChange(false)} onSubmit={async (title) => {
          await onSubmit(title);
          onOpenChange(false);
        }} />
      </DialogContent>
    </Dialog>
  );
}

function NewProjectForm({
  onCancel,
  onSubmit
}: {
  onCancel: () => void;
  onSubmit: (title: string) => Promise<void> | void;
}) {
  const [title, setTitle] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const trimmed = title.trim();
    if (!trimmed || submitting) {
      return;
    }
    setSubmitting(true);
    try {
      await onSubmit(trimmed);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>新建项目</DialogTitle>
        <DialogDescription>
          创建一个新的本地项目，把相关对话与生成结果归到一起。
        </DialogDescription>
      </DialogHeader>
      <form className="grid gap-3" onSubmit={handleSubmit}>
        <div className="grid gap-1.5">
          <Label htmlFor="new-project-title">项目名称</Label>
          <Input
            autoFocus
            data-testid="new-project-title-input"
            id="new-project-title"
            maxLength={64}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="例：电商主图 · 5 月活动"
            value={title}
          />
        </div>
        <DialogFooter>
          <Button onClick={onCancel} type="button" variant="outline">
            取消
          </Button>
          <Button
            data-testid="new-project-submit"
            disabled={!title.trim() || submitting}
            type="submit"
          >
            {submitting ? "创建中…" : "创建"}
          </Button>
        </DialogFooter>
      </form>
    </>
  );
}
