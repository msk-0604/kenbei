import { describe, expect, it } from "vitest";
import { DEFAULT_BILLING_PLANS } from "@kensapo/domain";
import {
  LANDING_FAQS,
  LANDING_HEADLINE,
  LANDING_LEAD,
  TAX_INCLUDED_LABEL,
  TRIAL_NO_CARD_LINE,
  landingPlan,
  memberLimitLabel,
  monthlyYenLabel,
  monthlyYenWithTaxLabel,
} from "./landing-copy";

describe("landing copy stays on confirmed billing facts", () => {
  it("sells one plan at 9,800 yen per month", () => {
    const standard = DEFAULT_BILLING_PLANS.find((plan) => plan.code === "standard");
    expect(standard?.monthlyPriceJpy).toBe(9_800);
    expect(standard?.maxMembers).toBe(20);
    expect(landingPlan()).toEqual({ code: "standard", name: "KENBEI", monthlyPriceJpy: 9_800, maxMembers: 20 });
    expect(monthlyYenLabel(9_800)).toBe("月額 9,800円");
    expect(monthlyYenWithTaxLabel(9_800)).toBe("月額 9,800円（税込）");
    expect(memberLimitLabel(20)).toBe("20名まで");
    expect(memberLimitLabel(null)).toBe("人数上限なし");
  });

  it("states confirmed tax-inclusive prices and does not invent storage, AI limits, or refunds", () => {
    const text = [LANDING_HEADLINE, LANDING_LEAD, TRIAL_NO_CARD_LINE, ...LANDING_FAQS.flatMap((item) => [item.q, item.a])].join(
      " ",
    );
    expect(text).toContain(TAX_INCLUDED_LABEL);
    expect(text).toMatch(/月額9,800円（税込）/);
    expect(text).not.toMatch(/39,800|65,000|STANDARD|BUSINESS/);
    expect(text).not.toMatch(/税別|保存容量|GB|返金|自動連携/);
    expect(text).toMatch(/クレジットカードは不要/);
    expect(text).toMatch(/自動課金はしません/);
    expect(text).toMatch(/期末で解約/);
    expect(text).toMatch(/Webブラウザ/);
  });
});
