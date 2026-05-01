import { createRequestId, jsonError, jsonOk } from "@/server/services/api-response";
import { getSession } from "@/server/services/dev-store";
import {
  createCommunityWorkForUser,
  listPublicCommunityWorks,
  type CommunityWorkVisibility
} from "@/server/services/community-service";
import { getRuntimeFeatureFlags } from "@/server/services/runtime-settings-service";
import { readSessionIdFromRequest } from "@/server/services/session-service";

type ParsedCreateWork =
  | {
      success: true;
      data: {
        taskId: string;
        assetId: string;
        visibility: CommunityWorkVisibility;
        title: string;
        scene: string | null;
        tags: string[];
        disclosePrompt: boolean;
        discloseParams: boolean;
        discloseReferenceImages: boolean;
        allowSameGeneration: boolean;
        allowReferenceReuse: boolean;
      };
    }
  | { success: false; message: string; field: string };

const communityWorkVisibilities = new Set(["private", "unlisted", "public"]);

export async function GET(request: Request) {
  const requestId = createRequestId();
  const url = new URL(request.url);
  const limit = Number.parseInt(url.searchParams.get("limit") ?? "", 10);
  const sessionId = readSessionIdFromRequest(request);
  const session = sessionId ? getSession(sessionId) : null;
  const works = listPublicCommunityWorks({
    cursor: url.searchParams.get("cursor"),
    limit,
    scene: url.searchParams.get("scene"),
    tag: url.searchParams.get("tag"),
    sort: url.searchParams.get("sort"),
    viewerUserId: session?.user_id ?? null
  });

  return jsonOk(
    {
      items: works.items,
      next_cursor: works.nextCursor
    },
    requestId
  );
}

export async function POST(request: Request) {
  const requestId = createRequestId();
  const sessionId = readSessionIdFromRequest(request);
  const session = sessionId ? getSession(sessionId) : null;

  if (!session) {
    return jsonError({
      status: 401,
      code: "unauthorized",
      message: "请先导入或配置 Sub2API Key",
      requestId
    });
  }

  const parsed = parseCreateWorkBody(await request.json().catch(() => null));

  if (!parsed.success) {
    return jsonError({
      status: 400,
      code: "invalid_parameter",
      message: parsed.message,
      field: parsed.field,
      requestId
    });
  }

  const features = getRuntimeFeatureFlags();

  if (!features.community) {
    return jsonError({
      status: 403,
      code: "community_disabled",
      message: "社区发布当前已关闭",
      requestId
    });
  }

  if (parsed.data.visibility === "public" && !features.public_publish) {
    return jsonError({
      status: 403,
      code: "public_publish_disabled",
      message: "公开发布当前已关闭",
      requestId
    });
  }

  const work = createCommunityWorkForUser(session.user_id, parsed.data);

  if (!work) {
    return jsonError({
      status: 404,
      code: "not_found",
      message: "任务或素材不存在",
      requestId
    });
  }

  return jsonOk(work, requestId);
}

function parseCreateWorkBody(value: unknown): ParsedCreateWork {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {
      success: false,
      message: "请求体必须是对象",
      field: "body"
    };
  }

  const input = value as Record<string, unknown>;
  const visibility = parseVisibility(input.visibility);

  if (visibility === "invalid") {
    return {
      success: false,
      message: "visibility 必须是 private、unlisted 或 public",
      field: "visibility"
    };
  }

  if (visibility === "public" && input.public_confirmed !== true) {
    return {
      success: false,
      message: "公开发布需要二次确认",
      field: "public_confirmed"
    };
  }

  const taskId = parseRequiredString(input.task_id, "task_id");
  if (!taskId.success) {
    return taskId;
  }

  const assetId = parseRequiredString(input.asset_id, "asset_id");
  if (!assetId.success) {
    return assetId;
  }

  const title = parseRequiredString(input.title, "title");
  if (!title.success) {
    return title;
  }

  const tags = parseTags(input.tags);
  if (!tags.success) {
    return tags;
  }

  return {
    success: true,
    data: {
      taskId: taskId.data,
      assetId: assetId.data,
      visibility,
      title: title.data.slice(0, 80),
      scene:
        typeof input.scene === "string" && input.scene.trim()
          ? input.scene.trim().slice(0, 40)
          : null,
      tags: tags.data,
      disclosePrompt: input.disclose_prompt === true,
      discloseParams: input.disclose_params === true,
      discloseReferenceImages: input.disclose_reference_images === true,
      allowSameGeneration: input.allow_same_generation === true,
      allowReferenceReuse: input.allow_reference_reuse === true
    }
  };
}

function parseVisibility(value: unknown): CommunityWorkVisibility | "invalid" {
  if (value === undefined || value === null || value === "") {
    return "private";
  }

  if (typeof value !== "string" || !communityWorkVisibilities.has(value)) {
    return "invalid";
  }

  return value as CommunityWorkVisibility;
}

function parseRequiredString(value: unknown, field: string) {
  if (typeof value !== "string" || !value.trim()) {
    return {
      success: false as const,
      message: `${field} 不能为空`,
      field
    };
  }

  return {
    success: true as const,
    data: value.trim()
  };
}

function parseTags(value: unknown) {
  if (value === undefined) {
    return { success: true as const, data: [] };
  }

  if (!Array.isArray(value) || value.some((tag) => typeof tag !== "string")) {
    return {
      success: false as const,
      message: "tags 必须是字符串数组",
      field: "tags"
    };
  }

  return {
    success: true as const,
    data: value
  };
}
