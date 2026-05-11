"use client";

import { KeyRound, Save } from "lucide-react";
import { type FormEvent, useState } from "react";

import { useSession } from "@/components/auth/SessionProvider";
import { bindManualKey } from "@/lib/client/manual-key-api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";

type DraftSettings = {
  baseUrl: string;
  apiKey: string;
  defaultModel: string;
};

export default function ApiSettingsForm() {
  const [draft, setDraft] = useState<DraftSettings>({
    baseUrl: "",
    apiKey: "",
    defaultModel: "gpt-image-2"
  });
  const [message, setMessage] = useState("");
  const [variant, setVariant] = useState<"success" | "error" | null>(null);
  const { state, refreshSession } = useSession();

  if (state.status === "loading") {
    return <div className="text-sm text-muted-foreground py-4">加载状态中...</div>;
  }

  if (state.status === "loaded" && !state.data.authenticated) {
    return (
      <div className="text-sm text-muted-foreground py-4 flex flex-col gap-2">
        <div className="flex items-center gap-2 text-foreground font-medium">
          <KeyRound className="size-4" /> 需登录后配置
        </div>
        请先在右上角或工作台完成登录，然后在此绑定 API Key。
      </div>
    );
  }

  function updateDraft<Key extends keyof DraftSettings>(
    key: Key,
    value: DraftSettings[Key]
  ) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setVariant(null);

    const result = await bindManualKey(
      draft.baseUrl,
      draft.apiKey,
      draft.defaultModel
    );

    if (result.success) {
      setDraft((current) => ({ ...current, apiKey: "" }));
      setMessage("已通过 BFF 建立 key binding。");
      setVariant("success");
      await refreshSession();
      return;
    }

    setMessage(result.error.message || "保存失败，请检查 Base URL 和 API Key。");
    setVariant("error");
  }

  return (
    <form className="flex flex-col gap-5" onSubmit={handleSubmit}>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="sub2api-base-url">Sub2API Base URL</Label>
        <Input
          id="sub2api-base-url"
          inputMode="url"
          onChange={(event) => updateDraft("baseUrl", event.target.value)}
          placeholder="https://sub2api.example.com/v1"
          type="url"
          value={draft.baseUrl}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="manual-api-key">API Key</Label>
        <Input
          autoComplete="off"
          id="manual-api-key"
          onChange={(event) => updateDraft("apiKey", event.target.value)}
          placeholder="只在当前页面内存中暂存"
          type="password"
          value={draft.apiKey}
        />
        <p className="flex items-center gap-1.5 text-[12px] text-muted-foreground">
          <KeyRound aria-hidden className="size-3.5" />
          明文 key 不写入浏览器长期存储（localStorage / sessionStorage / IndexedDB）。
        </p>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="default-model">默认模型</Label>
        <Select
          onValueChange={(value) => updateDraft("defaultModel", value)}
          value={draft.defaultModel}
        >
          <SelectTrigger aria-label="默认模型" id="default-model">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="gpt-image-2">gpt-image-2</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center gap-3 pt-1">
        <Button type="submit">
          <Save aria-hidden className="size-4" />
          保存到 BFF
        </Button>
        {message ? (
          <p
            className={
              variant === "success"
                ? "text-[12.5px] text-emerald-700"
                : variant === "error"
                  ? "text-[12.5px] text-destructive"
                  : "text-[12.5px] text-muted-foreground"
            }
          >
            {message}
          </p>
        ) : null}
      </div>
    </form>
  );
}
