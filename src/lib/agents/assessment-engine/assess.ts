import { createHash } from "node:crypto";

import type {
  CorrelationResult,
  SkuCorrelation,
} from "@/lib/agents/assessment-engine/correlate";
import type { AlertLevel, Signal } from "@/lib/domain";
import { computeReorder } from "@/lib/inventory";
import type { ReorderResult } from "@/lib/inventory";

export interface AssessmentRecommendation {
  skuId: string;
  riskFlagId: string;
  ss: number;
  rop: number;
  inventoryPosition: number;
  recommendedQty: number;
  formulaBranch: string;
  rationaleTemplate: string;
  isInsufficientData: boolean;
  inputsHash: string;
}
export interface AssessmentFlag {
  id: string;
  signal: Signal;
  skuId: string;
  shipmentId?: string;
  exposureType: "supplier_region" | "shipment_route";
  computedLeadTimeDelta: number;
}
export interface AssessmentAlert {
  flagId: string;
  level: AlertLevel;
}
export interface AssessmentResult {
  flags: AssessmentFlag[];
  recommendations: AssessmentRecommendation[];
  alerts: AssessmentAlert[];
  pendingDraftRefs: Array<{
    flag: AssessmentFlag;
    recommendation: AssessmentRecommendation;
  }>;
}

const hash = (value: string): string =>
  createHash("sha256").update(value).digest("hex");
const uuid = (value: string): string => {
  const valueHash = hash(value);
  return `${valueHash.slice(0, 8)}-${valueHash.slice(8, 12)}-4${valueHash.slice(13, 16)}-8${valueHash.slice(17, 20)}-${valueHash.slice(20, 32)}`;
};
const plusDays = (iso: string, days: number): number =>
  Date.parse(iso) + days * 86400000;
const flagId = (signalId: string, skuId: string, shipmentId?: string): string =>
  uuid(`${signalId}|${skuId}|${shipmentId ?? "supplier"}`);

export const alertLevel = (
  signal: Signal,
  recommendation: AssessmentRecommendation,
): AlertLevel =>
  signal.severity === "high" ||
  recommendation.rop - recommendation.inventoryPosition >=
    0.5 * recommendation.rop
    ? "critical"
    : recommendation.rop - recommendation.inventoryPosition >=
        0.25 * recommendation.rop
      ? "warning"
      : "info";

const inputsHash = (sku: SkuCorrelation, onOrderEffective: number): string =>
  hash(
    JSON.stringify([
      sku.sku.id,
      sku.sku.onHand,
      onOrderEffective,
      sku.sku.backorders,
      sku.sku.avgDailyDemand,
      sku.sku.demandStd,
      sku.leadTimePrime,
      sku.leadTimeStdDays ?? null,
      sku.sku.serviceLevelZ,
      sku.sku.moq,
      sku.sku.orderCost,
      sku.sku.holdingCost,
    ]),
  );
const effectiveOnOrder = (
  correlation: SkuCorrelation,
  horizonBase: string,
): number => {
  const horizonDays =
    correlation.supplierExposures.length > 0
      ? correlation.leadTimePrime
      : correlation.leadTimeBase;
  const horizon = plusDays(horizonBase, horizonDays);
  return correlation.shipmentExposures.reduce(
    (onOrder, exposure) =>
      plusDays(exposure.newEta, 0) > horizon
        ? onOrder - exposure.shipment.qty
        : onOrder,
    correlation.sku.onOrder,
  );
};

export const assess = (
  input: {
    correlation: CorrelationResult;
    horizonBase: string;
  },
  deps: {
    computeReorder?: (
      input: Parameters<typeof computeReorder>[0],
    ) => ReorderResult;
  } = {},
): AssessmentResult => {
  const reorder = deps.computeReorder ?? computeReorder;
  const flags: AssessmentFlag[] = [];
  const recommendations: AssessmentRecommendation[] = [];
  const alerts: AssessmentAlert[] = [];
  const pendingDraftRefs: AssessmentResult["pendingDraftRefs"] = [];
  for (const correlation of input.correlation.skus) {
    const onOrderEffective = effectiveOnOrder(correlation, input.horizonBase);
    const contribution: Array<{
      signal: Signal;
      delayDays: number;
      exposureType: "supplier_region" | "shipment_route";
      shipmentId?: string;
    }> = [
      ...correlation.supplierExposures.map((exposure) => ({
        signal: exposure.signal,
        delayDays: exposure.delayDays,
        exposureType: "supplier_region" as const,
      })),
      ...correlation.shipmentExposures.map((exposure) => ({
        signal: exposure.signal,
        delayDays: exposure.delayDays,
        exposureType: "shipment_route" as const,
        shipmentId: exposure.shipment.id,
      })),
    ];
    const localFlags = contribution.map((entry) => ({
      id: flagId(entry.signal.id, correlation.sku.id, entry.shipmentId),
      signal: entry.signal,
      skuId: correlation.sku.id,
      ...(entry.shipmentId === undefined
        ? {}
        : { shipmentId: entry.shipmentId }),
      exposureType: entry.exposureType,
      computedLeadTimeDelta: entry.delayDays,
    }));
    flags.push(...localFlags);
    const result = reorder({
      d: correlation.sku.avgDailyDemand,
      sigmaD: correlation.sku.demandStd,
      ltPrime: correlation.leadTimePrime,
      ...(correlation.leadTimeStdDays === undefined
        ? {}
        : { sigmaLT: correlation.leadTimeStdDays }),
      z: correlation.sku.serviceLevelZ,
      orderCost: correlation.sku.orderCost,
      holdingCost: correlation.sku.holdingCost,
      moq: correlation.sku.moq,
      onHand: correlation.sku.onHand,
      onOrder: onOrderEffective,
      backorders: correlation.sku.backorders,
    });
    const firstFlag = localFlags[0];
    if (firstFlag === undefined) continue;
    const recommendation: AssessmentRecommendation = result.isInsufficientData
      ? {
          skuId: correlation.sku.id,
          riskFlagId: firstFlag.id,
          ss: 0,
          rop: 0,
          inventoryPosition: 0,
          recommendedQty: 0,
          formulaBranch: "insufficient_data",
          rationaleTemplate: result.reason,
          isInsufficientData: true,
          inputsHash: inputsHash(correlation, onOrderEffective),
        }
      : {
          skuId: correlation.sku.id,
          riskFlagId: firstFlag.id,
          ss: result.ss,
          rop: result.rop,
          inventoryPosition: result.inventoryPosition,
          recommendedQty: result.recommendedQty,
          formulaBranch: result.formulaBranch,
          rationaleTemplate: result.rationaleTemplate,
          isInsufficientData: false,
          inputsHash: inputsHash(correlation, onOrderEffective),
        };
    recommendations.push(recommendation);
    if (
      !recommendation.isInsufficientData &&
      recommendation.inventoryPosition < recommendation.rop
    )
      for (const flag of localFlags) {
        const level = alertLevel(flag.signal, recommendation);
        alerts.push({ flagId: flag.id, level });
        pendingDraftRefs.push({ flag, recommendation });
      }
  }
  return { flags, recommendations, alerts, pendingDraftRefs };
};
