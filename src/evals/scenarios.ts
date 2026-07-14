import type { Scenario } from "@/evals/types";
import {
  signalSchema,
  skuSchema,
  supplierSchema,
  shipmentSchema,
  type Signal,
} from "@/lib/domain";

const horizonBase = "2026-01-01T00:00:00.000Z";
const point = { kind: "point" as const, lat: 1, lon: 1 };

const supplier = (id: string, regionCode: string, leadTimeDaysBase: number) =>
  supplierSchema.parse({
    id,
    name: `Supplier ${id}`,
    regionCode,
    geo: point,
    leadTimeDaysBase,
    reliability: 0.9,
  });

const sku = (
  id: string,
  supplierId: string,
  values: Partial<{
    onHand: number;
    onOrder: number;
    avgDailyDemand: number;
    demandStd: number;
    holdingCost: number;
  }> = {},
) =>
  skuSchema.parse({
    id,
    sku: `SKU-${id}`,
    supplierId,
    onHand: values.onHand ?? 0,
    onOrder: values.onOrder ?? 0,
    backorders: 0,
    avgDailyDemand: values.avgDailyDemand ?? 10,
    demandStd: values.demandStd ?? 3,
    unitCost: 1,
    holdingCost: values.holdingCost ?? 5,
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
    originGeo: point,
    destGeo: { kind: "point", lat: 2, lon: 2 },
    routeRegions: [region],
    eta: "2026-01-09T00:00:00.000Z",
    qty: 100,
    status: "in_transit",
  });

const signal = (
  id: string,
  region: string,
  disruptionType: string,
  severity: "low" | "med" | "high" = "high",
  status: "active" | "degraded" = "active",
) =>
  signalSchema.parse({
    id,
    source: "weather",
    disruptionType,
    affectedRegions: [region],
    geo: { kind: "regions", regionCodes: [region] },
    severity,
    delayDaysEstimate: 0,
    confidence: status === "active" ? "high" : "low",
    detectedAt: horizonBase,
    rawRef: id,
    dedupeHash: id,
    status,
  });

const criticalAlerts = (count: number) =>
  Array.from({ length: count }, () => ({ level: "critical" as const }));

const hurricaneSupplier = supplier(
  "00000000-0000-4000-8000-000000000101",
  "US-FL",
  10,
);
const hurricaneSku = sku(
  "10000000-0000-4000-8000-000000000101",
  hurricaneSupplier.id,
  { onHand: 20, avgDailyDemand: 7.25, demandStd: 2.4 },
);
const hurricaneSignal = signal(
  "30000000-0000-4000-8000-000000000101",
  "US-FL",
  "weather_disruption",
);

const routeSupplier = supplier(
  "00000000-0000-4000-8000-000000000102",
  "CN",
  10,
);
const routeSku = sku("10000000-0000-4000-8000-000000000102", routeSupplier.id, {
  onOrder: 100,
});
const routeShipment = shipment(
  "20000000-0000-4000-8000-000000000102",
  routeSku.id,
  routeSupplier.id,
  "US-TX",
);
const routeSignal = signal(
  "30000000-0000-4000-8000-000000000102",
  "US-TX",
  "storm",
);

const compoundSupplier = supplier(
  "00000000-0000-4000-8000-000000000103",
  "US-LA",
  10,
);
const compoundSku = sku(
  "10000000-0000-4000-8000-000000000103",
  compoundSupplier.id,
  { onHand: 100 },
);
const compoundSignals = [
  signal("30000000-0000-4000-8000-000000000103", "US-LA", "storm"),
  signal("30000000-0000-4000-8000-000000000104", "US-LA", "flood"),
];

const capSupplier = supplier(
  "00000000-0000-4000-8000-000000000104",
  "US-GA",
  10,
);
const capSku = sku("10000000-0000-4000-8000-000000000104", capSupplier.id);
const capSignals: Signal[] = Array.from({ length: 10 }, (_, index) =>
  signal(
    `30000000-0000-4000-${String(8100 + index)}-000000000104`,
    "US-GA",
    "storm",
  ),
);

const insufficientSupplier = supplier(
  "00000000-0000-4000-8000-000000000105",
  "US-MS",
  10,
);
const insufficientSku = sku(
  "10000000-0000-4000-8000-000000000105",
  insufficientSupplier.id,
  { holdingCost: 0 },
);
const insufficientSignal = signal(
  "30000000-0000-4000-8000-000000000105",
  "US-MS",
  "storm",
);

