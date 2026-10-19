import type { TrialEmailKind } from "./trial-email-schedule";

export function trialEmailCopy(
  kind: TrialEmailKind,
  appUrl: string,
): { subject: string; text: string; html: string } {
  const base = appUrl.replace(/\/$/, "");
  const billing = `${base}/settings/billing`;
  const kanri = `${base}/kanri`;
  const passcode = `${base}/settings#passcode`;
  const help = `${base}/help`;
  if (kind === "trial_started") {
    const subject = "KENBEIの14日間無料体験が始まりました（最初の30分でやること）";
    const text = [
      "会社の登録ありがとうございます。KENBEIの14日間無料体験が始まりました。カードの登録は要りません。",
      "",
      "管理画面の「はじめにやること」を上から進めるだけで、30分ほどで現場で使い始められます。",
      `${kanri}`,
      "",
      "① 作業員を登録する（名前を入れるだけです）",
      "② 作業員のログイン方法を決める（一人ずつメールで招待するか、みんなで同じ合言葉）",
      "③ 現場を1件登録する",
      "④ 明日の予定を入れる",
      "⑤ 作業員に案内を送る（設定の「作業員に案内する」から LINE で送るか、QR付きの案内を印刷して渡すだけ）",
      `　${passcode}`,
      "",
      "まず触ってみたいときは、「はじめにやること」の「まず見本の現場で試してみる」を押してください。",
      `困ったときは：${help}`,
      "",
      `続ける場合の料金は、月額18,000円（税込・会社ごと・20名まで）の1プランだけです。カードか請求書払い（銀行振込）で ${billing} から契約できます。無料体験の開始だけでは自動課金しません。`,
      "",
      `KENBEI ${base}/`,
    ].join("\n");
    return { subject, text, html: textToHtml(text) };
  }
  if (kind === "trial_day3") {
    const subject = "作業員のスマホに、予定は届いていますか？";
    const text = [
      "無料体験の開始から3日です。",
      "",
      "KENBEIがいちばん役に立つのは、作業員が自分のスマホで「今日どの現場に行くか」を見て、作業開始・終了を押すようになったときです。",
      `まだのときは、管理画面の「はじめにやること」の残りを進めてください。 ${kanri}`,
      "",
      "よくある止まりどころ",
      `・作業員への説明が面倒 → 「作業員に案内する」から LINE で送るか、QR付きの案内を印刷して渡すだけです ${passcode}`,
      `・使い方がわからない → ${help}`,
      "",
      `体験後に続ける場合は、月額18,000円（税込）を ${billing} から契約します（カード・請求書払い）。`,
      "",
      `KENBEI ${base}/`,
    ].join("\n");
    return { subject, text, html: textToHtml(text) };
  }
  const subject = "無料体験の終了が近づいています（残り2日）";
  const text = [
    "14日間の無料体験は、あと2日ほどで終了します。",
    "",
    "終了後は、予定・現場・写真などの追加や更新ができなくなります。登録データは組織単位で当面残りますが、保管期間は保証していません。",
    `継続する場合は、権限のある管理者が ${billing} から月額18,000円（税込）で契約してください。カードのほか、請求書払い（銀行振込）も選べます。解約は期末で予約できます。無料体験のままでは自動課金しません。`,
    "",
    `KENBEI ${base}/`,
  ].join("\n");
  return { subject, text, html: textToHtml(text) };
}

function textToHtml(text: string): string {
  const escaped = text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
  const withLinks = escaped.replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1">$1</a>');
  return `<div style="max-width:520px;margin:0 auto;padding:24px;font-family:sans-serif;color:#0b1220;line-height:1.8;">
<p style="margin:0 0 20px;"><img src="https://app.kenbei.jp/icon-192.png" width="40" height="40" alt="KENBEI" style="border:0;border-radius:10px;vertical-align:middle;"> <strong style="font-size:18px;vertical-align:middle;">KENBEI</strong></p>
<p>${withLinks.replaceAll("\n", "<br />")}</p>
</div>`;
}
