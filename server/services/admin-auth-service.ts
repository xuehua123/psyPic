import { getRequestViewer } from "@/server/services/request-user-service";

export async function resolveAdminUser(request: Request) {
  const { session, user } = await getRequestViewer(request);

  if (!session || !user) {
    return { status: "unauthorized" as const };
  }

  if (user.role !== "admin") {
    return { status: "forbidden" as const };
  }

  return {
    status: "ok" as const,
    session,
    user
  };
}
