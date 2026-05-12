"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { login, register } from "@/lib/client/auth-api";
import { useSession } from "./SessionProvider";

export function AuthDialog({
  open,
  onOpenChange
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { refreshSession } = useSession();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      if (mode === "login") {
        const result = await login(email, password);
        if (result.success) {
          await refreshSession();
          onOpenChange(false);
        } else {
          setError(result.error.message);
        }
      } else {
        const result = await register(email, password, displayName);
        if (result.success) {
          await refreshSession();
          onOpenChange(false);
        } else {
          setError(result.error.message);
        }
      }
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>{mode === "login" ? "登录" : "注册"}</DialogTitle>
          <DialogDescription>
            {mode === "login"
              ? "登录您的 PsyPic 账号以继续。"
              : "创建一个 PsyPic 账号。"}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="mt-2 flex flex-col gap-4">
          {mode === "register" && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="display_name">显示名称</Label>
              <Input
                disabled={isLoading}
                id="display_name"
                onChange={(e) => setDisplayName(e.target.value)}
                required
                value={displayName}
              />
            </div>
          )}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="email">邮箱</Label>
            <Input
              disabled={isLoading}
              id="email"
              onChange={(e) => setEmail(e.target.value)}
              required
              type="email"
              value={email}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="password">密码</Label>
            <Input
              disabled={isLoading}
              id="password"
              onChange={(e) => setPassword(e.target.value)}
              required
              type="password"
              value={password}
            />
          </div>
          {error && <div className="text-sm text-destructive">{error}</div>}
          <Button className="w-full" disabled={isLoading} type="submit">
            {isLoading ? "处理中..." : mode === "login" ? "登录" : "注册"}
          </Button>
          <div className="mt-2 text-center text-sm text-muted-foreground">
            {mode === "login" ? "没有账号？" : "已有账号？"}
            <button
              className="ml-1 text-accent hover:underline focus:outline-none"
              onClick={() => {
                setMode(mode === "login" ? "register" : "login");
                setError("");
              }}
              type="button"
            >
              {mode === "login" ? "注册" : "登录"}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
