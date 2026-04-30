import LibraryAssetDetailPage from "@/components/library/LibraryAssetDetailPage";
import { getSession } from "@/server/services/dev-store";
import { getImageLibraryAssetForUser } from "@/server/services/image-task-service";
import { SESSION_COOKIE_NAME } from "@/server/services/session-service";
import { cookies } from "next/headers";

export default async function Page({
  params
}: {
  params: Promise<{ assetId: string }>;
}) {
  const { assetId } = await params;
  const cookieStore = await cookies();
  const sessionId = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const session = sessionId ? getSession(sessionId) : null;
  const item = session ? getImageLibraryAssetForUser(session.user_id, assetId) : null;

  return (
    <LibraryAssetDetailPage
      item={item}
      errorMessage={session ? "素材不存在。" : "请先导入或配置 Sub2API Key。"}
    />
  );
}
