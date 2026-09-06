import { confirmationQuestion, needsHumanConfirm } from "./capture-fields";
import { calcDurationDays } from "./duration";
import { describe, expect, it } from "vitest";
import { calcGrossProfit, calcGrossProfitRate, calcTotalCost } from "./finance";
import { resolvedCaptureValue } from "./capture";

describe("finance", () => {
  it("computes gross profit without an LLM", () => {
    expect(calcTotalCost({ material: 10, subcontract: 20, labor: 5, other: 1 })).toBe(36);
    expect(calcGrossProfit(100, 36)).toBe(64);
    expect(calcGrossProfitRate(100, 36)).toBe(0.64);
    expect(calcGrossProfitRate(0, 10)).toBeNull();
  });
});

describe("duration", () => {
  it("counts inclusive calendar days", () => {
    expect(calcDurationDays("2026-08-01", "2026-08-31")).toBe(31);
  });
});

describe("capture confirm copy", () => {
  it("asks in field language, not schema language", () => {
    expect(confirmationQuestion("material", { code: "HI25", quantity: 12, unit: "本" })).toBe(
      "HI25 12 本 で合っていますか？",
    );
    expect(needsHumanConfirm(0.72)).toBe(true);
    expect(needsHumanConfirm(0.94)).toBe(false);
  });
});

describe("capture", () => {
  it("does not treat a proposal as confirmed", () => {
    expect(
      resolvedCaptureValue({
        fieldKey: "materials",
        confidence: 0.94,
        proposedValue: { code: "HI25", qty: 12 },
        correctedValue: null,
        confirmedValue: null,
        status: "pending",
        confirmedBy: null,
        confirmedAt: null,
      }),
    ).toBeNull();
  });
});
