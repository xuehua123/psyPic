import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import ApiSettingsForm from "@/components/settings/ApiSettingsForm";

export default function SettingsPage() {
  return (
    <main className="settings-wrap">
      <div className="settings-grid">
        <Link className="ghost-button" href="/">
          <ArrowLeft size={16} aria-hidden="true" />
          返回创作台
        </Link>
        <section className="settings-panel">
          <h1 className="settings-title">本地开发设置</h1>
          <p className="settings-note">
            手动 API Key 只作为当前页面草稿输入，提交后由 BFF 建立后端 key
            binding。前端不写入 localStorage、sessionStorage 或 IndexedDB。
          </p>
          <ApiSettingsForm />
        </section>
      </div>
    </main>
  );
}
