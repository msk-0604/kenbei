import type { BillingAccessKind } from "@kensapo/domain";

export type ContractBadge = { label: string; detail: string; tone: "ok" | "trial" | "warn" };

function shortDate(iso: string): string {
  return new Intl.DateTimeFormat("ja-JP", { timeZone: "Asia/Tokyo", month: "long", day: "numeric" }).format(new Date(iso));
}

/** 管理画面の上に出す「ご契約」の一行。契約したあとも、どこを見ればいいか迷わないようにする。 */
export function contractBadge(input: {
  access: BillingAccessKind;
  trialDaysLeft: number | null;
  trialEndsAt: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  invoicePending: boolean;
}): ContractBadge {
  if (input.invoicePending) {
    return {
      label: "請求書の入金待ち",
      detail: input.access === "trial_active" ? "お試し期間はそのまま使えます" : "お振り込みを確認すると使えるようになります",
      tone: "warn",
    };
  }
  if (input.access === "paid_active") {
    if (input.cancelAtPeriodEnd && input.currentPeriodEnd) {
      return { label: "解約予約中", detail: `${shortDate(input.currentPeriodEnd)}まで使えます`, tone: "warn" };
    }
    return {
      label: "ご契約中",
      detail: input.currentPeriodEnd ? `次回の更新は${shortDate(input.currentPeriodEnd)}` : "月額18,000円（税込）",
      tone: "ok",
    };
  }
  if (input.access === "trial_active") {
    return {
      label: `無料体験中・残り${input.trialDaysLeft ?? "—"}日`,
      detail: input.trialEndsAt ? `${shortDate(input.trialEndsAt)}まで無料` : "契約はここから",
      tone: "trial",
    };
  }
  if (input.access === "grandfathered_free") {
    return { label: "ご利用中", detail: "契約の内容を見る", tone: "ok" };
  }
  return { label: "お試しが終わりました", detail: "続けるにはご契約ください", tone: "warn" };
}
