import { describe, expect, it } from "vitest";

import {
  formatActionHeadline,
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
});
