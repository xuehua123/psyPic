"use client";

import { useCallback, useRef } from "react";
import type Konva from "konva";

/**
 * Board Mode · Cut 3 commit 4 (plan slug board-mode-final).
 *
 * 注册 layerId → Konva Node ref 的 registry，让 Konva Transformer 能在
 * activeLayerId 变化时拿到要附着的目标 node，而不用在 Stage tree 里
 * 字符串查 findNode。
 *
 * 用 useRef<Map> 而非 useState：注册/解注册不触发 React 重渲染（只是
 * 一份 stable lookup），由 BoardStage 在 activeLayerId 变化的 effect
 * 里手动读取并更新 Transformer。
 */
export function useLayerNodeRegistry() {
  const registry = useRef(new Map<string, Konva.Node>());

  const register = useCallback((id: string, node: Konva.Node | null) => {
    if (node) {
      registry.current.set(id, node);
    } else {
      registry.current.delete(id);
    }
  }, []);

  const get = useCallback((id: string | null): Konva.Node | null => {
    if (!id) return null;
    return registry.current.get(id) ?? null;
  }, []);

  return { register, get };
}
