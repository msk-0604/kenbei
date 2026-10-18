import { describe, expect, it } from "vitest";
import {
  attributionFromUserMetadata,
  attributionToUserMetadata,
  deserializeUtmAttribution,
  pickSignupAttribution,
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

describe("signup attribution kept on the account", () => {
  const visitorId = "11111111-1111-4111-8111-111111111111";
  const formUtm = parseUtmSearch(new URLSearchParams("utm_source=form&utm_medium=outbound&utm_content=AB3CD"), "/");

  it("stores nothing when the visitor came without a source", () => {
    expect(attributionToUserMetadata({ visitorId, utm: parseUtmSearch(new URLSearchParams(""), "/") })).toBeNull();
  });

  it("recovers the source when the confirmation mail is opened on another device", () => {
    const metadata = attributionToUserMetadata({ visitorId, utm: formUtm });
    const picked = pickSignupAttribution({ visitorId: null, utm: parseUtmSearch(new URLSearchParams(""), "/") }, metadata);
    expect(picked.utm.source).toBe("form");
    expect(picked.utm.content).toBe("AB3CD");
    expect(picked.visitorId).toBe(visitorId);
  });

  it("prefers the cookie on the device that creates the company", () => {
    const metadata = attributionToUserMetadata({ visitorId, utm: formUtm });
    const cookieUtm = parseUtmSearch(new URLSearchParams("utm_source=youtube"), "/");
    expect(pickSignupAttribution({ visitorId: null, utm: cookieUtm }, metadata).utm.source).toBe("youtube");
  });

  it("ignores metadata that is not ours", () => {
    expect(attributionFromUserMetadata({ display_name: "山田" })).toEqual({ visitorId: null, utm: null });
    expect(attributionFromUserMetadata({ kb_utm: "x", kb_vid: "nope" })).toEqual({ visitorId: null, utm: null });
  });
});
