import { describe, expect, it } from "vitest";
import { resendMailRequest } from "./mail-request";

describe("Resend mail request", () => {
  it("2. posts to Resend without exposing a service role key", () => {
    const request = resendMailRequest({
      apiKey: "re_test",
      from: "KENBEI <support@kenbei.jp>",
      to: "example@company.jp",
      subject: "Stark LabからKENBEIに招待されました",
      text: "join",
      html: "<p>join</p>",
    });
    expect(request.url).toBe("https://api.resend.com/emails");
    expect(request.headers.Authorization).toBe("Bearer re_test");
    expect(request.body.to).toEqual(["example@company.jp"]);
    expect(request.body.from).toContain("support@kenbei.jp");
    expect(JSON.stringify(request.body)).not.toContain("service_role");
  });
});
