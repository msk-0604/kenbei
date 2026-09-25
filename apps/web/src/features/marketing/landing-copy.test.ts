import { describe, expect, it } from "vitest";
import { DEFAULT_BILLING_PLANS } from "@kensapo/domain";
import {
  LANDING_FAQS,
  LANDING_HEADLINE,
  TRIAL_NO_CARD_LINE,
  landingPaidPlans,
  memberLimitLabel,
  monthlyYenLabel,
} from "./landing-copy";

describe("landing copy stays on confirmed billing facts", () => {
  it("shows official paid prices and seat limits from the plan catalog", () => {
    const standard = DEFAULT_BILLING_PLANS.find((plan) => plan.code === "standard");
    const business = DEFAULT_BILLING_PLANS.find((plan) => plan.code === "business");
    expect(standard?.monthlyPriceJpy).toBe(39_800);
    expect(standard?.maxMembers).toBe(50);
    expect(business?.monthlyPriceJpy).toBe(65_000);
    expect(business?.maxMembers).toBeNull();
    expect(landingPaidPlans()).toEqual([
      { code: "standard", name: "STANDARD", monthlyPriceJpy: 39_800, maxMembers: 50 },
      { code: "business", name: "BUSINESS", monthlyPriceJpy: 65_000, maxMembers: null },
    ]);
    expect(monthlyYenLabel(39_800)).toBe("月額 39,800円");
    expect(memberLimitLabel(50)).toBe("50名まで");
    expect(memberLimitLabel(null)).toBe("人数上限なし");
  });

  it("does not invent tax, storage, AI limits, or refunds", () => {
    const text = [LANDING_HEADLINE, TRIAL_NO_CARD_LINE, ...LANDING_FAQS.flatMap((item) => [item.q, item.a])].join(" ");
    expect(text).not.toMatch(/税込|税別|保存容量|GB|返金|自動連携/);
    expect(text).toMatch(/クレジットカードは不要/);
    expect(text).toMatch(/自動課金はしません/);
    expect(text).toMatch(/期末で解約/);
    expect(text).toMatch(/Webブラウザ/);
  });
});
