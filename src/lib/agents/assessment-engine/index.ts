import type { SupabaseClient } from "@supabase/supabase-js";

import {
  createNarrationLlmClient,
  type LlmCompletionClient,
} from "@/lib/adapters/llm/client";
import { assess } from "@/lib/agents/assessment-engine/assess";
import { correlate } from "@/lib/agents/assessment-engine/correlate";
import { narrateAssessment } from "@/lib/agents/assessment-engine/narrate";
import { env } from "@/lib/config/env";
import type { Database } from "@/lib/db/database.types";
import { toAssessmentInput } from "@/lib/db/mappers/assessment-input.mapper";
import { upsertAlerts } from "@/lib/db/repositories/alerts.repo";
import { upsertReorderRecommendations } from "@/lib/db/repositories/reorder-recommendations.repo";
import { upsertRiskFlags } from "@/lib/db/repositories/risk-flags.repo";
import type { RunContext } from "@/lib/runtime/run-context";

export const runAssessment = async (
  ctx: RunContext,
  deps: {
    client: SupabaseClient<Database, "public" | "eval">;
    llmClient?: LlmCompletionClient | undefined;
    enableNarration?: boolean | undefined;
    maxNarration?: number | undefined;
  },
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
    const correlation = correlate(
      toAssessmentInput({
        signals: signals.data,
        suppliers: suppliers.data,
        skus: skus.data,
        shipments: shipments.data,
      }),
    );
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
        message_template:
          alert.level === "critical"
            ? "Critical shortfall — IP well below adjusted ROP"
            : alert.level === "warning"
              ? "Warning — IP below adjusted ROP"
              : "Info — IP crossed reorder threshold",
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
    const narration = result.recommendations.map(() => null as string | null);
    const enableNarration = deps.enableNarration ?? env.ENABLE_LLM_NARRATION;
    const maxNarration = deps.maxNarration ?? env.MAX_NARRATION_PER_TICK;
    if (enableNarration) {
      const llmClient = deps.llmClient ?? createNarrationLlmClient();
      await Promise.all(
        result.recommendations
          .slice(0, maxNarration)
          .map(async (recommendation, index) => {
            const flag = result.flags.find(
              (candidate) => candidate.id === recommendation.riskFlagId,
            );
            narration[index] = await narrateAssessment(
              {
                flags: flag === undefined ? [] : [flag],
                recommendations: [recommendation],
                alerts: result.alerts.filter(
                  (alert) => alert.flagId === recommendation.riskFlagId,
                ),
              },
              { client: llmClient },
            );
          }),
      );
    }

    return {
      ok: true,
      counts: {
        flags: result.flags.length,
        recommendations: result.recommendations.length,
        alerts: result.alerts.length,
      },
      result: { ...result, narration },
    };
  } catch (error: unknown) {
    return {
      ok: false,
      failure: error instanceof Error ? error.message : "Assessment failed.",
    };
  }
};
