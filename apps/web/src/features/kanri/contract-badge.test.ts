import { describe, expect, it } from "vitest";
import { contractBadge } from "./contract-badge";

const base = {
  access: "trial_active" as const,
  trialDaysLeft: 29,
  trialEndsAt: "2026-11-17T00:00:00Z",
  currentPeriodEnd: null,
  cancelAtPeriodEnd: false,
  invoicePending: false,
};

describe("contractBadge", () => {
  it("shows the trial with days left", () => {
    expect(contractBadge(base)).toMatchObject({ label: "無料体験中・残り29日", tone: "trial" });
  });

  it("shows a paid contract with the next renewal", () => {
    const badge = contractBadge({ ...base, access: "paid_active", currentPeriodEnd: "2026-12-17T00:00:00Z" });
    expect(badge.label).toBe("ご契約中");
    expect(badge.detail).toContain("12月17日");
  });

  it("shows cancel-at-period-end and invoice-pending clearly", () => {
    expect(
      contractBadge({ ...base, access: "paid_active", cancelAtPeriodEnd: true, currentPeriodEnd: "2026-12-17T00:00:00Z" }).label,
    ).toBe("解約予約中");
    expect(contractBadge({ ...base, invoicePending: true }).label).toBe("請求書の入金待ち");
  });

  it("asks to contract when the trial is over", () => {
    expect(contractBadge({ ...base, access: "trial_expired", trialDaysLeft: null }).tone).toBe("warn");
  });
});
