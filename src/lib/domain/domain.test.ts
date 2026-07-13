import { describe, expect, it } from "vitest";

import { geoSchema, regionCodeSchema } from "@/lib/domain/common";
import { commsDraftSchema } from "@/lib/domain/comms-draft";
import { reorderRecommendationSchema } from "@/lib/domain/reorder-recommendation";
import { riskFlagSchema } from "@/lib/domain/risk-flag";
import { shipmentSchema } from "@/lib/domain/shipment";
import { signalSchema } from "@/lib/domain/signal";
import { skuSchema } from "@/lib/domain/sku";

const id = "00000000-0000-4000-8000-000000000001";
const timestamp = "2026-07-13T12:00:00.000Z";
const pointGeo = { kind: "point", lat: 29.7604, lon: -95.3698 } as const;

describe("common domain value objects", () => {
  it("parses every Geo variant", () => {
    expect(geoSchema.safeParse(pointGeo).success).toBe(true);
    expect(
      geoSchema.safeParse({
        kind: "bbox",
        minLat: 20,
        minLon: -100,
        maxLat: 30,
        maxLon: -90,
      }).success,
    ).toBe(true);
    expect(
      geoSchema.safeParse({ kind: "regions", regionCodes: ["US-TX", "MX"] })
        .success,
    ).toBe(true);
  });

  it("rejects malformed Geo variants", () => {
    expect(
      geoSchema.safeParse({ kind: "point", lat: 91, lon: 0 }).success,
    ).toBe(false);
  });

  it("accepts ISO region codes and rejects malformed codes", () => {
    expect(regionCodeSchema.safeParse("US").success).toBe(true);
    expect(regionCodeSchema.safeParse("US-TX").success).toBe(true);
    expect(regionCodeSchema.safeParse("usa").success).toBe(false);
    expect(regionCodeSchema.safeParse("").success).toBe(false);
    expect(regionCodeSchema.safeParse("US_TX").success).toBe(false);
  });
});

describe("Signal", () => {
  const validSignal = {
    id,
    source: "weather",
    disruptionType: "hurricane",
    affectedRegions: ["US-TX"],
    geo: pointGeo,
    severity: "high",
    delayDaysEstimate: 7,
    confidence: "high",
    detectedAt: timestamp,
    rawRef: "open-meteo-alert-1",
    dedupeHash: "signal-hash",
    status: "active",
  };

  it("parses a valid signal", () => {
    expect(signalSchema.safeParse(validSignal).success).toBe(true);
  });

  it("rejects invalid enum and region values", () => {
    expect(
      signalSchema.safeParse({ ...validSignal, source: "manual" }).success,
    ).toBe(false);
    expect(
      signalSchema.safeParse({ ...validSignal, affectedRegions: ["usa"] })
        .success,
    ).toBe(false);
  });
});

describe("Sku", () => {
  const validSku = {
    id,
    sku: "LSC-CTRL-100",
    supplierId: id,
    onHand: 320,
    onOrder: 180,
    backorders: 25,
    avgDailyDemand: 18.5,
    demandStd: 5.2,
    unitCost: 84,
    holdingCost: 16,
    orderCost: 220,
    moq: 100,
    serviceLevelZ: 1.645,
  };

  it("parses a valid SKU", () => {
    expect(skuSchema.safeParse(validSku).success).toBe(true);
  });

  it("rejects negative quantities and non-integer MOQ", () => {
    expect(skuSchema.safeParse({ ...validSku, onHand: -1 }).success).toBe(
      false,
    );
    expect(skuSchema.safeParse({ ...validSku, moq: 100.5 }).success).toBe(
      false,
    );
  });
});

describe("Shipment", () => {
  const validShipment = {
    id,
    skuId: id,
    supplierId: id,
    originGeo: pointGeo,
    destGeo: { kind: "regions", regionCodes: ["US-IL"] },
    routeRegions: ["US-TX", "US-IL"],
    eta: timestamp,
    qty: 180,
    status: "in_transit",
  };

  it("parses a valid shipment", () => {
    expect(shipmentSchema.safeParse(validShipment).success).toBe(true);
  });

  it("rejects malformed routes and fractional quantities", () => {
    expect(
      shipmentSchema.safeParse({ ...validShipment, routeRegions: ["US_TX"] })
        .success,
    ).toBe(false);
    expect(
      shipmentSchema.safeParse({ ...validShipment, qty: 1.5 }).success,
    ).toBe(false);
  });
});

describe("RiskFlag", () => {
  const validRiskFlag = {
    id,
    signalId: id,
    skuId: id,
    exposureType: "shipment_route",
    computedLeadTimeDelta: 5,
    severity: "high",
    status: "open",
    createdAt: timestamp,
    tickId: id,
  };

  it("parses a valid risk flag", () => {
    expect(riskFlagSchema.safeParse(validRiskFlag).success).toBe(true);
  });

  it("rejects invalid IDs and negative delay values", () => {
    expect(
      riskFlagSchema.safeParse({ ...validRiskFlag, id: "not-a-uuid" }).success,
    ).toBe(false);
    expect(
      riskFlagSchema.safeParse({ ...validRiskFlag, computedLeadTimeDelta: -1 })
        .success,
    ).toBe(false);
  });
});

describe("ReorderRecommendation", () => {
  const validRecommendation = {
    id,
    skuId: id,
    riskFlagId: id,
    ss: 40,
    rop: 250,
    inventoryPosition: 120,
    recommendedQty: 300,
    formulaBranch: "lead_time_std_known",
    rationaleTemplate: "IP 120 < ROP 250.",
    isInsufficientData: false,
    inputsHash: "inputs-hash",
    createdAt: timestamp,
  };

  it("parses a valid deterministic recommendation", () => {
    expect(
      reorderRecommendationSchema.safeParse(validRecommendation).success,
    ).toBe(true);
  });

  it("rejects fractional and negative deterministic quantities", () => {
    expect(
      reorderRecommendationSchema.safeParse({
        ...validRecommendation,
        ss: 40.5,
      }).success,
    ).toBe(false);
    expect(
      reorderRecommendationSchema.safeParse({
        ...validRecommendation,
        recommendedQty: -1,
      }).success,
    ).toBe(false);
  });
});

describe("CommsDraft", () => {
  const validDraft = {
    id,
    riskFlagId: id,
    recommendationId: id,
    generation: 1,
    subject: "Request for updated delivery timing",
    body: "Please confirm the revised ETA.",
    tone: "professional",
    modelUsed: "cheap-model",
    status: "pending_approval",
    tickId: id,
    createdAt: timestamp,
  };

  it("parses a valid LLM-authored draft shape", () => {
    expect(commsDraftSchema.safeParse(validDraft).success).toBe(true);
  });

  it("rejects invalid status and fractional generations", () => {
    expect(
      commsDraftSchema.safeParse({ ...validDraft, status: "sending" }).success,
    ).toBe(false);
    expect(
      commsDraftSchema.safeParse({ ...validDraft, generation: 1.5 }).success,
    ).toBe(false);
  });
});
