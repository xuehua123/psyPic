import AppPageHeader from "@/components/layout/AppPageHeader";
import AppShell from "@/components/layout/AppShell";
import ApiSettingsForm from "@/components/settings/ApiSettingsForm";
import { Card, CardContent } from "@/components/ui/card";
import { isCurrentRequestAdmin } from "@/server/services/request-user-service";

export default async function SettingsPage() {
  const showAdminLink = await isCurrentRequestAdmin();

  return (
    <AppShell currentPath="/settings" showAdminLink={showAdminLink}>
      <main className="mx-auto flex w-full max-w-[920px] flex-col gap-6 px-5 py-6">
        <AppPageHeader
          eyebrow="账户与连接"
          title="本地开发设置"
          description="手动 API Key 只作为当前页面草稿输入，提交后由 BFF 建立后端 key binding。前端不写入 localStorage、sessionStorage 或 IndexedDB。"
        />

        <Card>
          <CardContent className="px-6 py-6">
            <ApiSettingsForm />
          </CardContent>
        </Card>
      </main>
    </AppShell>
  );
}
