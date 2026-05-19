"use client";

import {
  createContext,
  useContext,
  useMemo,
  useReducer,
  type Dispatch,
  type ReactNode
} from "react";

import type {
  BoardBaseLayer,
  BoardDocument,
  BoardImageLayer,
  BoardLayer,
  BoardStrokeLayer,
  BoardTextLayer
} from "./types";

/**
 * Board Mode · Cut 3 commit 1 (plan slug board-mode-final).
 *
 * BoardProvider 持有当前 BoardDocument 的 in-memory 状态 + 当前 active tool。
 * 用 React useReducer，不引入 Zustand / Jotai。BoardDocument 持久化到
 * IndexedDB 是 Cut 5 的事，本 Cut 只在 React state 里。
 */

export type BoardTool = "select" | "image" | "stroke" | "text";

export type BoardState = {
  document: BoardDocument;
  activeTool: BoardTool;
};

export type BoardAction =
  | { type: "addLayer"; layer: BoardLayer }
  | { type: "removeLayer"; id: string }
  | { type: "selectLayer"; id: string | null }
  | { type: "toggleVisible"; id: string }
  | { type: "toggleLock"; id: string }
  | { type: "reorderLayer"; id: string; toIndex: number }
  | { type: "setActiveTool"; tool: BoardTool }
  | {
      type: "transformLayer";
      id: string;
      transform: BoardBaseLayer["transform"];
      width?: number;
      height?: number;
    }
  | {
      type: "updateLayer";
      id: string;
      patch: Partial<
        Pick<BoardBaseLayer, "name" | "opacity" | "visible" | "locked" | "zIndex">
      >;
    }
  | {
      type: "updateImageLayer";
      id: string;
      patch: Partial<Pick<BoardImageLayer, "src" | "width" | "height" | "crop">>;
    }
  | {
      type: "updateStrokeLayer";
      id: string;
      patch: Partial<Pick<BoardStrokeLayer, "points" | "brush">>;
    }
  | {
      type: "updateTextLayer";
      id: string;
      patch: Partial<Pick<BoardTextLayer, "text" | "fontSize" | "fontFamily" | "fill">>;
    };

const DEFAULT_DOCUMENT: BoardDocument = {
  id: "",
  version: 1,
  projectId: "",
  sessionId: "",
  title: "Board",
  width: 1024,
  height: 1024,
  background: { type: "transparent" },
  layers: [],
  activeLayerId: null,
  sourceVersionNodeIds: [],
  sourceAssetIds: [],
  createdAt: "",
  updatedAt: "",
  deletedAt: null
};

export function createInitialBoardState(
  initial?: Partial<BoardDocument>
): BoardState {
  const now = new Date().toISOString();
  return {
    document: {
      ...DEFAULT_DOCUMENT,
      createdAt: now,
      updatedAt: now,
      ...initial
    },
    activeTool: "select"
  };
}

function touch(doc: BoardDocument): BoardDocument {
  return { ...doc, updatedAt: new Date().toISOString() };
}

function mapLayer(
  state: BoardState,
  id: string,
  fn: (layer: BoardLayer) => BoardLayer
): BoardState {
  const layers = state.document.layers.map((l) => (l.id === id ? fn(l) : l));
  return { ...state, document: touch({ ...state.document, layers }) };
}

export function boardReducer(state: BoardState, action: BoardAction): BoardState {
  switch (action.type) {
    case "addLayer": {
      const layers = [...state.document.layers, action.layer];
      return {
        ...state,
        document: touch({
          ...state.document,
          layers,
          activeLayerId: action.layer.id
        })
      };
    }
    case "removeLayer": {
      const layers = state.document.layers.filter((l) => l.id !== action.id);
      const activeLayerId =
        state.document.activeLayerId === action.id
          ? null
          : state.document.activeLayerId;
      return {
        ...state,
        document: touch({ ...state.document, layers, activeLayerId })
      };
    }
    case "selectLayer": {
      return {
        ...state,
        document: touch({ ...state.document, activeLayerId: action.id })
      };
    }
    case "toggleVisible": {
      return mapLayer(state, action.id, (l) => ({ ...l, visible: !l.visible }));
    }
    case "toggleLock": {
      return mapLayer(state, action.id, (l) => ({ ...l, locked: !l.locked }));
    }
    case "reorderLayer": {
      const idx = state.document.layers.findIndex((l) => l.id === action.id);
      if (idx < 0) return state;
      const layers = [...state.document.layers];
      const [moved] = layers.splice(idx, 1);
      const target = Math.max(0, Math.min(layers.length, action.toIndex));
      layers.splice(target, 0, moved);
      return { ...state, document: touch({ ...state.document, layers }) };
    }
    case "setActiveTool": {
      return { ...state, activeTool: action.tool };
    }
    case "transformLayer": {
      return mapLayer(state, action.id, (l) => {
        const next = { ...l, transform: action.transform } as BoardLayer;
        if (next.kind === "image") {
          if (action.width !== undefined) next.width = action.width;
          if (action.height !== undefined) next.height = action.height;
        }
        return next;
      });
    }
    case "updateLayer": {
      return mapLayer(
        state,
        action.id,
        (l) => ({ ...l, ...action.patch }) as BoardLayer
      );
    }
    case "updateImageLayer": {
      return mapLayer(state, action.id, (l) =>
        l.kind === "image" ? { ...l, ...action.patch } : l
      );
    }
    case "updateStrokeLayer": {
      return mapLayer(state, action.id, (l) =>
        l.kind === "stroke" ? { ...l, ...action.patch } : l
      );
    }
    case "updateTextLayer": {
      return mapLayer(state, action.id, (l) =>
        l.kind === "text" ? { ...l, ...action.patch } : l
      );
    }
    default: {
      const _exhaustive: never = action;
      void _exhaustive;
      return state;
    }
  }
}

type BoardContextValue = {
  state: BoardState;
  dispatch: Dispatch<BoardAction>;
};

const BoardContext = createContext<BoardContextValue | null>(null);

export function BoardProvider({
  children,
  initialDocument
}: {
  children: ReactNode;
  initialDocument?: Partial<BoardDocument>;
}) {
  const [state, dispatch] = useReducer(
    boardReducer,
    initialDocument,
    createInitialBoardState
  );
  const value = useMemo(() => ({ state, dispatch }), [state]);
  return <BoardContext.Provider value={value}>{children}</BoardContext.Provider>;
}

export function useBoard(): BoardContextValue {
  const ctx = useContext(BoardContext);
  if (!ctx) {
    throw new Error("useBoard must be used inside <BoardProvider>");
  }
  return ctx;
}
