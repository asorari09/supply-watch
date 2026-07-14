import type { Database } from "@/lib/db/database.types";
import {
  shipmentSchema,
  signalSchema,
  skuSchema,
  supplierSchema,
} from "@/lib/domain";

type Tables = Database["public"]["Tables"];

export const toAssessmentInput = (input: {
  signals: Tables["signals"]["Row"][];
  suppliers: Tables["suppliers"]["Row"][];
  skus: Tables["skus"]["Row"][];
  shipments: Tables["shipments"]["Row"][];
}) => ({
  signals: input.signals.map((signal) =>
    signalSchema.parse({
      id: signal.id,
      source: signal.source,
      disruptionType: signal.disruption_type,
      affectedRegions: signal.affected_regions,
      geo: signal.geo,
      severity: signal.severity,
      delayDaysEstimate: signal.delay_days_estimate,
      confidence: signal.confidence,
      detectedAt: signal.detected_at,
      ...(signal.expires_at === null ? {} : { expiresAt: signal.expires_at }),
      rawRef: signal.raw_ref,
      dedupeHash: signal.dedupe_hash,
      status: signal.status,
    }),
  ),
  suppliers: input.suppliers.map((supplier) =>
    supplierSchema.parse({
      id: supplier.id,
      name: supplier.name,
      regionCode: supplier.region_code,
      geo: supplier.geo,
      leadTimeDaysBase: supplier.lead_time_days_base,
      ...(supplier.lead_time_std_days === null
        ? {}
        : { leadTimeStdDays: supplier.lead_time_std_days }),
      reliability: supplier.reliability,
    }),
  ),
  skus: input.skus.map((sku) =>
    skuSchema.parse({
      id: sku.id,
      sku: sku.sku,
      supplierId: sku.supplier_id,
      onHand: sku.on_hand,
      onOrder: sku.on_order,
      backorders: sku.backorders,
      avgDailyDemand: sku.avg_daily_demand,
      demandStd: sku.demand_std,
      unitCost: sku.unit_cost,
      holdingCost: sku.holding_cost,
      orderCost: sku.order_cost,
      moq: sku.moq,
      serviceLevelZ: sku.service_level_z,
    }),
  ),
  shipments: input.shipments.map((shipment) =>
    shipmentSchema.parse({
      id: shipment.id,
      skuId: shipment.sku_id,
      supplierId: shipment.supplier_id,
      originGeo: shipment.origin_geo,
      destGeo: shipment.dest_geo,
      routeRegions: shipment.route_regions,
      eta: shipment.eta,
      qty: shipment.qty,
      status: shipment.status,
    }),
  ),
});
