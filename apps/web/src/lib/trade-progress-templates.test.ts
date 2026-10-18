import { describe, expect, it } from "vitest";
import { STANDARD_PROGRESS_ITEMS } from "./standard-progress-items";
import { TRADE_TEMPLATES, tradeTemplate } from "./trade-progress-templates";

describe("trade templates", () => {
  it("keeps the plumbing list as the default", () => {
    expect(TRADE_TEMPLATES[0]?.key).toBe("plumbing");
    expect(tradeTemplate("plumbing")?.items).toBe(STANDARD_PROGRESS_ITEMS);
  });

  it("fits the progress_item_presets constraints and has no duplicates", () => {
    const keys = new Set<string>();
    for (const template of TRADE_TEMPLATES) {
      expect(keys.has(template.key)).toBe(false);
      keys.add(template.key);
      const seen = new Set<string>();
      for (const item of template.items) {
        expect(item.item_name.trim().length).toBeGreaterThan(0);
        expect(item.item_name.length).toBeLessThanOrEqual(120);
        expect(item.category.length).toBeLessThanOrEqual(60);
        expect((item.section ?? "").length).toBeLessThanOrEqual(60);
        const key = `${item.category}/${item.section ?? ""}/${item.item_name}`;
        expect(seen.has(key), `${template.label}: ${key}`).toBe(false);
        seen.add(key);
      }
    }
  });

  it("covers the main trades", () => {
    expect(TRADE_TEMPLATES.map((t) => t.label)).toEqual(
      expect.arrayContaining(["電気工事", "内装工事", "外構・エクステリア", "塗装工事", "空調・設備工事", "解体工事"]),
    );
  });
});
