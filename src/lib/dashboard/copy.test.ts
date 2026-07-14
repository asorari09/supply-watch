import { describe, expect, it } from "vitest";

import {
  formatActionHeadline,
  formatActionMetricsInline,
  formatActionOrderTitle,
  formatActionSupportCompact,
  formatProjectedStock,
  formatRegionLabel,
  formatSignalStatus,
} from "@/lib/dashboard/copy";

describe("dashboard copy helpers", () => {
  it("expands known region codes", () => {
    expect(formatRegionLabel("US-TX")).toBe("Texas, USA");
    expect(formatRegionLabel("JP")).toBe("Japan");
    expect(formatRegionLabel("ZZ-XX")).toBe("ZZ-XX");
  });

  it("phrases negative inventory position as a shortfall", () => {
    expect(formatProjectedStock(-50)).toBe("Stock shortfall: 50 units");
    expect(formatProjectedStock(290)).toBe("Projected stock: 290");
    expect(formatProjectedStock(null)).toBe("Projected stock unavailable");
  });

  it("maps signal status to business language", () => {
    expect(formatSignalStatus("active")).toBe("Ongoing");
    expect(formatSignalStatus("resolved")).toBe("Cleared");
  });

  it("builds an action headline with optional warning glyph", () => {
    expect(
      formatActionHeadline({
        sku: "RIS-SEAL-835",
        recommendedQty: 900,
        severity: "high",
      }),
    ).toBe("⚠ Order 900 units of RIS-SEAL-835");
  });

  it("formatActionSupportCompact preserves disruption, LT, stock, and ROP numbers", () => {
    const compact = formatActionSupportCompact({
      disruptionTypes: ["flood"],
      leadTimeBase: 28,
      leadTimeDelta: 7,
      inventoryPosition: 105,
      rop: 1404,
    });
    expect(compact).toBe(
      "Flood · lead time 28→35d · stock 105 vs reorder 1404",
    );
    expect(compact).toContain("28");
    expect(compact).toContain("35");
    expect(compact).toContain("105");
    expect(compact).toContain("1404");
  });

  it("formatActionSupportCompact keeps shortfall and delta when base LT is missing", () => {
    const compact = formatActionSupportCompact({
      disruptionTypes: ["port_closure"],
      leadTimeBase: null,
      leadTimeDelta: 7,
      inventoryPosition: -40,
      rop: 500,
    });
    expect(compact).toBe(
      "Port Closure · lead time +7d · stock shortfall 40 vs reorder 500",
    );
  });

  it("formats dense order title and inline metrics with numbers", () => {
    expect(formatActionOrderTitle(1500)).toBe("Order 1500 units");
    expect(
      formatActionMetricsInline({
        ss: 264,
        rop: 1404,
        inventoryPosition: 105,
      }),
    ).toBe("SS 264 · ROP 1404 · Stock 105");
  });
});
