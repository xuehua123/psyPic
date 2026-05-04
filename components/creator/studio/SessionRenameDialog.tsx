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
 * 重命名会话对话框 —— 输入新标题；初始值由父级传入。
 *
 * 与 ProjectRenameDialog 同模式：form state 隔离在子组件，靠 Portal
 * mount/unmount 自动重置（避免 effect-setState 警告）。空字符串提交
 * 视为「清除自定义标题，恢复默认」（store 层把空字符串 normalize 为
 * undefined）。
 */
export type SessionRenameDialogProps = {
  open: boolean;
  initialTitle: string;
  onOpenChange: (open: boolean) => void;
  onSubmit: (title: string) => Promise<void> | void;
};

export default function SessionRenameDialog({
  open,
  initialTitle,
  onOpenChange,
  onSubmit
}: SessionRenameDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-testid="session-rename-dialog">
        <RenameSessionForm
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

function RenameSessionForm({
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
    if (submitting) {
      return;
    }
    const trimmed = title.trim();
    // 允许提交空（恢复默认）和提交相同（即 no-op）—— 但相同时禁用按钮即可，
    // 不在 submit 里再 short-circuit；让 onSubmit 决定是否要 update store
    if (trimmed === initialTitle.trim()) {
      return;
    }
    setSubmitting(true);
    try {
      await onSubmit(trimmed);
    } finally {
      setSubmitting(false);
    }
  }

  const trimmed = title.trim();
  const isUnchanged = trimmed === initialTitle.trim();

  return (
    <>
      <DialogHeader>
        <DialogTitle>重命名对话</DialogTitle>
        <DialogDescription>
          自定义会话标题；留空可恢复使用 prompt 摘要作为默认标题。
        </DialogDescription>
      </DialogHeader>
      <form className="grid gap-3" onSubmit={handleSubmit}>
        <div className="grid gap-1.5">
          <Label htmlFor="session-rename-title">会话标题</Label>
          <Input
            autoFocus
            data-testid="session-rename-input"
            id="session-rename-title"
            maxLength={80}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="留空恢复默认"
            value={title}
          />
        </div>
        <DialogFooter>
          <Button onClick={onCancel} type="button" variant="outline">
            取消
          </Button>
          <Button
            data-testid="session-rename-submit"
            disabled={isUnchanged || submitting}
            type="submit"
          >
            {submitting ? "保存中…" : "保存"}
          </Button>
        </DialogFooter>
      </form>
    </>
  );
}
