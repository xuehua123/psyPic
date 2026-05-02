import CreatorWorkspace from "@/components/creator/CreatorWorkspace";
import { isCurrentRequestAdmin } from "@/server/services/request-user-service";

export default async function CreatorPage() {
  return <CreatorWorkspace showAdminLink={await isCurrentRequestAdmin()} />;
}
