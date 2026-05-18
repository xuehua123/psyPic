export type BoardBaseLayer = {
  id: string;
  name: string;
  kind: "image" | "stroke" | "text" | "mask";
  visible: boolean;
  locked: boolean;
  opacity: number;
  zIndex: number;
  transform: {
    x: number;
    y: number;
    scaleX: number;
    scaleY: number;
    rotation: number;
  };
};

export type BoardImageLayer = BoardBaseLayer & {
  kind: "image";
  assetId: string;
  src: string;
  width: number;
  height: number;
  crop?: { x: number; y: number; width: number; height: number };
};

export type BoardStrokeLayer = BoardBaseLayer & {
  kind: "stroke";
  points: number[];
  brush: { color: string; size: number; mode: "draw" | "erase" };
};

export type BoardMaskLayer = BoardBaseLayer & {
  kind: "mask";
  points: number[];
  brush: { size: number; mode: "paint" | "erase" };
};

export type BoardTextLayer = BoardBaseLayer & {
  kind: "text";
  text: string;
  fontSize: number;
  fontFamily: string;
  fill: string;
};

export type BoardLayer =
  | BoardImageLayer
  | BoardStrokeLayer
  | BoardTextLayer
  | BoardMaskLayer;

export type BoardDocument = {
  id: string;
  version: number;
  projectId: string;
  sessionId: string;
  title: string;
  width: number;
  height: number;
  background: {
    type: "transparent" | "solid" | "checkerboard";
    color?: string;
  };
  layers: BoardLayer[];
  activeLayerId: string | null;
  sourceVersionNodeIds: string[];
  sourceAssetIds: string[];
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
};
