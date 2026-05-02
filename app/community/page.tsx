import CommunityFeedPage from "@/components/community/CommunityFeedPage";
import { listPublicCommunityWorks } from "@/server/services/community-service";
import { isCurrentRequestAdmin } from "@/server/services/request-user-service";

export default async function Page({
  searchParams
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = (await searchParams) ?? {};
  const sort = parseSort(firstParam(params.sort));
  const scene = firstParam(params.scene);
  const tag = firstParam(params.tag);
  const [allWorks, works, showAdminLink] = await Promise.all([
    listPublicCommunityWorks({ limit: 50 }),
    listPublicCommunityWorks({
      limit: 30,
      scene,
      tag,
      sort
    }),
    isCurrentRequestAdmin()
  ]);
  const scenes = Array.from(
    new Set(allWorks.items.map((work) => work.scene).filter(Boolean))
  ) as string[];
  const tags = Array.from(new Set(allWorks.items.flatMap((work) => work.tags)));

  return (
    <CommunityFeedPage
      filters={{
        sort,
        scene,
        tag,
        scenes,
        tags
      }}
      showAdminLink={showAdminLink}
      works={works.items}
    />
  );
}

function firstParam(value: string | string[] | undefined) {
  const raw = Array.isArray(value) ? value[0] : value;

  return raw?.trim() || null;
}

function parseSort(value: string | null): "latest" | "popular" | "featured" {
  if (value === "popular" || value === "featured") {
    return value;
  }

  return "latest";
}
