import { describe, expect, it } from "vitest";
import { buildPushPayload, eventUrl, isPushEventType } from "./events";

describe("push event copy", () => {
  it("knows the kenbei-alpha events", () => {
    expect(isPushEventType("work_started")).toBe(true);
    expect(isPushEventType("unknown")).toBe(false);
  });

  it("writes who did what on which site", () => {
    const payload = buildPushPayload({
      event: "site_status_changed",
      actorName: "山田",
      siteName: "蹴上 空き家",
      siteId: "s1",
      statusLabel: "完了",
    });
    expect(payload.body).toBe("山田さんが「蹴上 空き家」を「完了」にしました。");
    expect(payload.url).toBe("/sites/s1");
  });

  it("links schedule events to the schedule screen", () => {
    expect(eventUrl({ event: "work_ended", actorName: "a", siteId: "s1" })).toBe("/today");
    expect(eventUrl({ event: "progress_ok", actorName: "a", siteId: "s1" })).toBe("/sites/s1/progress");
  });
});
