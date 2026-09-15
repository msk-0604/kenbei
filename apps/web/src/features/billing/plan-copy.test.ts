import { describe, expect, it } from "vitest";
import { DEFAULT_BILLING_PLANS } from "@kensapo/domain";
import {
  currentPlanHeadline,
  isFreePlan,
  monthlyPriceLabel,
  planUseLine,
  seatRangeLabel,
  standardFlatNote,
  standardScopeLine,
} from "./plan-copy";
import { BILLING_HEADLINE, BILLING_SUPPORT } from "../product/workflow";

describe("plan-copy", () => {
  it("keeps official seat ranges and prices", () => {
    expect(seatRangeLabel("free")).toBe("1〜3名");
    expect(seatRangeLabel("standard")).toBe("4〜30名まで");
    expect(seatRangeLabel("pro")).toBe("4〜30名まで");
    expect(seatRangeLabel("business")).toBe("31〜50名");
    expect(monthlyPriceLabel("free")).toBe("月額 0円");
    expect(monthlyPriceLabel("standard")).toBe("月額 39,800円");
    expect(monthlyPriceLabel("business")).toBe("月額 65,000円");
    expect(DEFAULT_BILLING_PLANS.find((plan) => plan.code === "standard")?.monthlyPriceJpy).toBe(39_800);
  });

  it("frames STANDARD as a company plan, not a fourth seat", () => {
    expect(currentPlanHeadline("free")).toBe("現在 FREE");
    expect(isFreePlan("pro")).toBe(false);
    expect(planUseLine("free")).toMatch(/試せます/);
    expect(planUseLine("standard")).toMatch(/標準業務/);
    expect(planUseLine("business")).toMatch(/同じ流れ/);
    expect(standardScopeLine()).toMatch(/会社ひとつ分/);
    expect(standardFlatNote()).toMatch(/30名まで/);
    const salesCopy = [
      BILLING_HEADLINE,
      BILLING_SUPPORT,
      planUseLine("standard"),
      standardScopeLine(),
      standardFlatNote(),
    ].join(" ");
    expect(salesCopy).not.toMatch(/4人目|1席|席代/);
    expect(salesCopy).not.toMatch(/使える流れは同じ/);
  });
});
