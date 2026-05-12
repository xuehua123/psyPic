"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useSession } from "./SessionProvider";
import { AuthDialog } from "./AuthDialog";
import { logout } from "@/lib/client/auth-api";

export function SessionGate() {
  const { state, refreshSession } = useSession();
  const [dialogOpen, setDialogOpen] = useState(false);

  if (state.status === "loading") {
    return <div className="text-sm text-muted-foreground">加载中...</div>;
  }

  if (state.status === "unavailable") {
    return (
      <div className="text-sm text-yellow-600 dark:text-yellow-500">
        本地离线模式 (服务不可用)
      </div>
    );
  }

  if (state.status === "network_error") {
    return (
      <div className="flex items-center gap-2">
        <span className="text-sm text-destructive">网络错误</span>
        <Button onClick={() => refreshSession()} size="sm" variant="outline">
          重试
        </Button>
      </div>
    );
  }

  const { authenticated, user, binding } = state.data;

  if (!authenticated) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">未登录</span>
        <Button onClick={() => setDialogOpen(true)} size="sm" variant="default">
          登录 / 注册
        </Button>
        <AuthDialog onOpenChange={setDialogOpen} open={dialogOpen} />
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3">
      <div className="flex flex-col items-end">
        <span className="text-sm font-medium leading-none">
          {user?.display_name}
        </span>
        <span className="mt-1 text-xs text-muted-foreground">
          {binding ? "已绑定 API Key" : "未绑定 API Key"}
        </span>
      </div>
      <Button
        onClick={async () => {
          await logout();
          await refreshSession();
        }}
        size="sm"
        variant="outline"
      >
        登出
      </Button>
    </div>
  );
}
