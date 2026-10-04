import { inviteJoinPath, inviteRoleLabel } from "./invite";

export function inviteEmailSubject(companyName: string): string {
  return `${plain(companyName)}からKENBEIに招待されました`;
}

export function inviteEmailText(input: {
  companyName: string;
  roleCode: string;
  joinUrl: string;
}): string {
  const company = plain(input.companyName);
  const role = inviteRoleLabel(input.roleCode);
  return [
    "KENBEI",
    "",
    `${company}から`,
    "KENBEIに招待されました。",
    "",
    "権限：",
    role,
    "",
    "下のURLから参加してください。",
    input.joinUrl,
    "",
    "この招待には有効期限があります。",
    "",
    "support@kenbei.jp",
  ].join("\n");
}

export function inviteEmailHtml(input: {
  companyName: string;
  roleCode: string;
  joinUrl: string;
}): string {
  const company = escapeHtml(plain(input.companyName));
  const role = escapeHtml(inviteRoleLabel(input.roleCode));
  const url = escapeHtml(input.joinUrl);
  return `<!doctype html>
<html lang="ja">
<body style="margin:0;padding:24px;background:#f4f6fa;color:#0b1220;font-family:sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:24px;padding:32px;">
    <tr><td>
      <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 24px;">
        <tr>
          <td style="vertical-align:middle;"><img src="https://app.kenbei.jp/icon-192.png" width="40" height="40" alt="KENBEI" style="display:block;border:0;border-radius:10px;"></td>
          <td style="vertical-align:middle;padding-left:10px;font-size:20px;font-weight:700;letter-spacing:0.04em;">KENBEI</td>
        </tr>
      </table>
      <p style="margin:0 0 8px;font-size:18px;font-weight:600;">${company}から</p>
      <p style="margin:0 0 20px;font-size:18px;font-weight:600;">KENBEIに招待されました。</p>
      <p style="margin:0 0 4px;color:#71717a;font-size:14px;">権限：</p>
      <p style="margin:0 0 24px;font-size:16px;">${role}</p>
      <p style="margin:0 0 24px;font-size:16px;">下のボタンから参加してください。</p>
      <p style="margin:0 0 24px;">
        <a href="${url}" style="display:inline-block;background:#0a66ff;color:#ffffff;text-decoration:none;border-radius:14px;padding:12px 20px;font-weight:600;">${company}に参加する</a>
      </p>
      <p style="margin:0 0 24px;color:#71717a;font-size:14px;">この招待には有効期限があります。</p>
      <p style="margin:0;color:#71717a;font-size:13px;">support@kenbei.jp</p>
    </td></tr>
  </table>
</body>
</html>`;
}

export function inviteJoinUrl(appUrl: string, token: string, grant?: string | null): string {
  return `${appUrl.replace(/\/$/, "")}${inviteJoinPath(token, grant)}`;
}

function plain(value: string): string {
  return value.replace(/\s+/g, " ").trim() || "会社";
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
