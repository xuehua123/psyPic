import { pathToFileURL } from "node:url";

const defaultRequests = 20;
const defaultConcurrency = 4;

export function buildLoadPlan(input) {
  const appUrl = normalizeAppUrl(input.appUrl);
  const readOnlyHeaders = { accept: "application/json" };
  const authenticatedHeaders = input.cookie
    ? { ...readOnlyHeaders, cookie: input.cookie }
    : readOnlyHeaders;
  const plan = [
    step("health", "GET", new URL("/api/health", appUrl), readOnlyHeaders),
    step(
      "community-latest",
      "GET",
      new URL("/api/community/works?sort=latest&limit=20", appUrl),
      readOnlyHeaders
    ),
    step(
      "community-popular",
      "GET",
      new URL("/api/community/works?sort=popular&limit=20", appUrl),
      readOnlyHeaders
    ),
    step(
      "community-featured",
      "GET",
      new URL("/api/community/works?sort=featured&limit=20", appUrl),
      readOnlyHeaders
    )
  ];

  if (input.cookie) {
    plan.push(
      step(
        "library",
        "GET",
        new URL("/api/library?limit=20", appUrl),
        authenticatedHeaders
      ),
      step("usage", "GET", new URL("/api/usage", appUrl), authenticatedHeaders)
    );
  }

  if (input.includeGeneration) {
    plan.push(
      step(
        "image-generation",
        "POST",
        new URL("/api/images/generations", appUrl),
        {
          ...authenticatedHeaders,
          "content-type": "application/json"
        },
        JSON.stringify({
          model: "gpt-image-2",
          size: "1024x1024",
          quality: "medium",
          n: 1,
          output_format: "png",
          output_compression: null,
          background: "auto",
          moderation: "auto",
          prompt: "PsyPic load smoke test"
        })
      )
    );
  }

  return plan;
}

export function summarizeSamples(samples) {
  const sortedMs = samples.map((sample) => sample.ms).sort((left, right) => left - right);
  const statusCounts = {};

  for (const sample of samples) {
    statusCounts[sample.status] = (statusCounts[sample.status] ?? 0) + 1;
  }

  return {
    total: samples.length,
    failed: samples.filter((sample) => !sample.ok).length,
    statusCounts,
    p50Ms: percentile(sortedMs, 50),
    p95Ms: percentile(sortedMs, 95),
    maxMs: sortedMs.at(-1) ?? 0
  };
}

export async function runLoadPlan(input) {
  const requests = clampInteger(input.requests, defaultRequests);
  const concurrency = Math.min(clampInteger(input.concurrency, defaultConcurrency), requests);
  const samples = [];
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < requests) {
      const requestIndex = nextIndex;
      nextIndex += 1;
      const planStep = input.plan[requestIndex % input.plan.length];
      samples.push(await runStep(planStep));
    }
  }

  await Promise.all(Array.from({ length: concurrency }, worker));
  return summarizeSamples(samples);
}

async function runStep(planStep) {
  const started = performance.now();

  try {
    const response = await fetch(planStep.url, {
      method: planStep.method,
      headers: planStep.headers,
      body: planStep.body
    });

    await response.arrayBuffer().catch(() => undefined);

    return {
      label: planStep.label,
      ok: response.ok,
      status: response.status,
      ms: Math.round(performance.now() - started)
    };
  } catch {
    return {
      label: planStep.label,
      ok: false,
      status: 0,
      ms: Math.round(performance.now() - started)
    };
  }
}

function step(label, method, url, headers, body) {
  return {
    label,
    method,
    url: url.toString(),
    headers,
    body
  };
}

function normalizeAppUrl(appUrl) {
  const normalized = appUrl.trim().replace(/\/+$/, "");
  return normalized ? `${normalized}/` : "http://127.0.0.1:3000/";
}

function clampInteger(value, fallback) {
  const parsed = Number(value);

  if (Number.isInteger(parsed) && parsed > 0) {
    return parsed;
  }

  return fallback;
}

function percentile(sortedValues, percentileValue) {
  if (sortedValues.length === 0) {
    return 0;
  }

  const index = Math.ceil((percentileValue / 100) * sortedValues.length) - 1;
  return sortedValues[Math.min(Math.max(index, 0), sortedValues.length - 1)];
}

async function runCli() {
  const includeGeneration = process.env.PSYPIC_LOAD_RUN_GENERATION === "true";
  const cookie = process.env.PSYPIC_LOAD_COOKIE ?? "";

  if (includeGeneration && !cookie) {
    throw new Error("PSYPIC_LOAD_COOKIE is required when generation load is enabled.");
  }

  const plan = buildLoadPlan({
    appUrl: process.env.APP_URL ?? "http://127.0.0.1:3000",
    cookie,
    includeGeneration
  });
  const summary = await runLoadPlan({
    plan,
    requests: process.env.PSYPIC_LOAD_REQUESTS,
    concurrency: process.env.PSYPIC_LOAD_CONCURRENCY
  });

  console.log(JSON.stringify(summary, null, 2));

  if (summary.failed > 0) {
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runCli().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
