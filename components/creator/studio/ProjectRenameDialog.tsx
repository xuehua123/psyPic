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
 * 重命名项目对话框 —— 输入新标题；初始值由父级传入。
 * Form state 隔离在 RenameProjectForm 子组件，靠 Portal mount/unmount
 * 自动重置（避免 effect-setState 警告）。
 */
export type ProjectRenameDialogProps = {
  open: boolean;
  initialTitle: string;
  onOpenChange: (open: boolean) => void;
  onSubmit: (title: string) => Promise<void> | void;
};

export default function ProjectRenameDialog({
  open,
  initialTitle,
  onOpenChange,
  onSubmit
}: ProjectRenameDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-testid="project-rename-dialog">
        <RenameProjectForm
          initialTitle={initialTitle}
          onCancel={() => onOpenChange(false)}
          onSubmit={async (title) => {
            await onSubmit(title);
            onOpenChange(false);
          }}
        />
      </DialogContent>
    </Dialog>
  );
}

function RenameProjectForm({
  initialTitle,
  onCancel,
  onSubmit
}: {
  initialTitle: string;
  onCancel: () => void;
  onSubmit: (title: string) => Promise<void> | void;
}) {
  const [title, setTitle] = React.useState(initialTitle);
  const [submitting, setSubmitting] = React.useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const trimmed = title.trim();
    if (!trimmed || trimmed === initialTitle || submitting) {
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
        <DialogTitle>重命名项目</DialogTitle>
        <DialogDescription>
          修改项目标题不会影响项目下已有的对话与生成结果。
        </DialogDescription>
      </DialogHeader>
      <form className="grid gap-3" onSubmit={handleSubmit}>
        <div className="grid gap-1.5">
          <Label htmlFor="project-rename-title">项目名称</Label>
          <Input
            autoFocus
            data-testid="project-rename-input"
            id="project-rename-title"
            maxLength={64}
            onChange={(event) => setTitle(event.target.value)}
            value={title}
          />
        </div>
        <DialogFooter>
          <Button onClick={onCancel} type="button" variant="outline">
            取消
          </Button>
          <Button
            data-testid="project-rename-submit"
            disabled={
              !title.trim() || title.trim() === initialTitle || submitting
            }
            type="submit"
          >
            {submitting ? "保存中…" : "保存"}
          </Button>
        </DialogFooter>
      </form>
    </>
  );
}
