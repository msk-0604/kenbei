import { KENBEI_MAX_MEMBERS, KENBEI_MONTHLY_PRICE_JPY, billingPlanByCode } from "@kensapo/domain";
import { HOURLY_COST_YEN, MINUTES_SAVED_PER_REPORT } from "@/features/kanri/month-value";

export const LANDING_HEADLINE = "現場が終わったら、15分で日報まで。";

export const LANDING_LEAD =
  "写真を撮る、作業にチェック、日報を出す。作業員の出面も、月末に自動でまとまります。会社まるごと月額18,000円（税込）。";

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
    body: "日報の画面を開くと今日の写真が付いています。作業をタップで書き足して確定すれば、A4・PDFでそのまま提出できます。",
  },
] as const;

export const LANDING_PAINS = [
  { before: "写真がスマホ・LINE・PCにバラバラ", after: "現場ごとに1か所へ" },
  { before: "事務所に戻ってからExcelで日報", after: "現場でその場で書いて、そのままPDF" },
  { before: "残作業は口頭とメモ", after: "期限つきタスクでチーム共有" },
  { before: "月末に紙の出面表を集めて集計", after: "作業開始・終了から出面表が自動でできる" },
] as const;

/** 「月額18,000円で元は取れる？」の計算。管理画面の「今月の KENBEI」と同じ前提を使う */
export function landingPayback() {
  const workdays = 20;
  const minutes = workdays * MINUTES_SAVED_PER_REPORT;
  const hours = minutes / 60;
  const yen = hours * HOURLY_COST_YEN;
  return { workdays, minutesPerDay: MINUTES_SAVED_PER_REPORT, hours, hourlyYen: HOURLY_COST_YEN, yen, priceYen: KENBEI_MONTHLY_PRICE_JPY };
}

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
    q: "作業員の出面（でづら）の集計はできますか？",
    a: "できます。作業員がスマホで押した「作業開始・終了」から、月ごとに誰が・どの現場に・何日出たかをまとめ、Excel（CSV）や紙の出面表と同じ形の PDF で出せます。",
  },
  {
    q: "請求書払い（銀行振込）はできますか？",
    a: "できます。「ご契約」画面で「請求書で払う」を選ぶと、毎月の請求書がメールで届き、銀行振込かカードで支払えます（支払期限は発行から30日）。",
  },
  {
    q: "解約はどこから行いますか？",
    a: "権限のある管理者が、アプリ内の「ご契約」画面の「期末で解約する」から行えます。Stripeの契約確認画面からも手続きできます。",
  },
  {
    q: `${KENBEI_MAX_MEMBERS + 1}名以上で使いたい場合は？`,
    a: "お問い合わせフォームからご相談ください。",
  },
  {
    q: "スマートフォンでも使えますか？",
    a: "スマートフォンのWebブラウザから利用できます。アプリのインストールは不要です。",
  },
] as const;
