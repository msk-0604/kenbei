import type { TrialEmailKind } from "./trial-email-schedule";

export function trialEmailCopy(
  kind: TrialEmailKind,
  appUrl: string,
): { subject: string; text: string; html: string } {
  const billing = `${appUrl.replace(/\/$/, "")}/settings/billing`;
  const today = `${appUrl.replace(/\/$/, "")}/`;
  if (kind === "trial_started") {
    const subject = "KENBEIの14日間無料体験が始まりました";
    const text = [
      "会社の登録ありがとうございます。KENBEIの14日間無料体験が始まりました。",
      "",
      "カード登録は不要です。この期間に、現場ごとの写真、残作業のタスク、進捗の確認、日本語の日報PDF、AI軍師まで一通り試せます。",
      "まずは今日の画面から現場を1つ作り、写真を追加してください。日報は画面で確認したあと、日本語PDFとして出せます。",
      "",
      `続ける場合の料金は、月額9,800円（税込・会社ごと・20名まで）の1プランだけです。契約は ${billing} から行います。無料体験の開始だけでは自動課金しません。`,
      "",
      `KENBEI ${today}`,
    ].join("\n");
    return { subject, text, html: textToHtml(text) };
  }
  if (kind === "trial_day3") {
    const subject = "現場写真と残作業を、同じ流れで進められます";
    const text = [
      "無料体験の開始から3日です。",
      "",
      "KENBEIでは、現場を選んで写真を残し、残作業をタスクにして進捗を確認し、日報を日本語PDFで出せます。AI軍師は、現場判断の補助として使えます。",
      "まだ現場がなければ、今日の画面から現場を追加してください。メンバーがいる場合は、設定から招待できます。",
      "",
      `体験後に続ける場合は、月額9,800円（税込）を ${billing} から契約します。`,
      "",
      `KENBEI ${today}`,
    ].join("\n");
    return { subject, text, html: textToHtml(text) };
  }
  const subject = "無料体験の終了が近づいています（残り2日）";
  const text = [
    "14日間の無料体験は、あと2日ほどで終了します。",
    "",
    "終了後は、写真・日報・タスクなどの追加や更新ができなくなります。登録データは組織単位で当面残りますが、保管期間は保証していません。",
    `継続する場合は、権限のある管理者が ${billing} から月額9,800円（税込）で契約してください。解約は期末で予約できます。無料体験のままでは自動課金しません。`,
    "",
    `KENBEI ${today}`,
  ].join("\n");
  return { subject, text, html: textToHtml(text) };
}

function textToHtml(text: string): string {
  const escaped = text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
  const withLinks = escaped.replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1">$1</a>');
  return `<p>${withLinks.replaceAll("\n", "<br />")}</p>`;
}
