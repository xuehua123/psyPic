"use client";

import { useEffect, useState } from "react";

/**
 * Board Mode · Cut 3 commit 3 (plan slug board-mode-final).
 *
 * 自写 image loader hook — 不引入 react-konva-utils。
 *
 * 返回 [image, status]：
 * - status="loading"：HTMLImageElement 已创建但未 load
 * - status="loaded"：image.complete 后切到这一态，触发 Konva 重绘
 * - status="error"：onerror
 *
 * 实现注意：用 React 官方推荐的「prevSrc useState 配对」模式 reset
 * 状态（参考 react.dev/reference/react/useState#storing-information-
 * from-previous-renders）。effect 只挂 listener，setState 全部在
 * listener 回调里，不在同步体内 setState、不写 ref —— 兼容
 * react-hooks/set-state-in-effect + react-hooks/refs 两条 lint 规则。
 *
 * jsdom 没有真实图片解码，所以测试态下 image 不会切到 loaded，但测试
 * 只断言 Konva Image 节点是否被 mock 渲染，不依赖真实解码完成。
 */

export type ImageSourceStatus = "loading" | "loaded" | "error";

export function useImageSource(
  src: string | undefined
): [HTMLImageElement | undefined, ImageSourceStatus] {
  const [image, setImage] = useState<HTMLImageElement | undefined>(undefined);
  const [status, setStatus] = useState<ImageSourceStatus>("loading");
  const [prevSrc, setPrevSrc] = useState<string | undefined>(src);

  if (prevSrc !== src) {
    setPrevSrc(src);
    setImage(undefined);
    setStatus("loading");
  }

  useEffect(() => {
    if (!src) return;
    if (typeof window === "undefined" || typeof window.Image === "undefined") {
      return;
    }
    const img = new window.Image();
    img.crossOrigin = "anonymous";
    let cancelled = false;
    const onLoad = () => {
      if (cancelled) return;
      setImage(img);
      setStatus("loaded");
    };
    const onError = () => {
      if (cancelled) return;
      setStatus("error");
    };
    img.addEventListener("load", onLoad);
    img.addEventListener("error", onError);
    img.src = src;
    return () => {
      cancelled = true;
      img.removeEventListener("load", onLoad);
      img.removeEventListener("error", onError);
    };
  }, [src]);

  return [image, status];
}
