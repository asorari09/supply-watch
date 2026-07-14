import "server-only";

import { createSupabaseAdminClient } from "@/lib/db/admin-client";

export interface DashboardSignal {
  id: string;
  source: "weather" | "news";
  regions: string[];
  severity: "low" | "med" | "high" | "unknown";
  status: "active" | "stale" | "degraded" | "resolved";
  detectedAt: string;
}

export interface DashboardRisk {
  id: string;
  skuId: string;
  sku: string;
  severity: "low" | "med" | "high" | "unknown";
  exposureTypes: Array<"supplier_region" | "shipment_route">;
  disruptionTypes: string[];
  leadTimeBase: number | null;
  leadTimeDelta: number;
  onHand: number | null;
  ss: number | null;
  rop: number | null;
  inventoryPosition: number | null;
  recommendedQty: number | null;
}

export interface DashboardDraft {
  id: string;
  subject: string;
  body: string;
  tone: string;
  status: "pending_approval" | "approved" | "rejected" | "sent";
  sku: string;
  ss: number | null;
  rop: number | null;
  inventoryPosition: number | null;
  recommendedQty: number | null;
}

export interface DashboardAlert {
  id: string;
  level: "info" | "warning" | "critical";
  message: string;
  createdAt: string;
  sku: string | null;
}

export interface DashboardTick {
  id: string;
  triggerSource: "cron" | "manual" | "inject" | "replay";
  mode: "live" | "replay";
  counts: string;
  durationMs: number;
  estimatedCostUsd: number;
  clockNow: string;
}

export interface DashboardData {
  signals: DashboardSignal[];
  risks: DashboardRisk[];
  drafts: DashboardDraft[];
  alerts: DashboardAlert[];
  ticks: DashboardTick[];
}

const emptyDashboardData = (): DashboardData => ({
  signals: [],
  risks: [],
  drafts: [],
  alerts: [],
  ticks: [],
});

