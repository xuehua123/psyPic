import { describe, expect, it } from "vitest";
import {
  buildLoadPlan,
  summarizeSamples
} from "../../scripts/load-smoke.mjs";

describe("load smoke script", () => {
  it("keeps the default plan read-only and unauthenticated-safe", () => {
    const plan = buildLoadPlan({
      appUrl: "https://psypic.example.com",
      cookie: "",
      includeGeneration: false
    });

    expect(plan.map((step) => step.method)).toEqual(["GET", "GET", "GET", "GET"]);
    expect(plan.map((step) => step.url)).toEqual([
      "https://psypic.example.com/api/health",
      "https://psypic.example.com/api/community/works?sort=latest&limit=20",
      "https://psypic.example.com/api/community/works?sort=popular&limit=20",
      "https://psypic.example.com/api/community/works?sort=featured&limit=20"
    ]);
  });

  it("adds authenticated library and generation probes only when explicitly enabled", () => {
    const plan = buildLoadPlan({
      appUrl: "https://psypic.example.com/",
      cookie: "psypic_session=test",
      includeGeneration: true
    });

    expect(plan.map((step) => `${step.method} ${new URL(step.url).pathname}`)).toEqual([
      "GET /api/health",
      "GET /api/community/works",
      "GET /api/community/works",
      "GET /api/community/works",
      "GET /api/library",
      "GET /api/usage",
      "POST /api/images/generations"
    ]);
    expect(plan.at(-1)?.headers).toMatchObject({
      cookie: "psypic_session=test",
      "content-type": "application/json"
    });
  });

  it("summarizes status counts and percentile latency", () => {
    const summary = summarizeSamples([
      { ok: true, status: 200, ms: 20 },
      { ok: true, status: 200, ms: 10 },
      { ok: false, status: 429, ms: 100 }
    ]);

    expect(summary).toMatchObject({
      total: 3,
      failed: 1,
      statusCounts: { 200: 2, 429: 1 },
      p50Ms: 20,
      p95Ms: 100
    });
  });
});
