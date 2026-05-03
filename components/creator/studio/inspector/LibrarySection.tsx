"use client";

/**
 * LibrarySection —— Inspector 第四个 section "素材与历史"，包含：
 * - 同步素材库按钮 + library-toolbar (favorite-only checkbox + 标签过滤)
 * - libraryStatus loading / unavailable 状态提示
 * - promptFavorites 列表 (套用 Prompt 按钮)
 * - libraryItems 列表 (继续编辑 / 收藏切换 / 发布作品 / 详情链接 +
 *   嵌套 CommunityPublishPanel + publishMessage)
 * - historyItems 兜底列表（无 library 时显示）
 *
 * 抽取自 components/creator/CreatorWorkspace.tsx 原 L1639-1828 的
 * inspector-section "素材与历史"（UI 重构 Phase 4 第 18 刀）。
 *
 * 数据来源: 全部走 useCreatorStudio() —— 第 18 刀扩 19 字段。
 */

import Link from "next/link";
import {
  Copy,
  ExternalLink,
  History,
  ImagePlus,
  RefreshCw,
  Star,
  Tags,
  UploadCloud
} from "lucide-react";

import CommunityPublishPanel from "@/components/creator/studio/CommunityPublishPanel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import SectionHeading from "@/components/creator/studio/SectionHeading";
import { useCreatorStudio } from "@/components/creator/studio/CreatorStudioContext";

export default function LibrarySection() {
  const {
    libraryItems,
    libraryStatus,
    libraryFavoriteOnly,
    setLibraryFavoriteOnly,
    libraryTagFilter,
    setLibraryTagFilter,
    promptFavorites,
    historyItems,
    publishAssetId,
    setPublishAssetId,
    publishingAssetId,
    publishMessages,
    loadServerLibrary,
    applyPromptFavorite,
    handleLibraryContinueEdit,
    toggleLibraryFavorite,
    publishLibraryItem,
    handleHistoryContinueEdit,
    defaultCommunityTitle
  } = useCreatorStudio();

  return (
    <section className="inspector-section">
      <SectionHeading
        icon={History}
        title="素材与历史"
        action={
          <button
            aria-label="同步素材库"
            className="icon-button"
            disabled={libraryStatus === "loading"}
            onClick={() => void loadServerLibrary()}
            title="同步素材库"
            type="button"
          >
            <RefreshCw size={16} aria-hidden="true" />
          </button>
        }
      />
      <div className="library-toolbar">
        <label className="checkbox-row">
          <input
            aria-label="仅收藏素材"
            checked={libraryFavoriteOnly}
            onChange={(event) =>
              setLibraryFavoriteOnly(event.currentTarget.checked)
            }
            type="checkbox"
          />
          仅收藏
        </label>
        <div className="library-tag-filter">
          <Tags size={14} aria-hidden="true" />
          <Input
            aria-label="素材标签过滤"
            onChange={(event) => setLibraryTagFilter(event.target.value)}
            placeholder="标签"
            value={libraryTagFilter}
          />
        </div>
      </div>

      {libraryStatus === "loading" ? (
        <div className="history-item">
          <strong>同步中</strong>
          <p>正在读取服务端素材库。</p>
        </div>
      ) : null}

      {libraryStatus === "unavailable" ? (
        <div className="history-item">
          <strong>素材库暂不可用</strong>
          <p>继续使用本地历史，不影响生成和继续编辑。</p>
        </div>
      ) : null}

      {promptFavorites.length > 0 ? (
        <div className="library-section">
          {promptFavorites.map((item) => (
            <div className="history-item" key={item.id}>
              <strong>{item.title}</strong>
              <p>{item.prompt}</p>
              <p>{item.mode === "image" ? "图生图" : "文生图"}</p>
              <div className="history-actions">
                <Button
                  variant="secondary"
                  onClick={() => applyPromptFavorite(item)}
                  type="button"
                >
                  <Copy size={16} aria-hidden="true" />
                  套用 Prompt
                </Button>
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {libraryItems.length > 0 ? (
        <div className="library-section">
          {libraryItems.map((item) => (
            <div className="history-item library-item" key={item.asset_id}>
              <img
                alt=""
                className="library-thumb"
                src={item.thumbnail_url}
              />
              <div className="library-item-body">
                <strong>{item.asset_id}</strong>
                <p>{item.prompt}</p>
                <p>
                  {item.task_id}
                  {item.usage?.total_tokens
                    ? ` · ${item.usage.total_tokens} tokens`
                    : ""}
                  {item.duration_ms ? ` · ${item.duration_ms}ms` : ""}
                </p>
                {item.tags.length > 0 ? (
                  <div className="tag-list">
                    {item.tags.map((tag) => (
                      <span key={tag}>{tag}</span>
                    ))}
                  </div>
                ) : null}
                <div className="history-actions">
                  <Button
                    variant="secondary"
                    onClick={() => void handleLibraryContinueEdit(item)}
                    type="button"
                  >
                    <ImagePlus size={16} aria-hidden="true" />
                    继续编辑
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => void toggleLibraryFavorite(item)}
                    type="button"
                  >
                    <Star
                      fill={item.favorite ? "currentColor" : "none"}
                      size={16}
                      aria-hidden="true"
                    />
                    {item.favorite ? "取消收藏" : "收藏素材"}
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() =>
                      setPublishAssetId((current) =>
                        current === item.asset_id ? null : item.asset_id
                      )
                    }
                    type="button"
                  >
                    <UploadCloud size={16} aria-hidden="true" />
                    发布作品
                  </Button>
                  <Button asChild variant="secondary">
                    <Link href={`/library/${item.asset_id}`}>
                      <ExternalLink size={16} aria-hidden="true" />
                      详情
                    </Link>
                  </Button>
                </div>
                {publishAssetId === item.asset_id ? (
                  <CommunityPublishPanel
                    defaultTitle={defaultCommunityTitle(item)}
                    isPublishing={publishingAssetId === item.asset_id}
                    item={item}
                    onSubmit={(event) => void publishLibraryItem(event, item)}
                  />
                ) : null}
                {publishMessages[item.asset_id] ? (
                  <p className="inline-hint">
                    {publishMessages[item.asset_id]}
                  </p>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {historyItems.length === 0 &&
      libraryItems.length === 0 &&
      promptFavorites.length === 0 ? (
        <div className="history-item">
          <strong>尚未生成</strong>
          <p>生成后会显示 prompt、参数、request id、耗时和 usage。</p>
        </div>
      ) : (
        historyItems.map((item) => (
          <div className="history-item" key={item.taskId}>
            <strong>{item.taskId}</strong>
            <p>{item.prompt}</p>
            <p>{item.requestId}</p>
            <p>{item.totalTokens} tokens · {item.durationMs}ms</p>
            <div className="history-actions">
              <Button
                variant="secondary"
                onClick={() => void handleHistoryContinueEdit(item)}
                type="button"
              >
                <ImagePlus size={16} aria-hidden="true" />
                继续编辑
              </Button>
            </div>
          </div>
        ))
      )}
    </section>
  );
}
