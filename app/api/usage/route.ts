import { createRequestId, jsonError, jsonOk } from "@/server/services/api-response";
import { summarizeImageUsageForUser } from "@/server/services/image-task-service";
import { requireRequestUser } from "@/server/services/request-user-service";

export async function GET(request: Request) {
  const requestId = createRequestId();
  const viewer = await requireRequestUser(request);

  if (!viewer) {
    return jsonError({
      status: 401,
      code: "unauthorized",
      message: "请先导入或配置 Sub2API Key",
      requestId
    });
  }

  return jsonOk(await summarizeImageUsageForUser(viewer.user.id), requestId);
}
