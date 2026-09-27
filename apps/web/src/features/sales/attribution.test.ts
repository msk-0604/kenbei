import { describe, expect, it } from "vitest";
import {
  deserializeUtmAttribution,
  firstTouchUtm,
  hasUtmValues,
  isVisitorId,
  parseUtmSearch,
  serializeUtmAttribution,
} from "./attribution";
import { readAttributionFromCookies, stripeAttributionMetadata } from "./attribution-cookies";

describe("attribution", () => {
  it("parses first-touch UTM and ignores a later campaign", () => {
    const first = parseUtmSearch(
      new URLSearchParams("utm_source=youtube&utm_medium=video&utm_campaign=kenbei-photos"),
      "/",
    );
    expect(hasUtmValues(first)).toBe(true);
    const later = parseUtmSearch(new URLSearchParams("utm_source=other"), "/signup");
    const kept = firstTouchUtm(first, later);
    expect(kept?.source).toBe("youtube");
    expect(kept?.campaign).toBe("kenbei-photos");
    expect(deserializeUtmAttribution(serializeUtmAttribution(first))?.source).toBe("youtube");
  });

  it("reads cookies for Checkout metadata without inventing values", () => {
    const visitorId = "11111111-1111-4111-8111-111111111111";
    expect(isVisitorId(visitorId)).toBe(true);
    const utm = parseUtmSearch(new URLSearchParams("utm_source=youtube"), "/");
    const cookies = {
      get(name: string) {
        if (name === "kb_vid") {
          return { value: visitorId };
        }
        if (name === "kb_utm") {
          return { value: serializeUtmAttribution(utm) };
        }
        return undefined;
      },
    };
    const read = readAttributionFromCookies(cookies);
    expect(read.visitorId).toBe(visitorId);
    expect(stripeAttributionMetadata(read)).toEqual({
      visitor_id: visitorId,
      utm_source: "youtube",
    });
  });
});
