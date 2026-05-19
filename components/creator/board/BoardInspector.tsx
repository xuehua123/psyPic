"use client";

import type { ReactNode } from "react";

import { useBoard } from "@/lib/creator/board/board-context";
import type {
  BoardImageLayer,
  BoardStrokeLayer,
  BoardTextLayer
} from "@/lib/creator/board/types";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

/**
 * Board Mode · Cut 3 commit 7 (plan slug board-mode-final).
 *
 * 选中 layer 的属性面板。约束：
 * - 输入用 onBlur dispatch，不在 onChange 打 reducer（避免每次按键触发
 *   reducer pressure）；输入元素全部 uncontrolled + defaultValue。
 * - 用 key={active.id} 强制在切换 active layer 时整体重挂载，让所有
 *   uncontrolled 输入回到新 layer 的默认值。
 * - 不出现 erase / mask / draw mode 切换 —— 这些留到 Cut 5 mask 那刀。
 * - 不接生成 / 持久化 / 后端。
 */

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2 border-t border-border pt-3 first:border-t-0 first:pt-0">
      <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {title}
      </h3>
      {children}
    </section>
  );
}

function Field({
  htmlFor,
  label,
  children
}: {
  htmlFor: string;
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <Label htmlFor={htmlFor} className="text-xs text-muted-foreground">
        {label}
      </Label>
      {children}
    </div>
  );
}

export function BoardInspector() {
  const { state, dispatch } = useBoard();
  const active = state.document.layers.find(
    (l) => l.id === state.document.activeLayerId
  );

  if (!active) {
    return (
      <p data-testid="board-inspector-empty" className="text-muted-foreground">
        暂无选中
      </p>
    );
  }

  const transformFields = ["x", "y", "scaleX", "scaleY", "rotation"] as const;

  return (
    <div
      key={active.id}
      data-testid={`board-inspector-${active.id}`}
      className="flex flex-col gap-3"
    >
      <Section title="基础">
        <Field htmlFor="board-inspector-name" label="名称">
          <Input
            id="board-inspector-name"
            data-testid="board-inspector-name"
            defaultValue={active.name}
            onBlur={(e) => {
              const next = e.currentTarget.value;
              if (next !== active.name) {
                dispatch({
                  type: "updateLayer",
                  id: active.id,
                  patch: { name: next }
                });
              }
            }}
          />
        </Field>
        <Field htmlFor="board-inspector-opacity" label="不透明度">
          <Input
            id="board-inspector-opacity"
            data-testid="board-inspector-opacity"
            type="number"
            min={0}
            max={1}
            step={0.05}
            defaultValue={active.opacity}
            onBlur={(e) => {
              const raw = Number(e.currentTarget.value);
              if (!Number.isFinite(raw)) return;
              const clamped = Math.max(0, Math.min(1, raw));
              if (clamped !== active.opacity) {
                dispatch({
                  type: "updateLayer",
                  id: active.id,
                  patch: { opacity: clamped }
                });
              }
            }}
          />
        </Field>
      </Section>

      <Section title="变换">
        {transformFields.map((field) => (
          <Field
            key={field}
            htmlFor={`board-inspector-${field}`}
            label={field}
          >
            <Input
              id={`board-inspector-${field}`}
              data-testid={`board-inspector-${field}`}
              type="number"
              defaultValue={active.transform[field]}
              onBlur={(e) => {
                const next = Number(e.currentTarget.value);
                if (!Number.isFinite(next)) return;
                if (next === active.transform[field]) return;
                dispatch({
                  type: "transformLayer",
                  id: active.id,
                  transform: { ...active.transform, [field]: next }
                });
              }}
            />
          </Field>
        ))}
      </Section>

      {active.kind === "image" ? <ImageInspectorSection layer={active} /> : null}
      {active.kind === "stroke" ? <StrokeInspectorSection layer={active} /> : null}
      {active.kind === "text" ? <TextInspectorSection layer={active} /> : null}
    </div>
  );
}

