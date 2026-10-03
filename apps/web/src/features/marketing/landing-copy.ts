import { KENBEI_MAX_MEMBERS, KENBEI_MONTHLY_PRICE_JPY, billingPlanByCode } from "@kensapo/domain";

export const LANDING_HEADLINE = "現場が終わったら、15分で日報まで。";

export const LANDING_LEAD =
  "写真を撮る、作業にチェック、日報を出す。施工管理の事務を3つの操作にまとめました。会社まるごと月額9,800円（税込）。";

export const TRIAL_NO_CARD_LINE = "無料体験の開始に、クレジットカードは不要です。";

export const HOW_TO_STEPS = [
  {
    title: "撮る",
    body: "現場でスマホから写真を撮るだけ。現場ごとにまとまり、電波が弱くても後で送られます。",
  },
  {
    title: "チェック",
    body: "残作業をタスクにして、終わったらチェック。期限切れは「今日」の画面で赤く知らせます。",
  },
  {
    title: "出す",
    body: "今日の写真と作業から日報の下書きができます。確認して確定すれば、A4・PDFでそのまま提出できます。",
  },
] as const;

export const LANDING_PAINS = [
  { before: "写真がスマホ・LINE・PCにバラバラ", after: "現場ごとに1か所へ" },
  { before: "事務所に戻ってからExcelで日報", after: "現場で下書き、確認するだけ" },
  { before: "残作業は口頭とメモ", after: "期限つきタスクでチーム共有" },
] as const;

export function landingPlan() {
  const plan = billingPlanByCode("standard");
  return {
    code: plan.code,
    name: plan.name,
    monthlyPriceJpy: plan.monthlyPriceJpy,
    maxMembers: plan.maxMembers,
  } as const;
}

export function memberLimitLabel(maxMembers: number | null): string {
  if (maxMembers == null) {
    return "人数上限なし";
  }
  return `${maxMembers}名まで`;
}

export const TAX_INCLUDED_LABEL = "税込";

export function monthlyYenLabel(amount: number): string {
  return `月額 ${amount.toLocaleString("ja-JP")}円`;
}

export function monthlyYenWithTaxLabel(amount: number): string {
  return `${monthlyYenLabel(amount)}（${TAX_INCLUDED_LABEL}）`;
}

const PRICE = KENBEI_MONTHLY_PRICE_JPY.toLocaleString("ja-JP");

export const LANDING_FAQS = [
  {
    q: "料金プランはいくつありますか？",
    a: `ひとつだけです。月額${PRICE}円（税込）で、会社ごとにメンバー${KENBEI_MAX_MEMBERS}名まで、すべての機能を使えます。`,
  },
  {
    q: "クレジットカードの登録は必要ですか？",
    a: "アカウント作成と14日間の無料体験の開始には、カード登録は不要です。カードは有料契約のお支払い手続きのときに登録します。",
  },
  {
    q: "無料期間が終わると、自動で課金されますか？",
    a: "無料体験の開始だけで自動課金はしません。有料利用は、権限のある管理者がアプリ内の「ご契約」画面から契約したときです。",
  },
  {
    q: "無料体験が終わると、どうなりますか？",
    a: `体験終了後は、写真・日報・タスクなどの追加・更新ができなくなります。月額${PRICE}円（税込）で契約すると、そのまま続きから使えます。登録データは組織単位で当面保持しますが、保管期間は保証していません。必要なデータはエクスポートしてください。`,
  },
  {
    q: "解約はどこから行いますか？",
    a: "権限のある管理者が、アプリ内の「ご契約」画面の「期末で解約する」から行えます。Stripeの契約確認画面からも手続きできます。",
  },
  {
    q: "51名以上で使いたい場合は？",
    a: "お問い合わせフォームからご相談ください。",
  },
  {
    q: "スマートフォンでも使えますか？",
    a: "スマートフォンのWebブラウザから利用できます。アプリのインストールは不要です。",
  },
] as const;
