import { describe, expect, it } from "vitest";
import { buildStructuredLog } from "./observability";

describe("structured log redaction", () => {
  it("includes request, organization, and user ids", () => {
    expect(
      buildStructuredLog("error", "upload failed", {
        requestId: "req-1",
        organizationId: "org-a",
        userId: "user-a",
      }),
    ).toMatchObject({
      level: "error",
      msg: "upload failed",
      request_id: "req-1",
      organization_id: "org-a",
      user_id: "user-a",
    });
  });

  it("redacts tokens and secrets", () => {
    const line = buildStructuredLog("error", "stripe", { requestId: "req-1" }, {
      authorization: "Bearer secret",
      token: "sk-live-xxx",
      password: "p",
    });
    expect(line.authorization).toBe("[redacted]");
    expect(line.token).toBe("[redacted]");
    expect(line.password).toBe("[redacted]");
  });
});
