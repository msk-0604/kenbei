import { billingPlanByCode } from "@kensapo/domain";

export const LANDING_HEADLINE = "現場写真・残作業・日報を、ひとつに。";

export const LANDING_LEAD =
  "建設会社の現場監督・施工管理者向け。現場ごとの写真、タスク、進捗をまとめて管理し、日報をPDFで出力できます。";

export const TRIAL_NO_CARD_LINE = "無料体験の開始に、クレジットカードは不要です。";

export const HOW_TO_STEPS = [
  {
    title: "写真管理",
    body: "現場を選んで写真を追加します。一覧から現場ごとに探せます。",
  },
  {
    title: "タスク・進捗",
    body: "現場の残作業をタスクとして追加し、完了した作業を画面で確認できます。",
  },
  {
    title: "日報PDF",
    body: "日報の内容を画面で確認し、日本語のPDFとして出力できます。",
  },
] as const;

export function landingPaidPlans() {
  const standard = billingPlanByCode("standard");
  const business = billingPlanByCode("business");
  return [
    {
      code: standard.code,
      name: standard.name,
      monthlyPriceJpy: standard.monthlyPriceJpy,
      maxMembers: standard.maxMembers,
    },
    {
      code: business.code,
      name: business.name,
      monthlyPriceJpy: business.monthlyPriceJpy,
      maxMembers: business.maxMembers,
    },
  ] as const;
}

export function memberLimitLabel(maxMembers: number | null): string {
  if (maxMembers == null) {
    return "人数上限なし";
  }
  return `${maxMembers}名まで`;
}

export function monthlyYenLabel(amount: number): string {
  return `月額 ${amount.toLocaleString("ja-JP")}円`;
}

export const LANDING_FAQS = [
  {
    q: "クレジットカードの登録は必要ですか？",
    a: "アカウント作成と14日間の無料体験の開始には、カード登録は不要です。カードはSTANDARDまたはBUSINESSのお支払い手続きのときに登録します。",
  },
  {
    q: "無料期間が終わると、自動で課金されますか？",
    a: "無料体験の開始だけで自動課金はしません。有料利用は、権限のある管理者がアプリ内の請求設定からSTANDARDまたはBUSINESSを契約したときです。",
  },
  {
    q: "無料体験が終わると、どうなりますか？",
    a: "体験終了後は、写真・日報・タスクなどの追加・更新ができなくなります。継続するにはSTANDARDまたはBUSINESSの契約が必要です。登録データは組織単位で当面保持しますが、保管期間は保証していません。必要なデータはエクスポートしてください。",
  },
  {
    q: "有料契約や解約は、どこから行いますか？",
    a: "権限のある管理者が、アプリ内の「プラン・お支払い」から契約します。解約は同画面の「期末で解約する」、またはStripeの契約確認画面から行います。",
  },
  {
    q: "スマートフォンでも使えますか？",
    a: "スマートフォンのWebブラウザから利用できます。",
  },
] as const;