export const loadDashboard = async (): Promise<DashboardData> => {
  try {
    const client = createSupabaseAdminClient();
    const [
      signals,
      flags,
      recommendations,
      drafts,
      alerts,
      ticks,
      skus,
      suppliers,
    ] = await Promise.all([
      client
        .from("signals")
        .select()
        .order("detected_at", { ascending: false })
        .limit(12),
      client
        .from("risk_flags")
        .select()
        .eq("status", "open")
        .order("created_at", { ascending: false })
        .limit(12),
      client
        .from("reorder_recommendations")
        .select()
        .order("created_at", { ascending: false })
        .limit(40),
      client
        .from("comms_drafts")
        .select()
        .in("status", ["pending_approval", "approved", "rejected", "sent"])
        .order("created_at", { ascending: false })
        .limit(8),
      client
        .from("alerts")
        .select()
        .order("created_at", { ascending: false })
        .limit(10),
      client
        .from("tick_logs")
        .select()
        .order("clock_now", { ascending: false })
        .limit(8),
      client.from("skus").select(),
      client.from("suppliers").select(),
    ]);
    const responses = [
      signals,
      flags,
      recommendations,
      drafts,
      alerts,
      ticks,
      skus,
      suppliers,
    ];
    if (responses.some((response) => response.error !== null))
      return emptyDashboardData();

    const signalRows = signals.data ?? [];
    const flagRows = flags.data ?? [];
    const recommendationRows = recommendations.data ?? [];
    const draftRows = drafts.data ?? [];
    const alertRows = alerts.data ?? [];
    const tickRows = ticks.data ?? [];
    const skuRows = skus.data ?? [];
    const supplierRows = suppliers.data ?? [];

    const signalById = new Map(signalRows.map((signal) => [signal.id, signal]));
    const skuById = new Map(skuRows.map((sku) => [sku.id, sku]));
    const supplierById = new Map(
      supplierRows.map((supplier) => [supplier.id, supplier]),
    );
    // Rows are newest-first; keep the first write so lookups resolve to the latest.
    const recommendationByFlagId = new Map<
      string,
      (typeof recommendationRows)[number]
    >();
    const recommendationById = new Map<
      string,
      (typeof recommendationRows)[number]
    >();
    const recommendationBySkuId = new Map<
      string,
      (typeof recommendationRows)[number]
    >();
    for (const recommendation of recommendationRows) {
      if (!recommendationByFlagId.has(recommendation.risk_flag_id))
        recommendationByFlagId.set(recommendation.risk_flag_id, recommendation);
      if (!recommendationById.has(recommendation.id))
        recommendationById.set(recommendation.id, recommendation);
      if (!recommendationBySkuId.has(recommendation.sku_id))
        recommendationBySkuId.set(recommendation.sku_id, recommendation);
    }

    const draftFlagIds = [
      ...new Set(draftRows.map((draft) => draft.risk_flag_id)),
    ];
    const alertFlagIds = [
      ...new Set(alertRows.map((alert) => alert.risk_flag_id)),
    ];
    const linkedFlagIds = [
      ...new Set([...draftFlagIds, ...alertFlagIds]),
    ].filter((flagId) => !flagRows.some((flag) => flag.id === flagId));

    let linkedFlagRows: typeof flagRows = [];
    if (linkedFlagIds.length > 0) {
      const linkedFlags = await client
        .from("risk_flags")
        .select()
        .in("id", linkedFlagIds);
      if (linkedFlags.error !== null) return emptyDashboardData();
      linkedFlagRows = linkedFlags.data ?? [];
    }

    const flagById = new Map(
      [...flagRows, ...linkedFlagRows].map((flag) => [flag.id, flag]),
    );
    const flagsBySkuId = new Map<string, (typeof flagRows)[number][]>();
    for (const flag of flagRows) {
      const grouped = flagsBySkuId.get(flag.sku_id) ?? [];
      grouped.push(flag);
      flagsBySkuId.set(flag.sku_id, grouped);
    }

    const draftIds = draftRows.map((draft) => draft.id);
    const editedBodyByDraftId = new Map<string, string>();
    if (draftIds.length > 0) {
      const approvals = await client
        .from("approval_records")
        .select("draft_id, decision, edited_body, decided_at")
        .in("draft_id", draftIds)
        .eq("decision", "approved")
        .order("decided_at", { ascending: false });
      if (approvals.error !== null) return emptyDashboardData();
      for (const record of approvals.data ?? []) {
        if (
          record.edited_body === null ||
          editedBodyByDraftId.has(record.draft_id)
        )
          continue;
        editedBodyByDraftId.set(record.draft_id, record.edited_body);
      }
    }

    return {
      signals: signalRows.map((signal) => ({
        id: signal.id,
        source: signal.source,
        regions: signal.affected_regions,
        severity: signal.severity,
        status: signal.status,
        detectedAt: signal.detected_at,
      })),
      risks: [...flagsBySkuId.entries()].map(([skuId, skuFlags]) => {
        const directRecommendation = skuFlags
          .map((flag) => recommendationByFlagId.get(flag.id))
          .find((recommendation) => recommendation !== undefined);
        const recommendation =
          directRecommendation ?? recommendationBySkuId.get(skuId);
        const sku = skuById.get(skuId);
        const supplier =
          sku === undefined ? undefined : supplierById.get(sku.supplier_id);
        const severityRank = { unknown: 0, low: 1, med: 2, high: 3 } as const;
        const severity = skuFlags.reduce(
          (highest, flag) =>
            severityRank[flag.severity] > severityRank[highest]
              ? flag.severity
              : highest,
          skuFlags[0]?.severity ?? "unknown",
        );
        return {
          id: skuId,
          skuId,
          sku: sku?.sku ?? skuId,
          severity,
          exposureTypes: [
            ...new Set(skuFlags.map((flag) => flag.exposure_type)),
          ],
          disruptionTypes: [
            ...new Set(
              skuFlags.map(
                (flag) =>
                  signalById.get(flag.signal_id)?.disruption_type ??
                  "disruption",
              ),
            ),
          ],
          leadTimeBase: supplier?.lead_time_days_base ?? null,
          leadTimeDelta: Math.max(
            ...skuFlags.map((flag) => flag.computed_lead_time_delta),
          ),
          onHand: sku?.on_hand ?? null,
          ss: recommendation?.ss ?? null,
          rop: recommendation?.rop ?? null,
          inventoryPosition: recommendation?.inventory_position ?? null,
          recommendedQty: recommendation?.recommended_qty ?? null,
        };
      }),
      drafts: draftRows.map((draft) => {
        const recommendation = recommendationById.get(draft.recommendation_id);
        const flag = flagById.get(draft.risk_flag_id);
        const sku = flag === undefined ? undefined : skuById.get(flag.sku_id);
        return {
          id: draft.id,
          subject: draft.subject,
          body: editedBodyByDraftId.get(draft.id) ?? draft.body,
          tone: draft.tone,
          status: draft.status,
          sku: sku?.sku ?? "Linked SKU unavailable",
          ss: recommendation?.ss ?? null,
          rop: recommendation?.rop ?? null,
          inventoryPosition: recommendation?.inventory_position ?? null,
          recommendedQty: recommendation?.recommended_qty ?? null,
        };
      }),
      alerts: alertRows.map((alert) => {
        const flag = flagById.get(alert.risk_flag_id);
        return {
          id: alert.id,
          level: alert.level,
          message: alert.message_template,
          createdAt: alert.created_at,
          sku:
            flag === undefined
              ? null
              : (skuById.get(flag.sku_id)?.sku ?? flag.sku_id),
        };
      }),
      ticks: tickRows.map((tick) => ({
        id: tick.id,
        triggerSource: tick.trigger_source,
        mode: tick.mode,
        counts: JSON.stringify(tick.counts),
        durationMs: tick.duration_ms,
        estimatedCostUsd: tick.est_cost_usd,
        clockNow: tick.clock_now,
      })),
    };
  } catch {
    return emptyDashboardData();
  }
};