function ImageInspectorSection({ layer }: { layer: BoardImageLayer }) {
  const { dispatch } = useBoard();
  return (
    <Section title="图片">
      <Field htmlFor="board-inspector-image-width" label="宽">
        <Input
          id="board-inspector-image-width"
          data-testid="board-inspector-image-width"
          type="number"
          min={1}
          defaultValue={layer.width}
          onBlur={(e) => {
            const raw = Number(e.currentTarget.value);
            if (!Number.isFinite(raw)) return;
            const next = Math.max(1, Math.round(raw));
            if (next !== layer.width) {
              dispatch({
                type: "updateImageLayer",
                id: layer.id,
                patch: { width: next }
              });
            }
          }}
        />
      </Field>
      <Field htmlFor="board-inspector-image-height" label="高">
        <Input
          id="board-inspector-image-height"
          data-testid="board-inspector-image-height"
          type="number"
          min={1}
          defaultValue={layer.height}
          onBlur={(e) => {
            const raw = Number(e.currentTarget.value);
            if (!Number.isFinite(raw)) return;
            const next = Math.max(1, Math.round(raw));
            if (next !== layer.height) {
              dispatch({
                type: "updateImageLayer",
                id: layer.id,
                patch: { height: next }
              });
            }
          }}
        />
      </Field>
    </Section>
  );
}

function StrokeInspectorSection({ layer }: { layer: BoardStrokeLayer }) {
  const { dispatch } = useBoard();
  // 注意：Cut 3 不暴露 brush.mode（draw/erase）切换。Eraser / mask 留到
  // 后续 mask 工作。
  return (
    <Section title="笔画">
      <Field htmlFor="board-inspector-stroke-color" label="颜色">
        <Input
          id="board-inspector-stroke-color"
          data-testid="board-inspector-stroke-color"
          type="color"
          defaultValue={layer.brush.color}
          onBlur={(e) => {
            const next = e.currentTarget.value;
            if (next !== layer.brush.color) {
              dispatch({
                type: "updateStrokeLayer",
                id: layer.id,
                patch: { brush: { ...layer.brush, color: next } }
              });
            }
          }}
        />
      </Field>
      <Field htmlFor="board-inspector-stroke-size" label="粗细">
        <Input
          id="board-inspector-stroke-size"
          data-testid="board-inspector-stroke-size"
          type="number"
          min={1}
          max={100}
          defaultValue={layer.brush.size}
          onBlur={(e) => {
            const raw = Number(e.currentTarget.value);
            if (!Number.isFinite(raw)) return;
            const next = Math.max(1, Math.min(100, Math.round(raw)));
            if (next !== layer.brush.size) {
              dispatch({
                type: "updateStrokeLayer",
                id: layer.id,
                patch: { brush: { ...layer.brush, size: next } }
              });
            }
          }}
        />
      </Field>
    </Section>
  );
}

function TextInspectorSection({ layer }: { layer: BoardTextLayer }) {
  const { dispatch } = useBoard();
  return (
    <Section title="文字">
      <Field htmlFor="board-inspector-text-content" label="内容">
        <Textarea
          id="board-inspector-text-content"
          data-testid="board-inspector-text-content"
          defaultValue={layer.text}
          rows={3}
          onBlur={(e) => {
            const next = e.currentTarget.value;
            if (next !== layer.text) {
              dispatch({
                type: "updateTextLayer",
                id: layer.id,
                patch: { text: next }
              });
            }
          }}
        />
      </Field>
      <Field htmlFor="board-inspector-text-font-size" label="字号">
        <Input
          id="board-inspector-text-font-size"
          data-testid="board-inspector-text-font-size"
          type="number"
          min={1}
          defaultValue={layer.fontSize}
          onBlur={(e) => {
            const raw = Number(e.currentTarget.value);
            if (!Number.isFinite(raw)) return;
            const next = Math.max(1, Math.round(raw));
            if (next !== layer.fontSize) {
              dispatch({
                type: "updateTextLayer",
                id: layer.id,
                patch: { fontSize: next }
              });
            }
          }}
        />
      </Field>
      <Field htmlFor="board-inspector-text-font-family" label="字体">
        <Input
          id="board-inspector-text-font-family"
          data-testid="board-inspector-text-font-family"
          defaultValue={layer.fontFamily}
          onBlur={(e) => {
            const next = e.currentTarget.value;
            if (next !== layer.fontFamily && next.length > 0) {
              dispatch({
                type: "updateTextLayer",
                id: layer.id,
                patch: { fontFamily: next }
              });
            }
          }}
        />
      </Field>
      <Field htmlFor="board-inspector-text-fill" label="颜色">
        <Input
          id="board-inspector-text-fill"
          data-testid="board-inspector-text-fill"
          type="color"
          defaultValue={layer.fill}
          onBlur={(e) => {
            const next = e.currentTarget.value;
            if (next !== layer.fill) {
              dispatch({
                type: "updateTextLayer",
                id: layer.id,
                patch: { fill: next }
              });
            }
          }}
        />
      </Field>
    </Section>
  );
}
