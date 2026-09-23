import { describe, expect, it } from "vitest";
import { inviteEmailHtml, inviteEmailSubject, inviteEmailText, inviteJoinUrl } from "./invite-email";

describe("invite email copy", () => {
  it("2-3. builds a Japanese invite with the existing join URL", () => {
    const url = inviteJoinUrl("https://app.kenbei.jp", "abc123abc123abc123abc123abc123ab");
    expect(url).toBe("https://app.kenbei.jp/join?token=abc123abc123abc123abc123abc123ab");
    expect(inviteJoinUrl("https://app.kenbei.jp", "abc123abc123abc123abc123abc123ab", "ab".repeat(32))).toBe(
      `https://app.kenbei.jp/join?token=abc123abc123abc123abc123abc123ab&grant=${"ab".repeat(32)}`,
    );
    expect(inviteEmailSubject("Stark Lab")).toBe("Stark LabからKENBEIに招待されました");
    const text = inviteEmailText({
      companyName: "Stark Lab",
      roleCode: "worker",
      joinUrl: url,
    });
    expect(text).toContain("KENBEI");
    expect(text).toContain("Stark Labから");
    expect(text).toContain("一般メンバー");
    expect(text).toContain(url);
    expect(text).toContain("support@kenbei.jp");
    const html = inviteEmailHtml({
      companyName: "Stark Lab",
      roleCode: "worker",
      joinUrl: url,
    });
    expect(html).toContain("Stark Labに参加する");
    expect(html).toContain(url);
    expect(html).not.toContain("<script>");
  });

  it("escapes company names in HTML", () => {
    const html = inviteEmailHtml({
      companyName: `<img src=x>`,
      roleCode: "manager",
      joinUrl: "https://app.kenbei.jp/join?token=abc",
    });
    expect(html).toContain("&lt;img src=x&gt;");
    expect(html).not.toContain("<img src=x>");
  });
});
