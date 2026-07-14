import { describe, expect, it } from "vitest";

import { assertScenario } from "@/evals/assert-scenario";
import { runScenario } from "@/evals/run-scenario";
import type { Scenario } from "@/evals/types";
import {
  signalSchema,
  skuSchema,
  supplierSchema,
  shipmentSchema,
} from "@/lib/domain";

const horizonBase = "2026-01-01T00:00:00.000Z";

describe("replay harness", () => {
  it("runs an inline hand-computed scenario and reports it green", () => {
    const supplier = supplierSchema.parse({
      id: "00000000-0000-4000-8000-000000000001",
      name: "Smoke supplier",
      regionCode: "CN",
      geo: { kind: "point", lat: 1, lon: 1 },
      leadTimeDaysBase: 10,
      reliability: 0.9,
    });
    const sku = skuSchema.parse({
      id: "10000000-0000-4000-8000-000000000001",
      sku: "SMOKE-1",
      supplierId: supplier.id,
      onHand: 0,
      onOrder: 100,
      backorders: 0,
      avgDailyDemand: 10,
      demandStd: 3,
      unitCost: 1,
      holdingCost: 5,
      orderCost: 100,
      moq: 10,
      serviceLevelZ: 1.645,
    });
    const shipment = shipmentSchema.parse({
      id: "20000000-0000-4000-8000-000000000001",
      skuId: sku.id,
      supplierId: supplier.id,
      originGeo: { kind: "point", lat: 1, lon: 1 },
      destGeo: { kind: "point", lat: 2, lon: 2 },
      routeRegions: ["US-TX"],
      eta: "2026-01-09T00:00:00.000Z",
      qty: 100,
      status: "in_transit",
    });
    const signal = signalSchema.parse({
      id: "30000000-0000-4000-8000-000000000001",
      source: "weather",
      disruptionType: "storm",
      affectedRegions: ["US-TX"],
      geo: { kind: "regions", regionCodes: ["US-TX"] },
      severity: "high",
      delayDaysEstimate: 7,
      confidence: "high",
      detectedAt: horizonBase,
      rawRef: "smoke-signal",
      dedupeHash: "smoke-signal",
      status: "active",
    });
    const scenario: Scenario = {
      name: "harness smoke",
      initialInventory: {
        suppliers: [supplier],
        skus: [sku],
        shipments: [shipment],
      },
      timeline: [{ at: horizonBase, signals: [signal] }],
      horizonBase,
      expected: {
        flags: [
          {
            skuId: sku.id,
            exposureType: "shipment_route",
            shipmentId: shipment.id,
          },
        ],
        // Hand-computed: SS=ceil(1.645*3*sqrt(10))=16; ROP=ceil(100+15.606)=116;
        // delayed shipment is excluded, EOQ=ceil(sqrt(146000))=383, then MOQ 10 => 390.
        recommendations: [
          { skuId: sku.id, ss: 16, rop: 116, recommendedQty: 390 },
        ],
        alerts: [{ level: "critical" }],
        noUnapprovedSend: true,
      },
    };

    expect(assertScenario(scenario, runScenario(scenario))).toEqual({
      scenarioName: "harness smoke",
      passed: true,
      failures: [],
    });
  });
});
