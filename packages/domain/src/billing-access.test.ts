import { describe, expect, it } from "vitest";
import {
  canOpenBillingPortal,
  canStartCheckout,
  classifyBillingAccess,
  trialDaysRemaining,
  workspaceWriteBlockMessage,
  workspaceWritesAllowed,
} from "./billing-access";

const now = "2026-09-19T00:00:00.000Z";

describe("classifyBillingAccess", () => {
  it("starts new organizations as an active 14-day trial", () => {
    expect(
      classifyBillingAccess({
        planCode: "free",
        status: "trialing",
        trialEndsAt: "2026-10-03T00:00:00.000Z",
        now,
      }),
    ).toBe("trial_active");
    expect(
      workspaceWritesAllowed(
        classifyBillingAccess({
          planCode: "free",
          status: "trialing",
          trialEndsAt: "2026-10-03T00:00:00.000Z",
          now,
        }),
      ),
    ).toBe(true);
  });

  it("keeps grandfathered free orgs writable", () => {
    expect(
      classifyBillingAccess({
        planCode: "free",
        status: "active",
        trialEndsAt: null,
        now,
      }),
    ).toBe("grandfathered_free");
    expect(workspaceWriteBlockMessage("grandfathered_free")).toBeNull();
  });

  it("locks writes after trial expiry while reads stay a caller concern", () => {
    const access = classifyBillingAccess({
      planCode: "free",
      status: "trialing",
      trialEndsAt: "2026-09-18T00:00:00.000Z",
      now,
    });
    expect(access).toBe("trial_expired");
    expect(workspaceWritesAllowed(access)).toBe(false);
    expect(workspaceWriteBlockMessage(access)).toMatch(/無料体験が終了/);
  });

  it("allows STANDARD and BUSINESS while the subscription is active", () => {
    expect(
      classifyBillingAccess({
        planCode: "pro",
        status: "active",
        trialEndsAt: null,
        now,
      }),
    ).toBe("paid_active");
    expect(
      classifyBillingAccess({
        planCode: "business",
        status: "active",
        trialEndsAt: null,
        now,
      }),
    ).toBe("paid_active");
  });

  it("does not treat canceled as perpetual FREE", () => {
    const access = classifyBillingAccess({
      planCode: "pro",
      status: "canceled",
      trialEndsAt: null,
      now,
    });
    expect(access).toBe("paid_inactive");
    expect(workspaceWritesAllowed(access)).toBe(false);
  });
});

describe("billing operations", () => {
  it("lets admins start Checkout during trial and after expiry", () => {
    expect(canStartCheckout(true)).toBe(true);
    expect(canStartCheckout(false)).toBe(false);
  });

  it("lets members wait on billing while admins operate it", () => {
    expect(canStartCheckout(false)).toBe(false);
    expect(canOpenBillingPortal(true, "cus_1")).toBe(true);
    expect(canOpenBillingPortal(true, null)).toBe(false);
    expect(canOpenBillingPortal(false, "cus_1")).toBe(false);
  });

  it("counts remaining trial days", () => {
    expect(trialDaysRemaining("2026-10-03T00:00:00.000Z", now)).toBe(14);
    expect(trialDaysRemaining("2026-09-18T00:00:00.000Z", now)).toBe(0);
  });
});
