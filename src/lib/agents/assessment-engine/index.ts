import type { SupabaseClient } from "@supabase/supabase-js";

import { assess } from "@/lib/agents/assessment-engine/assess";
import { correlate } from "@/lib/agents/assessment-engine/correlate";
import type { Database } from "@/lib/db/database.types";
import { upsertAlerts } from "@/lib/db/repositories/alerts.repo";
import { upsertReorderRecommendations } from "@/lib/db/repositories/reorder-recommendations.repo";
import { upsertRiskFlags } from "@/lib/db/repositories/risk-flags.repo";
import type { RunContext } from "@/lib/runtime/run-context";

export const runAssessment = async (
  ctx: RunContext,
  deps: { client: SupabaseClient<Database> },
) => {
  try {
    const [signals, suppliers, skus, shipments] = await Promise.all([
      deps.client.from("signals").select().eq("status", "active"),
      deps.client.from("suppliers").select(),
      deps.client.from("skus").select(),
      deps.client.from("shipments").select(),
    ]);
    if (signals.error || suppliers.error || skus.error || shipments.error)
      throw new Error("Assessment database load failed.");
    const correlation = correlate({
      signals: signals.data as never,
      suppliers: suppliers.data as never,
      skus: skus.data as never,
      shipments: shipments.data as never,
    });
    const result = assess({
      correlation,
      horizonBase: ctx.clock.now().toISOString(),
    });
    const createdAt = ctx.clock.now().toISOString();
    await upsertRiskFlags(
      deps.client,
      result.flags.map((flag) => ({
        id: flag.id,
        signal_id: flag.signal.id,
        ...(flag.shipmentId === undefined
          ? {}
          : { shipment_id: flag.shipmentId }),
        sku_id: flag.skuId,
        exposure_type: flag.exposureType,
        computed_lead_time_delta: flag.computedLeadTimeDelta,
        severity: flag.signal.severity,
        status: "open",
        created_at: createdAt,
        tick_id: ctx.tickId,
      })),
    );
    await upsertReorderRecommendations(
      deps.client,
      result.recommendations.map((recommendation) => ({
        sku_id: recommendation.skuId,
        risk_flag_id: recommendation.riskFlagId,
        ss: recommendation.ss,
        rop: recommendation.rop,
        inventory_position: recommendation.inventoryPosition,
        recommended_qty: recommendation.recommendedQty,
        formula_branch: recommendation.formulaBranch,
        rationale_template: recommendation.rationaleTemplate,
        is_insufficient_data: recommendation.isInsufficientData,
        inputs_hash: recommendation.inputsHash,
        created_at: createdAt,
      })),
    );
    await upsertAlerts(
      deps.client,
      result.alerts.map((alert) => ({
        risk_flag_id: alert.flagId,
        level: alert.level,
        message_template: `Assessment ${alert.level} alert`,
        created_at: createdAt,
        delivered_via: "dashboard",
      })),
    );
    await Promise.all(
      correlation.shipmentExposures.map((exposure) =>
        deps.client
          .from("shipments")
          .update({ status: "delayed", eta: exposure.newEta })
          .eq("id", exposure.shipment.id),
      ),
    );
    return {
      ok: true,
      counts: {
        flags: result.flags.length,
        recommendations: result.recommendations.length,
        alerts: result.alerts.length,
      },
      result,
    };
  } catch (error: unknown) {
    return {
      ok: false,
      failure: error instanceof Error ? error.message : "Assessment failed.",
    };
  }
};
