import LibraryAssetDetailPage from "@/components/library/LibraryAssetDetailPage";
import { getImageLibraryAssetForUser } from "@/server/services/image-task-service";
import { getCurrentRequestViewer } from "@/server/services/request-user-service";

export default async function Page({
  params
}: {
  params: Promise<{ assetId: string }>;
}) {
  const { assetId } = await params;
  const viewer = await getCurrentRequestViewer();
  const session = viewer.session;
  const item = session
    ? await getImageLibraryAssetForUser(session.user_id, assetId)
    : null;

  return (
    <LibraryAssetDetailPage
      item={item}
      errorMessage={session ? "素材不存在。" : "请先导入或配置 Sub2API Key。"}
      showAdminLink={viewer.isAdmin}
    />
  );
}
