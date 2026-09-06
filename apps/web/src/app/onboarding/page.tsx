import { redirect } from "next/navigation";
import { AuthShell } from "@/components/auth-shell";
import { CreateOrganizationForm } from "@/features/org/create-org-form";
import { getWorkspace, hasOrganization } from "@/lib/session";

export default async function OnboardingPage() {
  const workspace = await getWorkspace();
  if (!workspace) {
    redirect("/login");
  }
  if (hasOrganization(workspace)) {
    redirect("/");
  }

  return (
    <AuthShell
      title="会社を作成"
      description="支店や部署の設定は不要です。あとから追加できます。"
    >
      <CreateOrganizationForm />
    </AuthShell>
  );
}
