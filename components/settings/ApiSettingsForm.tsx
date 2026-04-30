"use client";

import { KeyRound, Save } from "lucide-react";
import { FormEvent, useState } from "react";

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

  function updateDraft<Key extends keyof DraftSettings>(
    key: Key,
    value: DraftSettings[Key]
  ) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");

    const response = await fetch("/api/settings/manual-key", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        base_url: draft.baseUrl,
        api_key: draft.apiKey,
        default_model: draft.defaultModel
      })
    });

    if (response.ok) {
      setDraft((current) => ({ ...current, apiKey: "" }));
      setMessage("已通过 BFF 建立 key binding。");
      return;
    }

    setMessage("保存失败，请检查 Base URL 和 API Key。");
  }

  return (
    <form className="settings-form" onSubmit={handleSubmit}>
      <div className="field">
        <label htmlFor="sub2api-base-url">Sub2API Base URL</label>
        <input
          className="input"
          id="sub2api-base-url"
          inputMode="url"
          onChange={(event) => updateDraft("baseUrl", event.target.value)}
          placeholder="https://sub2api.example.com/v1"
          type="url"
          value={draft.baseUrl}
        />
      </div>

      <div className="field">
        <label htmlFor="manual-api-key">API Key</label>
        <input
          autoComplete="off"
          className="input"
          id="manual-api-key"
          onChange={(event) => updateDraft("apiKey", event.target.value)}
          placeholder="只在当前页面内存中暂存"
          type="password"
          value={draft.apiKey}
        />
        <span className="inline-hint">
          <KeyRound size={13} aria-hidden="true" /> 明文 key 不写入浏览器长期存储。
        </span>
      </div>

      <div className="field">
        <label htmlFor="default-model">默认模型</label>
        <select
          className="select"
          id="default-model"
          onChange={(event) => updateDraft("defaultModel", event.target.value)}
          value={draft.defaultModel}
        >
          <option value="gpt-image-2">gpt-image-2</option>
        </select>
      </div>

      <button className="primary-button" type="submit">
        <Save size={16} aria-hidden="true" />
        保存到 BFF
      </button>
      {message ? <p className="settings-note">{message}</p> : null}
    </form>
  );
}
