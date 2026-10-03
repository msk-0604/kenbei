import { describe, expect, it } from "vitest";
import { DEFAULT_BILLING_PLANS } from "@kensapo/domain";
import {
  KENBEI_INCLUDED,
  KENBEI_PRICE_LABEL,
  KENBEI_PRICE_NOTE,
  checkoutButtonLabel,
  currentPlanHeadline,
  dailyPriceLabel,
  isFreePlan,
  monthlyPriceLabel,
  trialPlanLabel,
} from "./plan-copy";

describe("plan-copy", () => {
  it("shows one paid price of 9,800 yen", () => {
    expect(monthlyPriceLabel("standard")).toBe("月額 9,800円");
    expect(KENBEI_PRICE_LABEL).toBe("月額 9,800円");
    expect(DEFAULT_BILLING_PLANS.find((plan) => plan.code === "standard")?.monthlyPriceJpy).toBe(9_800);
    expect(dailyPriceLabel()).toBe("1日あたり約327円");
    expect(KENBEI_PRICE_NOTE).toMatch(/税込/);
    const visible = [
      trialPlanLabel(),
      KENBEI_PRICE_LABEL,
      KENBEI_PRICE_NOTE,
      ...KENBEI_INCLUDED,
      checkoutButtonLabel("trial_active"),
      checkoutButtonLabel("trial_expired"),
    ].join(" ");
    expect(visible).toMatch(/14日間無料体験/);
    expect(visible).not.toMatch(/39,800|65,000|STANDARD|BUSINESS|月額 0円/);
  });

  it("describes the current state in plain words", () => {
    expect(currentPlanHeadline("free", "trial_active")).toMatch(/無料体験中/);
    expect(currentPlanHeadline("pro", "paid_active")).toBe("KENBEIをご契約中です");
    expect(currentPlanHeadline("free", "grandfathered_free")).toBe("現在 FREE");
    expect(isFreePlan("pro")).toBe(false);
  });
});
