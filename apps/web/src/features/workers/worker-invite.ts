/**
 * 作業員への案内（LINE で送る文面・印刷する案内）。
 * 管理者が一人ずつ説明しなくても、これを送れば作業員が自分で始められるようにする。
 */

export function workerLoginUrl(appUrl: string, loginCode: string): string {
  return `${appUrl.replace(/\/$/, "")}/login?company=${encodeURIComponent(loginCode)}`;
}

/** 毎日の使い方（印刷する案内と同じ順番） */
export const WORKER_DAILY_STEPS = [
  "「スケジュール」で今日の予定と現場を見る",
  "現場に着いたら「作業開始」、終わったら「作業終了」を押す",
  "現場の写真は、現場を開いて「写真」から撮る",
  "作業工程は、終わったところを〇（途中は△）にする",
] as const;

export function workerInviteMessage(input: {
  companyName: string;
  loginUrl: string;
  loginCode: string;
  /** 管理者が入れたときだけ文面に書く（画面にも保存しない） */
  passcode?: string;
}): string {
  const passcode = input.passcode?.trim();
  return [
    `【${input.companyName}】現場アプリ「KENBEI」の始め方`,
    "",
    "① 下のURLを開いてください",
    input.loginUrl,
    "",
    passcode ? `② 合言葉「${passcode}」を入れて「入る」を押す` : "② 合言葉を入れて「入る」を押す（合言葉は会社に聞いてください）",
    "③ 自分の名前を選ぶ",
    "④ ホーム画面に追加しておくと、次からすぐ開けます",
    "　iPhone：下の共有ボタン →「ホーム画面に追加」",
    "　Android：右上の︙ →「ホーム画面に追加」",
    "",
    "毎日の使い方",
    ...WORKER_DAILY_STEPS.map((step) => `・${step}`),
    "",
    `会社コード：${input.loginCode}（URLから開けないときに入れます）`,
  ].join("\n");
}

export function lineShareUrl(text: string): string {
  return `https://line.me/R/share?text=${encodeURIComponent(text)}`;
}
