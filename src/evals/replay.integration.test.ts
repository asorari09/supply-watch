import { afterEach, describe, expect, it } from "vitest";

import { scenarios } from "@/evals/scenarios";
import { runAssessment } from "@/lib/agents/assessment-engine";
import { createSupabaseAdminClient } from "@/lib/db/admin-client";
import { toSignalRow } from "@/lib/db/mappers/signal.mapper";
import { fixedClock } from "@/lib/runtime/clock";
import { createRunContext } from "@/lib/runtime/run-context";

const integrationEnvPresent = [
  "SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
].every((key) => (process.env[key] ?? "").trim().length > 0);
const integrationIt = integrationEnvPresent ? it : it.skip;
const scenario = scenarios.find(
  (candidate) =>
    candidate.name === "shipment-route flag excludes delayed on-order quantity",
);

if (scenario === undefined) {
  throw new Error("Shipment-route replay scenario is missing.");
}

const resetEvalSchema = async (): Promise<void> => {
  if (!integrationEnvPresent) return;

  const { error } = await createSupabaseAdminClient("eval").rpc("reset_all");
  if (error !== null) throw new Error(error.message);
};

const insertScenario = async (): Promise<void> => {
  const client = createSupabaseAdminClient("eval");
  const timelineSignals = scenario.timeline.flatMap((step) => step.signals);
  const inserts = [
    client.from("suppliers").insert(
      scenario.initialInventory.suppliers.map((supplier) => ({
        id: supplier.id,
        name: supplier.name,
        region_code: supplier.regionCode,
        geo: supplier.geo,
        lead_time_days_base: supplier.leadTimeDaysBase,
        ...(supplier.leadTimeStdDays === undefined
          ? {}
          : { lead_time_std_days: supplier.leadTimeStdDays }),
        reliability: supplier.reliability,
      })),
    ),
    client.from("skus").insert(
      scenario.initialInventory.skus.map((sku) => ({
        id: sku.id,
        sku: sku.sku,
        supplier_id: sku.supplierId,
        on_hand: sku.onHand,
        on_order: sku.onOrder,
        backorders: sku.backorders,
        avg_daily_demand: sku.avgDailyDemand,
        demand_std: sku.demandStd,
        unit_cost: sku.unitCost,
        holding_cost: sku.holdingCost,
        order_cost: sku.orderCost,
        moq: sku.moq,
        service_level_z: sku.serviceLevelZ,
      })),
    ),
    client.from("shipments").insert(
      scenario.initialInventory.shipments.map((shipment) => ({
        id: shipment.id,
        sku_id: shipment.skuId,
        supplier_id: shipment.supplierId,
        origin_geo: shipment.originGeo,
        dest_geo: shipment.destGeo,
        route_regions: shipment.routeRegions,
        eta: shipment.eta,
        qty: shipment.qty,
        status: shipment.status,
      })),
    ),
    client.from("signals").insert(timelineSignals.map(toSignalRow)),
  ];

  for (const insert of inserts) {
    const { error } = await insert;
    if (error !== null) throw new Error(error.message);
  }
};

const persistedCounts = async (): Promise<{
  flags: number;
  recommendations: number;
  alerts: number;
}> => {
  const client = createSupabaseAdminClient("eval");
  const [flags, recommendations, alerts] = await Promise.all([
    client.from("risk_flags").select("id", { count: "exact", head: true }),
    client
      .from("reorder_recommendations")
      .select("id", { count: "exact", head: true }),
    client.from("alerts").select("id", { count: "exact", head: true }),
  ]);
  for (const result of [flags, recommendations, alerts]) {
    if (result.error !== null) throw new Error(result.error.message);
  }
  return {
    flags: flags.count ?? 0,
    recommendations: recommendations.count ?? 0,
    alerts: alerts.count ?? 0,
  };
};

afterEach(resetEvalSchema);

describe("eval-schema live replay", () => {
  integrationIt(
    integrationEnvPresent
      ? "persists the shipment-route assessment and stays idempotent"
      : "skips because SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is missing",
    async () => {
      await resetEvalSchema();
      await insertScenario();
      const context = createRunContext({
        clock: fixedClock(scenario.horizonBase),
        mode: "replay",
        tickId: "40000000-0000-4000-8000-000000000102",
      });
      const client = createSupabaseAdminClient("eval");

      const first = await runAssessment(context, {
        client,
        enableNarration: false,
      });
      if (!first.ok) throw new Error(first.failure);
      expect(first.ok).toBe(true);

      const expected = scenario.expected;
      if (
        expected.flags === undefined ||
        expected.recommendations === undefined ||
        expected.alerts === undefined
      ) {
        throw new Error(
          "Shipment-route replay scenario has incomplete expected data.",
        );
      }
      const expectedFlag = expected.flags[0];
      const expectedRecommendation = expected.recommendations[0];
      const [
        { data: flags, error: flagsError },
        { data: recommendations, error: recommendationsError },
        { data: alerts, error: alertsError },
      ] = await Promise.all([
        client
          .from("risk_flags")
          .select(
            "signal_id, sku_id, shipment_id, exposure_type, computed_lead_time_delta",
          ),
        client
          .from("reorder_recommendations")
          .select(
            "sku_id, ss, rop, inventory_position, recommended_qty, is_insufficient_data",
          ),
        client.from("alerts").select("level"),
      ]);
      for (const error of [flagsError, recommendationsError, alertsError]) {
        if (error !== null) throw new Error(error.message);
      }

      expect(flags).toEqual([
        {
          signal_id: scenario.timeline[0]?.signals[0]?.id,
          sku_id: expectedFlag?.skuId,
          shipment_id: expectedFlag?.shipmentId,
          exposure_type: expectedFlag?.exposureType,
          computed_lead_time_delta: 7,
        },
      ]);
      expect(recommendations).toEqual([
        {
          sku_id: expectedRecommendation?.skuId,
          ss: expectedRecommendation?.ss,
          rop: expectedRecommendation?.rop,
          inventory_position: 0,
          recommended_qty: expectedRecommendation?.recommendedQty,
          is_insufficient_data: false,
        },
      ]);
      expect(alerts).toEqual(expected.alerts);
      expect(await persistedCounts()).toEqual({
        flags: expected.flags.length,
        recommendations: expected.recommendations.length,
        alerts: expected.alerts.length,
      });

      const second = await runAssessment(context, {
        client,
        enableNarration: false,
      });
      expect(second.ok).toBe(true);
      expect(await persistedCounts()).toEqual({
        flags: expected.flags.length,
        recommendations: expected.recommendations.length,
        alerts: expected.alerts.length,
      });
    },
  );
});
