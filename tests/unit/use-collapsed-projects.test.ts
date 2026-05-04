import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import { useCollapsedProjects } from "@/lib/creator/use-collapsed-projects";
import type { CreatorProjectId } from "@/lib/creator/types";

const STORAGE_KEY = "psypic_sidebar_collapsed_projects";

const PROJECT_IDS: CreatorProjectId[] = [
  "commercial",
  "social",
  "campaign",
  "same"
];

describe("useCollapsedProjects", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("defaults to: only the active project expanded, all others collapsed", () => {
    const { result } = renderHook(() =>
      useCollapsedProjects(PROJECT_IDS, "commercial")
    );

    expect(result.current.isCollapsed("commercial")).toBe(false);
    expect(result.current.isCollapsed("social")).toBe(true);
    expect(result.current.isCollapsed("campaign")).toBe(true);
    expect(result.current.isCollapsed("same")).toBe(true);
  });

  it("toggle expands a previously-collapsed project", () => {
    const { result } = renderHook(() =>
      useCollapsedProjects(PROJECT_IDS, "commercial")
    );

    act(() => {
      result.current.toggle("social");
    });

    expect(result.current.isCollapsed("social")).toBe(false);
  });

  it("toggle collapses a previously-expanded project", () => {
    const { result } = renderHook(() =>
      useCollapsedProjects(PROJECT_IDS, "commercial")
    );

    // commercial 默认展开
    expect(result.current.isCollapsed("commercial")).toBe(false);
    act(() => {
      result.current.toggle("commercial");
    });
    expect(result.current.isCollapsed("commercial")).toBe(true);
  });

  it("persists collapsed set to localStorage and restores on next mount", () => {
    const first = renderHook(() =>
      useCollapsedProjects(PROJECT_IDS, "commercial")
    );

    // 初始：social/campaign/same 折叠 → toggle social 展开
    act(() => {
      first.result.current.toggle("social");
    });

    // 第二次 mount：应该读到上一次的状态（social 展开，其他折叠维持）
    const second = renderHook(() =>
      useCollapsedProjects(PROJECT_IDS, "commercial")
    );
    expect(second.result.current.isCollapsed("social")).toBe(false);
    expect(second.result.current.isCollapsed("campaign")).toBe(true);
    expect(second.result.current.isCollapsed("same")).toBe(true);
    expect(second.result.current.isCollapsed("commercial")).toBe(false);
  });

  it("falls back to defaults when localStorage holds invalid JSON", () => {
    window.localStorage.setItem(STORAGE_KEY, "{not valid json");

    const { result } = renderHook(() =>
      useCollapsedProjects(PROJECT_IDS, "campaign")
    );

    // 走默认逻辑：除 active(campaign) 外全部折叠
    expect(result.current.isCollapsed("campaign")).toBe(false);
    expect(result.current.isCollapsed("commercial")).toBe(true);
    expect(result.current.isCollapsed("social")).toBe(true);
    expect(result.current.isCollapsed("same")).toBe(true);
  });

  it("falls back to defaults when localStorage holds a non-array value", () => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ foo: 1 }));

    const { result } = renderHook(() =>
      useCollapsedProjects(PROJECT_IDS, "social")
    );

    expect(result.current.isCollapsed("social")).toBe(false);
    expect(result.current.isCollapsed("commercial")).toBe(true);
  });

  it("does not auto-expand a freshly-switched active project (user toggle wins)", () => {
    // 用户场景：first mount → 折叠 social → active 切到 social，期望 social
    // 仍按用户先前的 toggle 状态来（不是因为成 active 就自动展开）。
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(["social", "campaign", "same"])
    );

    const { result } = renderHook(() =>
      useCollapsedProjects(PROJECT_IDS, "social")
    );

    // social 是新 active，但 localStorage 里它是折叠 —— 用户优先
    expect(result.current.isCollapsed("social")).toBe(true);
  });
});
