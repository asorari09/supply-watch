import { describe, expect, it } from "vitest";

import { computeReorder } from "@/lib/inventory/reorder-engine";
import type { ReorderEngineInput } from "@/lib/inventory/types";

const goldenInput: ReorderEngineInput = {
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
};

describe("computeReorder", () => {
  it("matches the corrected §9 golden example exactly", () => {
    const result = computeReorder(goldenInput);

    expect(result.isInsufficientData).toBe(false);
    if (result.isInsufficientData) {
      return;
    }

    expect(result.ss).toBe(40);
    expect(result.rop).toBe(250);
    expect(result.eoq).toBe(383);
    expect(result.inventoryPosition).toBe(120);
    expect(result.shouldReorder).toBe(true);
    expect(result.recommendedQty).toBe(400);
    expect(result.formulaBranch).toBe("lead_time_std_known");
    expect(result.inputs).toEqual(goldenInput);
  });

  it("uses the unknown lead-time standard deviation branch", () => {
    const result = computeReorder({
      d: 10,
      sigmaD: 3,
      ltPrime: 21,
      z: 1.645,
      orderCost: 100,
      holdingCost: 5,
      moq: 100,
      onHand: 120,
      onOrder: 0,
      backorders: 0,
    });

    expect(result.isInsufficientData).toBe(false);
    if (result.isInsufficientData) {
      return;
    }

    expect(result.ss).toBe(23);
    expect(result.rop).toBe(233);
    expect(result.formulaBranch).toBe("lead_time_std_unknown");
  });

  it("rounds ROP only after adding mean lead-time demand and raw safety stock", () => {
    const result = computeReorder({ ...goldenInput, d: 10.5 });

    expect(result.isInsufficientData).toBe(false);
    if (result.isInsufficientData) {
      return;
    }

    expect(result.ss).toBe(42);
    expect(result.rop).toBe(262);
  });

  it("does not recommend an order when inventory position meets the ROP", () => {
    const result = computeReorder({ ...goldenInput, onHand: 400 });

    expect(result.isInsufficientData).toBe(false);
    if (result.isInsufficientData) {
      return;
    }

    expect(result.shouldReorder).toBe(false);
    expect(result.recommendedQty).toBe(0);
    expect(result.rationaleTemplate).toBe("IP 400 ≥ ROP 250; no reorder.");
  });

  it("returns insufficient data without throwing for invalid required inputs", () => {
    const holdingCostResult = computeReorder({
      ...goldenInput,
      holdingCost: 0,
    });
    const leadTimeResult = computeReorder({ ...goldenInput, ltPrime: 0 });
    const sigmaResult = computeReorder({ ...goldenInput, sigmaD: -1 });

    expect(holdingCostResult.isInsufficientData).toBe(true);
    if (holdingCostResult.isInsufficientData) {
      expect(holdingCostResult.reason).toContain("divide-by-zero");
    }
    expect(leadTimeResult.isInsufficientData).toBe(true);
    expect(sigmaResult.isInsufficientData).toBe(true);
  });
});
