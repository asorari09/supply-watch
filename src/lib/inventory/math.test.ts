import { describe, expect, it } from "vitest";

import { ceilToMoq, safetyStockRaw } from "@/lib/inventory/math";

describe("ceilToMoq", () => {
  it.each([
    { value: 0, expected: 0 },
    { value: -5, expected: 0 },
    { value: 50, expected: 100 },
    { value: 200, expected: 200 },
    { value: 201, expected: 300 },
    { value: 383, expected: 400 },
  ])("rounds $value to $expected for MOQ 100", ({ value, expected }) => {
    expect(ceilToMoq(value, 100)).toBe(expected);
  });
});

describe("safetyStockRaw", () => {
  it("returns the known lead-time standard deviation branch", () => {
    const result = safetyStockRaw({
      d: 10,
      sigmaD: 3,
      ltPrime: 21,
      sigmaLT: 2,
      z: 1.645,
      orderCost: 100,
      holdingCost: 5,
      moq: 100,
      onHand: 120,
      onOrder: 0,
      backorders: 0,
    });

    expect(result.formulaBranch).toBe("lead_time_std_known");
    expect(result.value).toBeCloseTo(39.923, 3);
  });
});
