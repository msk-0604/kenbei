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
      description="最初に会社名だけ登録します。現場名は次の画面で登録できます。"
    >
      <CreateOrganizationForm />
    </AuthShell>
  );
}
