import CommunityWorkDetailPage from "@/components/community/CommunityWorkDetailPage";
import { getCommunityWorkForViewer } from "@/server/services/community-service";
import { isCurrentRequestAdmin } from "@/server/services/request-user-service";

export default async function Page({
  params
}: {
  params: Promise<{ workId: string }>;
}) {
  const { workId } = await params;
  const [work, showAdminLink] = await Promise.all([
    getCommunityWorkForViewer(workId, null),
    isCurrentRequestAdmin()
  ]);

  return <CommunityWorkDetailPage showAdminLink={showAdminLink} work={work} />;
}
