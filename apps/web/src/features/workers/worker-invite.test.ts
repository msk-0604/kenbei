import { describe, expect, it } from "vitest";
import { lineShareUrl, workerInviteMessage, workerLoginUrl } from "./worker-invite";

describe("worker invite", () => {
  const loginUrl = workerLoginUrl("https://app.kenbei.jp/", "123456");

  it("builds the company login URL", () => {
    expect(loginUrl).toBe("https://app.kenbei.jp/login?company=123456");
  });

  it("only includes the passcode when the admin typed it", () => {
    const without = workerInviteMessage({ companyName: "山本建設", loginUrl, loginCode: "123456" });
    expect(without).toContain("合言葉は会社に聞いてください");
    expect(without).toContain(loginUrl);
    const withPass = workerInviteMessage({ companyName: "山本建設", loginUrl, loginCode: "123456", passcode: " やまもと " });
    expect(withPass).toContain("合言葉「やまもと」");
  });

  it("encodes the LINE share link", () => {
    expect(lineShareUrl("a b&c")).toBe("https://line.me/R/share?text=a%20b%26c");
  });
});
