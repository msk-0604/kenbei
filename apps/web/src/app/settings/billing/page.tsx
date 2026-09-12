import { AppShell } from "@/components/app-shell";
import {
  cancelSubscriptionAction,
  openBillingPortalAction,
  startCheckoutFormAction,
} from "@/features/billing/actions";
import { CheckoutSubmitButton } from "@/features/billing/checkout-submit-button";
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
        <h1 className="text-3xl font-semibold">Billing</h1>
        <p className="mt-3">管理者のみが契約を変更できます。</p>
      </AppShell>
    );
  }
  const entitlement = await getEntitlement(workspace.organizationId);
  return (
    <AppShell>
      <p className="text-sm text-zinc-500">
        <a href="/settings">会社設定</a>
      </p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight">お支払い</h1>
      <p className="mt-2 text-zinc-600">
        現在 {entitlement.planName}（最大{entitlement.maxMembers ?? "要相談"}名） / {entitlement.status}
        {entitlement.cancelAtPeriodEnd ? "（期末で解約予約）" : ""}
      </p>
      <p className="mt-2 text-sm text-zinc-500">
        FREE 1〜3名 0円 / STANDARD 4〜30名 月額39,800円 / BUSINESS 31〜50名 月額65,000円 / 51名以上は要相談
      </p>
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
      <div className="mt-6 grid gap-3 md:grid-cols-2">
        {[
          { code: "standard", label: "STANDARD にアップグレード（4〜30名 / 月額39,800円）" },
          { code: "business", label: "BUSINESS にアップグレード（31〜50名 / 月額65,000円）" },
        ].map((plan) => (
          <form key={plan.code} action={startCheckoutFormAction}>
            <input type="hidden" name="planCode" value={plan.code} />
            <CheckoutSubmitButton label={plan.label} />
          </form>
        ))}
      </div>
      <p className="mt-3 text-sm text-zinc-500">51名以上は自動決済できません。営業へご相談ください。</p>
      <form action={openBillingPortalAction} className="mt-4">
        <button type="submit" className="rounded-2xl bg-white px-4 py-2 ring-1 ring-zinc-200">
          カスタマーポータル（ダウングレード含む）
        </button>
      </form>
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
