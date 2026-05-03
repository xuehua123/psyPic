"use client";

import { UploadCloud } from "lucide-react";
import type { FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import type { LibraryAssetItem } from "@/lib/creator/types";

/**
 * 素材项的"发布到社区"内嵌表单：标题、可见性、5 个公开/允许复用
 * 选项 + 提交按钮。从素材库列表内每项的"发布"按钮触发。
 *
 * 来自原 CreatorWorkspace.tsx L2429-2511（4116 行单文件巨兽拆分计划
 * 的第八刀）。地图"第二波" #14。当前实现保留原视觉与 className，后续
 * Phase 5/6 会再统一视觉 token、把 input/select/checkbox 替换为 shadcn。
 *
 * 父级负责：触发条件渲染（publishAssetId === item.asset_id 时挂载
 * 本组件），传 onSubmit 处理函数；defaultTitle 由父级用 helper 预先
 * 计算，避免组件内部重复逻辑。
 */
type CommunityPublishPanelProps = {
  item: LibraryAssetItem;
  defaultTitle: string;
  isPublishing: boolean;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
};

export default function CommunityPublishPanel({
  item,
  defaultTitle,
  isPublishing,
  onSubmit
}: CommunityPublishPanelProps) {
  return (
    <form className="community-publish-panel" onSubmit={onSubmit}>
      <div className="field">
        <label htmlFor={`publish-title-${item.asset_id}`}>作品标题</label>
        <Input
          defaultValue={defaultTitle}
          id={`publish-title-${item.asset_id}`}
          name="title"
          type="text"
        />
      </div>
      <div className="field">
        <label htmlFor={`publish-visibility-${item.asset_id}`}>可见性</label>
        <Select defaultValue="private" name="visibility">
          <SelectTrigger id={`publish-visibility-${item.asset_id}`}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="private">私有</SelectItem>
            <SelectItem value="unlisted">链接可见</SelectItem>
            <SelectItem value="public">公开社区</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="community-publish-options">
        <label className="checkbox-row">
          <input name="disclose_prompt" type="checkbox" />
          公开 Prompt
        </label>
        <label className="checkbox-row">
          <input name="disclose_params" type="checkbox" />
          公开参数
        </label>
        <label className="checkbox-row">
          <input name="disclose_reference_images" type="checkbox" />
          公开参考图
        </label>
        <label className="checkbox-row">
          <input
            defaultChecked
            name="allow_same_generation"
            type="checkbox"
          />
          允许同款生成
        </label>
        <label className="checkbox-row">
          <input name="allow_reference_reuse" type="checkbox" />
          允许参考复用
        </label>
        <label className="checkbox-row">
          <input name="public_confirmed" type="checkbox" />
          确认公开发布
        </label>
      </div>
      <Button
        disabled={isPublishing}
        type="submit"
      >
        <UploadCloud size={16} aria-hidden="true" />
        {isPublishing ? "发布中" : "确认发布"}
      </Button>
    </form>
  );
}
