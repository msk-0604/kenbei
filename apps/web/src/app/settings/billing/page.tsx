import { canOpenBillingPortal } from "@kensapo/domain";
import { AppShell } from "@/components/app-shell";
import { cancelSubscriptionAction, openBillingPortalAction } from "@/features/billing/actions";
import { PlanBillingPanel } from "@/features/billing/plan-billing-panel";
import { redactStripeSecrets } from "@/features/billing/stripe-error";
import { can, requireWorkspace } from "@/lib/authz-guard";
import { getEntitlement } from "@/lib/entitlement";

export const dynamic = "force-dynamic";

function firstQueryValue(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value)?.trim() ?? "";
}

export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string | string[]; ok?: string | string[]; canceled?: string | string[] }>;
}) {
  const workspace = await requireWorkspace();
  const params = await searchParams;
  const error = redactStripeSecrets(firstQueryValue(params.error)).slice(0, 300);
  const ok = firstQueryValue(params.ok);
  const canceled = firstQueryValue(params.canceled);
  if (!can(workspace, "org.manage")) {
    return (
      <AppShell>
        <h1 className="text-3xl font-semibold">会社の導入</h1>
        <p className="mt-3">管理者による契約手続きをお待ちください</p>
      </AppShell>
    );
  }
  const entitlement = await getEntitlement(workspace.organizationId);
  return (
    <AppShell>
      <p className="text-sm text-zinc-500">
        <a href="/settings">設定</a>
      </p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight">会社の導入</h1>
      <p className="mt-2 text-sm leading-6 text-zinc-600">プランの確認とお支払いは、この画面から進めます。</p>
      {error ? (
        <p className="mt-4 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-800 ring-1 ring-red-200" role="alert">
          {error}
        </p>
      ) : null}
      {ok ? (
        <p className="mt-4 rounded-2xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800 ring-1 ring-emerald-200">
          お支払い手続きが完了しました。反映まで少し待つ場合があります。
        </p>
      ) : null}
      {canceled ? (
        <p className="mt-4 rounded-2xl bg-zinc-50 px-4 py-3 text-sm text-zinc-700 ring-1 ring-zinc-200">
          Checkout をキャンセルしました。
        </p>
      ) : null}
      <div className="mt-6">
        <PlanBillingPanel
          planCode={entitlement.planCode}
          status={entitlement.status}
          cancelAtPeriodEnd={entitlement.cancelAtPeriodEnd}
          access={entitlement.access}
          variant="billing"
        />
      </div>
      {canOpenBillingPortal(true, entitlement.stripeCustomerId) ? (
        <form action={openBillingPortalAction} className="mt-4">
          <button type="submit" className="rounded-2xl bg-white px-4 py-2 ring-1 ring-zinc-200">
            カスタマーポータル（ダウングレード含む）
          </button>
        </form>
      ) : (
        <p className="mt-4 text-sm text-zinc-500">カード登録はSTANDARDまたはBUSINESSのCheckout時に行います。</p>
      )}
      <section className="mt-8 rounded-3xl bg-amber-50 p-5 ring-1 ring-amber-200">
        <h2 className="font-medium">解約の前に</h2>
        <p className="mt-2 text-sm">データをエクスポートしますか？ 解約後も当面はエクスポートできますが、先に取ることを推奨します。</p>
        <a href="/settings/data" className="mt-3 inline-flex underline">
          データをエクスポート
        </a>
        <form action={cancelSubscriptionAction} className="mt-4">
          <button type="submit" className="rounded-2xl bg-white px-4 py-2 text-red-800 ring-1 ring-red-200">
            期末で解約する
          </button>
        </form>
      </section>
    </AppShell>
  );
}
