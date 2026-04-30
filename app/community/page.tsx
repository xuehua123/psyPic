import CommunityFeedPage from "@/components/community/CommunityFeedPage";
import { listPublicCommunityWorks } from "@/server/services/community-service";

export default function Page() {
  const works = listPublicCommunityWorks({ limit: 30 });

  return <CommunityFeedPage works={works.items} />;
}