export const scenarios: Scenario[] = [
  {
    name: "hurricane port closure supplier-region exposure",
    initialInventory: {
      suppliers: [hurricaneSupplier],
      skus: [hurricaneSku],
      shipments: [],
    },
    timeline: [{ at: horizonBase, signals: [hurricaneSignal] }],
    horizonBase,
    expected: {
      // LT'=10+7=17; SS=ceil(1.645*2.4*sqrt(17))=ceil(16.278)=17;
      // ROP=ceil(7.25*17+16.278)=ceil(139.528)=140; IP=20;
      // EOQ=ceil(sqrt(2*(7.25*365)*100/5))=326; max(326,120)=326 -> MOQ 10 => 330.
      flags: [{ skuId: hurricaneSku.id, exposureType: "supplier_region" }],
      recommendations: [
        { skuId: hurricaneSku.id, ss: 17, rop: 140, recommendedQty: 330 },
      ],
      alerts: criticalAlerts(1),
      noUnapprovedSend: true,
    },
  },
  {
    name: "shipment-route flag excludes delayed on-order quantity",
    initialInventory: {
      suppliers: [routeSupplier],
      skus: [routeSku],
      shipments: [routeShipment],
    },
    timeline: [{ at: horizonBase, signals: [routeSignal] }],
    horizonBase,
    expected: {
      // Supplier is not region-exposed, so LT'=LT_base=10 and horizon is Jan 11.
      // new_eta=Jan 9+7=Jan 16 > Jan 11, so shipment qty 100 is excluded: IP=0.
      // SS=ceil(1.645*3*sqrt(10))=16; ROP=ceil(100+15.606)=116;
      // EOQ=ceil(sqrt(2*(10*365)*100/5))=383; max(383,116) -> MOQ 10 => 390.
      flags: [
        {
          skuId: routeSku.id,
          exposureType: "shipment_route",
          shipmentId: routeShipment.id,
        },
      ],
      recommendations: [
        { skuId: routeSku.id, ss: 16, rop: 116, recommendedQty: 390 },
      ],
      alerts: criticalAlerts(1),
      noUnapprovedSend: true,
    },
  },
  {
    name: "false-positive guard for unrelated region",
    initialInventory: {
      suppliers: [routeSupplier],
      skus: [routeSku],
      shipments: [],
    },
    timeline: [
      {
        at: horizonBase,
        signals: [
          signal("30000000-0000-4000-8000-000000000106", "US-CA", "storm"),
        ],
      },
    ],
    horizonBase,
    expected: {
      // US-CA matches neither supplier CN nor any shipment route: no exposure, no numeric computation, no flag.
      flags: [],
      recommendations: [],
      alerts: [],
      noUnapprovedSend: true,
    },
  },
  {
    name: "degraded signal is excluded without fabrication",
    initialInventory: {
      suppliers: [hurricaneSupplier],
      skus: [hurricaneSku],
      shipments: [],
    },
    timeline: [
      {
        at: horizonBase,
        signals: [
          signal(
            "30000000-0000-4000-8000-000000000107",
            "US-FL",
            "storm",
            "high",
            "degraded",
          ),
        ],
      },
    ],
    horizonBase,
    expected: {
      // The malformed/degraded signal is not active, so it contributes zero delay and creates no flag or number.
      flags: [],
      recommendations: [],
      alerts: [],
      noUnapprovedSend: true,
    },
  },
  {
    name: "multi-signal additive supplier delay",
    initialInventory: {
      suppliers: [compoundSupplier],
      skus: [compoundSku],
      shipments: [],
    },
    timeline: [{ at: horizonBase, signals: compoundSignals }],
    horizonBase,
    expected: {
      // LT'=10+storm(7)+flood(5)=22; SS=ceil(1.645*3*sqrt(22))=ceil(23.147)=24;
      // ROP=ceil(10*22+23.147)=244; IP=100; EOQ=383; max(383,144) -> MOQ 10 => 390.
      flags: compoundSignals.map(() => ({
        skuId: compoundSku.id,
        exposureType: "supplier_region",
      })),
      recommendations: [
        { skuId: compoundSku.id, ss: 24, rop: 244, recommendedQty: 390 },
      ],
      alerts: criticalAlerts(2),
      noUnapprovedSend: true,
    },
  },
  {
    name: "multi-signal delay cap at sixty days",
    initialInventory: {
      suppliers: [capSupplier],
      skus: [capSku],
      shipments: [],
    },
    timeline: [{ at: horizonBase, signals: capSignals }],
    horizonBase,
    expected: {
      // Ten high storms total 10*7=70, capped at 60: LT'=10+60=70.
      // SS=ceil(1.645*3*sqrt(70))=ceil(41.289)=42; ROP=ceil(10*70+41.289)=742;
      // IP=0; EOQ=383; max(383,742)=742 -> MOQ 10 => 750.
      flags: capSignals.map(() => ({
        skuId: capSku.id,
        exposureType: "supplier_region",
      })),
      recommendations: [
        { skuId: capSku.id, ss: 42, rop: 742, recommendedQty: 750 },
      ],
      alerts: criticalAlerts(10),
      noUnapprovedSend: true,
    },
  },
  {
    name: "insufficient holding-cost data is not actionable",
    initialInventory: {
      suppliers: [insufficientSupplier],
      skus: [insufficientSku],
      shipments: [],
    },
    timeline: [{ at: horizonBase, signals: [insufficientSignal] }],
    horizonBase,
    expected: {
      // LT'=10+7=17, but H=0 fails closed before SS/ROP/EOQ are computed;
      // fixture literals are the insufficient-data representation: SS=0, ROP=0, recommendedQty=0.
      flags: [{ skuId: insufficientSku.id, exposureType: "supplier_region" }],
      recommendations: [
        {
          skuId: insufficientSku.id,
          ss: 0,
          rop: 0,
          recommendedQty: 0,
          isInsufficientData: true,
        },
      ],
      alerts: [],
      noUnapprovedSend: true,
    },
  },
];

// Resolution needs persisted flags plus lifecycle ownership across ticks. The pure 13a runner deliberately has
// neither, so "signal resolves -> flag clears" is deferred to the live-DB replay coverage in Step 13c.
export const deferredTo13c = ["signal resolves -> flag clears"] as const;
