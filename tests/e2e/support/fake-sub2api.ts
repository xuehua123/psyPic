import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { setTimeout as delay } from "node:timers/promises";
import { createSolidPngBase64 } from "./png";

const imageBase64 = createSolidPngBase64();
const requestMarkers = new Map<string, number>();

export type FakeSub2APIServer = {
  baseUrl: string;
  close: () => Promise<void>;
};

export async function startFakeSub2API(): Promise<FakeSub2APIServer> {
  const server = createServer(async (request, response) => {
    try {
      if (request.method === "GET" && request.url?.startsWith("/__e2e/requests")) {
        const url = new URL(request.url, "http://127.0.0.1");
        const marker = url.searchParams.get("marker") ?? "";

        writeJson(response, 200, { count: requestMarkers.get(marker) ?? 0 });
        return;
      }

      if (request.method !== "POST") {
        writeJson(response, 404, { error: { message: "not found" } });
        return;
      }

      if (request.url?.endsWith("/v1/images/generations")) {
        const body = await readBody(request);
        const marker = readDelayedGenerationMarker(body);

        if (marker) {
          requestMarkers.set(marker, (requestMarkers.get(marker) ?? 0) + 1);
          await delay(700);
        }

        if (request.headers.accept?.includes("text/event-stream") || body.includes('"stream":true')) {
          writeImageStream(response);
          return;
        }

        writeImageJson(response);
        return;
      }

      if (request.url?.endsWith("/v1/images/edits")) {
        await readBody(request);
        writeImageJson(response);
        return;
      }

      writeJson(response, 404, { error: { message: "not found" } });
    } catch (error) {
      writeJson(response, 500, {
        error: {
          message: error instanceof Error ? error.message : "fake upstream failed"
        }
      });
    }
  });

  await new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", resolve);
  });

  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Fake Sub2API server did not expose a TCP port.");
  }

  return {
    baseUrl: `http://127.0.0.1:${address.port}/v1`,
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      })
  };
}

function readDelayedGenerationMarker(body: string) {
  try {
    const parsed = JSON.parse(body) as { prompt?: unknown };

    if (
      typeof parsed.prompt === "string" &&
      parsed.prompt.startsWith("E2E 延迟并发 ")
    ) {
      return parsed.prompt;
    }
  } catch {
    return null;
  }

  return null;
}

function writeImageJson(response: ServerResponse) {
  writeJson(response, 200, {
    data: [{ b64_json: imageBase64 }],
    usage: {
      input_tokens: 12,
      output_tokens: 18,
      total_tokens: 30,
      estimated_cost: "0.0000"
    }
  });
}

function writeImageStream(response: ServerResponse) {
  response.writeHead(200, {
    "content-type": "text/event-stream; charset=utf-8",
    "cache-control": "no-store",
    "x-request-id": "upstream_e2e_stream"
  });
  response.write(
    sse("image_generation.partial_image", {
      type: "image_generation.partial_image",
      partial_image_index: 0,
      b64_json: imageBase64
    })
  );
  response.end(
    sse("image_generation.completed", {
      type: "image_generation.completed",
      data: [{ b64_json: imageBase64 }],
      usage: {
        input_tokens: 10,
        output_tokens: 20,
        total_tokens: 30,
        estimated_cost: "0.0000"
      }
    })
  );
}

function writeJson(response: ServerResponse, status: number, body: unknown) {
  response.writeHead(status, {
    "content-type": "application/json",
    "x-request-id": "upstream_e2e_json"
  });
  response.end(JSON.stringify(body));
}

function sse(event: string, data: unknown) {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

async function readBody(request: IncomingMessage) {
  const chunks: Buffer[] = [];

  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  return Buffer.concat(chunks).toString("utf8");
}
