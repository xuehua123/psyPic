"use client";

import * as React from "react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from "@/components/ui/alert-dialog";

/**
 * 删除项目确认 —— 不可逆动作；最后 1 个项目时禁用 Action 按钮兜底。
 * Submitting state 在 AlertContent 子组件里，借 Portal mount/unmount
 * 自动重置。
 */
export type ProjectDeleteAlertProps = {
  open: boolean;
  projectTitle: string;
  /** 项目总数；用于禁用「删除最后一个」防呆。 */
  projectCount: number;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => Promise<void> | void;
};

export default function ProjectDeleteAlert({
  open,
  projectTitle,
  projectCount,
  onOpenChange,
  onConfirm
}: ProjectDeleteAlertProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent data-testid="project-delete-alert">
        <DeleteAlertBody
          isLast={projectCount <= 1}
          onConfirm={async () => {
            await onConfirm();
            onOpenChange(false);
          }}
          projectTitle={projectTitle}
        />
      </AlertDialogContent>
    </AlertDialog>
  );
}

function DeleteAlertBody({
  isLast,
  onConfirm,
  projectTitle
}: {
  isLast: boolean;
  onConfirm: () => Promise<void> | void;
  projectTitle: string;
}) {
  const [submitting, setSubmitting] = React.useState(false);

  async function handleConfirm(event: React.MouseEvent) {
    event.preventDefault();
    if (submitting || isLast) {
      return;
    }
    setSubmitting(true);
    try {
      await onConfirm();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <AlertDialogHeader>
        <AlertDialogTitle>移除项目「{projectTitle}」？</AlertDialogTitle>
        <AlertDialogDescription>
          {isLast
            ? "至少要保留一个项目，无法删除最后一个项目。请先新建一个再回来。"
            : "项目下的对话与生成节点会失去归属（仍保留在历史里）。该动作不可撤销。"}
        </AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel data-testid="project-delete-cancel">
          取消
        </AlertDialogCancel>
        <AlertDialogAction
          data-testid="project-delete-confirm"
          disabled={isLast || submitting}
          onClick={handleConfirm}
        >
          {submitting ? "删除中…" : "确认删除"}
        </AlertDialogAction>
      </AlertDialogFooter>
    </>
  );
}
