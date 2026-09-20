import { describe, expect, it } from "vitest";
import { DEFAULT_BILLING_PLANS } from "@kensapo/domain";
import {
  currentPlanHeadline,
  isFreePlan,
  monthlyPriceLabel,
  planUseLine,
  trialPlanLabel,
} from "./plan-copy";
import { BILLING_HEADLINE, BILLING_SUPPORT } from "../product/workflow";

describe("plan-copy", () => {
  it("keeps official paid prices without showing seat tiers in billing copy", () => {
    expect(monthlyPriceLabel("standard")).toBe("月額 39,800円");
    expect(monthlyPriceLabel("business")).toBe("月額 65,000円");
    expect(DEFAULT_BILLING_PLANS.find((plan) => plan.code === "standard")?.monthlyPriceJpy).toBe(39_800);
    const visible = [trialPlanLabel(), monthlyPriceLabel("standard"), monthlyPriceLabel("business"), planUseLine("standard")].join(
      " ",
    );
    expect(visible).toMatch(/14日間無料体験/);
    expect(visible).not.toMatch(/1〜3名|4〜30名|31〜50名|51名以上|月額 0円/);
  });

  it("frames STANDARD as a company plan", () => {
    expect(currentPlanHeadline("free", "trial_active")).toBe("現在 14日間無料体験");
    expect(currentPlanHeadline("free", "grandfathered_free")).toBe("現在 FREE");
    expect(isFreePlan("pro")).toBe(false);
    expect(planUseLine("standard")).toMatch(/標準業務/);
    expect(planUseLine("business")).toMatch(/同じ流れ/);
    const salesCopy = [BILLING_HEADLINE, BILLING_SUPPORT, planUseLine("standard"), trialPlanLabel()].join(" ");
    expect(salesCopy).not.toMatch(/4人目|1席|席代/);
    expect(salesCopy).not.toMatch(/使える流れは同じ/);
  });
});
