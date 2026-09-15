import { describe, expect, it } from "vitest";
import {
  BILLING_HEADLINE,
  BILLING_SUPPORT,
  KENBEI_FLOW_STEPS,
  LEGACY_FLOW_STEPS,
  PRODUCT_LEAD,
  PRODUCT_SUPPORT,
} from "./workflow";

describe("product workflow copy", () => {
  it("describes the connected loop without unverified time savings", () => {
    expect(KENBEI_FLOW_STEPS).toEqual(["写真", "タスク", "進捗", "日報", "PDF"]);
    expect(LEGACY_FLOW_STEPS.join()).toMatch(/転記/);
    expect(LEGACY_FLOW_STEPS.join()).toMatch(/Excel/);
    expect(PRODUCT_LEAD).toMatch(/会社の事務/);
    expect(PRODUCT_SUPPORT).toMatch(/同じ流れ/);
    expect(`${PRODUCT_LEAD} ${PRODUCT_SUPPORT} ${BILLING_HEADLINE} ${BILLING_SUPPORT}`).not.toMatch(
      /分短縮|1〜2時間|残業/,
    );
  });
});
