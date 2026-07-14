import { describe, expect, it } from "vitest";

import { assess, alertLevel } from "@/lib/agents/assessment-engine/assess";
import { correlate } from "@/lib/agents/assessment-engine/correlate";
import {
  signalSchema,
  skuSchema,
  supplierSchema,
  shipmentSchema,
} from "@/lib/domain";

const horizonBase = "2026-01-01T00:00:00.000Z";
const supplier = (id: string, regionCode: string, leadTimeDaysBase: number) =>
  supplierSchema.parse({
    id,
    name: id,
    regionCode,
    geo: { kind: "point", lat: 1, lon: 1 },
    leadTimeDaysBase,
    reliability: 0.9,
  });
const sku = (
  id: string,
  supplierId: string,
  onOrder: number,
  holdingCost = 5,
) =>
  skuSchema.parse({
    id,
    sku: id,
    supplierId,
    onHand: 0,
    onOrder,
    backorders: 0,
    avgDailyDemand: 10,
    demandStd: 3,
    unitCost: 1,
    holdingCost,
    orderCost: 100,
    moq: 10,
    serviceLevelZ: 1.645,
  });
const shipment = (
  id: string,
  skuId: string,
  supplierId: string,
  region: string,
) =>
  shipmentSchema.parse({
    id,
    skuId,
    supplierId,
    originGeo: { kind: "point", lat: 1, lon: 1 },
    destGeo: { kind: "point", lat: 2, lon: 2 },
    routeRegions: [region],
    eta: "2026-01-09T00:00:00.000Z",
    qty: 100,
    status: "in_transit",
  });
const signal = (
  id: string,
  region: string,
  type = "storm",
  severity = "high",
) =>
  signalSchema.parse({
    id,
    source: "weather",
    disruptionType: type,
    affectedRegions: [region],
    geo: { kind: "regions", regionCodes: [region] },
    severity,
    delayDaysEstimate: 7,
    confidence: "high",
    detectedAt: horizonBase,
    rawRef: id,
    dedupeHash: id,
    status: "active",
  });

describe("assessment edge cases", () => {
  it("uses adjusted LT for region exposure and base LT for fallback, flipping exclusion", () => {
    const aSupplier = supplier(
      "00000000-0000-4000-8000-000000000001",
      "US-TX",
      10,
    );
    const aSku = sku("10000000-0000-4000-8000-000000000001", aSupplier.id, 100);
    const aShipment = shipment(
      "20000000-0000-4000-8000-000000000001",
      aSku.id,
      aSupplier.id,
      "US-TX",
    );
    const adjusted = assess({
      correlation: correlate({
        signals: [signal("30000000-0000-4000-8000-000000000001", "US-TX")],
        suppliers: [aSupplier],
        skus: [aSku],
        shipments: [aShipment],
      }),
      horizonBase,
    });
    const bSupplier = supplier(
      "00000000-0000-4000-8000-000000000002",
      "CN",
      10,
    );
    const bSku = sku("10000000-0000-4000-8000-000000000002", bSupplier.id, 100);
    const bShipment = shipment(
      "20000000-0000-4000-8000-000000000002",
      bSku.id,
      bSupplier.id,
      "US-TX",
    );
    const fallback = assess({
      correlation: correlate({
        signals: [signal("30000000-0000-4000-8000-000000000002", "US-TX")],
        suppliers: [bSupplier],
        skus: [bSku],
        shipments: [bShipment],
      }),
      horizonBase,
    });
    expect(adjusted.recommendations[0]?.inventoryPosition).toBe(100);
    expect(fallback.recommendations[0]?.inventoryPosition).toBe(0);
    expect(adjusted.recommendations[0]?.inputsHash).not.toBe(
      fallback.recommendations[0]?.inputsHash,
    );
  });

  it("stacks supplier delays and caps them at 60 days", () => {
    const s = supplier("00000000-0000-4000-8000-000000000003", "US-TX", 10);
    const k = sku("10000000-0000-4000-8000-000000000003", s.id, 0);
    expect(
      correlate({
        signals: [
          signal("30000000-0000-4000-8000-000000000003", "US-TX"),
          signal("30000000-0000-4000-8000-000000000004", "US-TX"),
        ],
        suppliers: [s],
        skus: [k],
        shipments: [],
      }).skus[0]?.leadTimePrime,
    ).toBe(24);
    expect(
      correlate({
        signals: Array.from({ length: 10 }, (_, index) =>
          signal(
            `30000000-0000-4000-${String(8000 + index)}-000000000010`,
            "US-TX",
          ),
        ),
        suppliers: [s],
        skus: [k],
        shipments: [],
      }).skus[0]?.leadTimePrime,
    ).toBe(70);
  });

  it("emits a shipment-route flag and fails closed on zero holding cost", () => {
    const s = supplier("00000000-0000-4000-8000-000000000004", "CN", 10);
    const k = sku("10000000-0000-4000-8000-000000000004", s.id, 100);
    const sh = shipment(
      "20000000-0000-4000-8000-000000000004",
      k.id,
      s.id,
      "US-TX",
    );
    const r = assess({
      correlation: correlate({
        signals: [signal("30000000-0000-4000-8000-000000000005", "US-TX")],
        suppliers: [s],
        skus: [k],
        shipments: [sh],
      }),
      horizonBase,
    });
    expect(
      r.flags.some(
        (flag) =>
          flag.exposureType === "shipment_route" && flag.shipmentId === sh.id,
      ),
    ).toBe(true);
    expect(r.recommendations[0]?.recommendedQty).toBe(390);
    const badSku = sku("10000000-0000-4000-8000-000000000005", s.id, 0, 0);
    const badShipment = shipment(
      "20000000-0000-4000-8000-000000000005",
      badSku.id,
      s.id,
      "US-TX",
    );
    const bad = assess({
      correlation: correlate({
        signals: [signal("30000000-0000-4000-8000-000000000006", "US-TX")],
        suppliers: [s],
        skus: [badSku],
        shipments: [badShipment],
      }),
      horizonBase,
    });
    expect(bad.flags).toEqual([]);
    expect(bad.recommendations).toEqual([]);
    expect(bad.alerts).toEqual([]);
  });

  it("maps alert thresholds exactly", () => {
    const sig = signal(
      "30000000-0000-4000-8000-000000000007",
      "US-TX",
      "congestion",
      "med",
    );
    const rec = {
      skuId: "00000000-0000-4000-8000-000000000010",
      riskFlagId: "00000000-0000-4000-8000-000000000011",
      ss: 0,
      rop: 100,
      inventoryPosition: 80,
      recommendedQty: 0,
      formulaBranch: "x",
      rationaleTemplate: "x",
      isInsufficientData: false,
      inputsHash: "x",
    };
    expect(alertLevel(sig, rec)).toBe("info");
    expect(alertLevel(sig, { ...rec, inventoryPosition: 70 })).toBe("warning");
    expect(alertLevel(sig, { ...rec, inventoryPosition: 40 })).toBe("critical");
  });
});
