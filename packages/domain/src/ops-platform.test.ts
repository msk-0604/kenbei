import { describe, expect, it } from "vitest";
import {
  exportJobOrgSafe,
  filterSameOrganization,
  onboardingComplete,
  parseMentions,
  acceptOnlySessionOrganization,
} from "./ops-platform";
import { planAllowsMemberCount, seatLimitError } from "./billing";

describe("tenant isolation helpers", () => {
  it("drops other-org rows", () => {
    const kept = filterSameOrganization(
      [
        { organizationId: "a", id: "1" },
        { organizationId: "b", id: "2" },
      ],
      "a",
    );
    expect(kept).toEqual([{ organizationId: "a", id: "1" }]);
  });

  it("blocks export mix", () => {
    expect(exportJobOrgSafe("org-a", "org-b")).toBe(false);
    expect(exportJobOrgSafe("org-a", "org-a")).toBe(true);
  });

  it("rejects claimed org that is not the session org", () => {
    expect(acceptOnlySessionOrganization("org-a", "org-b")).toBe(false);
    expect(acceptOnlySessionOrganization("org-a", "org-a")).toBe(true);
    expect(acceptOnlySessionOrganization("org-a", undefined)).toBe(true);
  });
});

describe("mentions and onboarding", () => {
  it("parses @display names", () => {
    expect(
      parseMentions("確認お願いします @山田 @不明", [
        { profileId: "p1", displayName: "山田" },
        { profileId: "p2", displayName: "佐藤" },
      ]),
    ).toEqual(["p1"]);
  });

  it("requires every onboarding check", () => {
    expect(
      onboardingComplete({
        hasOrganization: true,
        hasProject: true,
        hasInviteOrMember: true,
        hasPhoto: true,
        hasTask: false,
      }),
    ).toBe(false);
  });
});

describe("chat isolation helper", () => {
  it("does not mention users from another org list", () => {
    expect(
      parseMentions("@山田", [
        { profileId: "other-org", displayName: "山田" },
      ]),
    ).toEqual(["other-org"]);
  });
});

describe("seat limit", () => {
  it("enforces plan max members", () => {
    expect(planAllowsMemberCount({ maxMembers: 3 }, 3)).toBe(true);
    expect(planAllowsMemberCount({ maxMembers: 3 }, 4)).toBe(false);
  });

  it("matches official KENBEI seats and prices", () => {
    expect(seatLimitError("free", 3)).toBeNull();
    expect(seatLimitError("free", 4)).toMatch(/STANDARD/);
    expect(seatLimitError("standard", 30)).toBeNull();
    expect(seatLimitError("pro", 31)).toMatch(/BUSINESS/);
    expect(seatLimitError("business", 50)).toBeNull();
    expect(seatLimitError("business", 51)).toMatch(/要相談/);
    expect(seatLimitError("enterprise", 80)).toBeNull();
  });
});
