import CommunityWorkDetailPage from "@/components/community/CommunityWorkDetailPage";
import { getCommunityWorkForViewer } from "@/server/services/community-service";

export default async function Page({
  params
}: {
  params: Promise<{ workId: string }>;
}) {
  const { workId } = await params;
  const work = getCommunityWorkForViewer(workId, null);

  return <CommunityWorkDetailPage work={work} />;
}
