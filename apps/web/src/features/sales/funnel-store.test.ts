import { describe, expect, it } from "vitest";
import { insertFunnelEvent } from "./funnel-store";

describe("funnel store", () => {
  it("records a visit and treats unique violations as duplicates", async () => {
    const writes: Record<string, unknown>[] = [];
    const admin = {
      from() {
        return {
          insert: async (row: Record<string, unknown>) => {
            if (writes.some((item) => item.visitor_id === row.visitor_id && item.event_kind === row.event_kind)) {
              return { error: { code: "23505", message: "duplicate" } };
            }
            writes.push(row);
            return { error: null };
          },
        };
      },
    };
    const first = await insertFunnelEvent(admin, {
      visitorId: "11111111-1111-4111-8111-111111111111",
      kind: "visit",
      utm: { source: "youtube", medium: "video", campaign: "a", content: "", term: "", landingPath: "/" },
    });
    const second = await insertFunnelEvent(admin, {
      visitorId: "11111111-1111-4111-8111-111111111111",
      kind: "visit",
    });
    expect(first).toBe("ok");
    expect(second).toBe("duplicate");
    expect(writes).toHaveLength(1);
  });
});
