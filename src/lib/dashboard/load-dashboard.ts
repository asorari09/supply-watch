import "server-only";

import {
  detectDataViewMode,
  type DataViewMode,
} from "@/lib/dashboard/demo-mode";
import {
  buildActiveSeverityByRegion,
  buildKpis,
  buildNetworkModel,
  buildSeverityBreakdown,
  type DashboardKpis,
  type DashboardNetwork,
  type DashboardSeverityBreakdown,
} from "@/lib/dashboard/map-model";
import {
  parseStoredEvidence,
  parseStoredGeo,
  type DashboardSignalEvidence,
} from "@/lib/dashboard/signal-evidence";
import { createSupabaseAdminClient } from "@/lib/db/admin-client";
import type { Geo } from "@/lib/domain";

export interface DashboardSignal {
  id: string;
  source: "weather" | "news";
  regions: string[];
  severity: "low" | "med" | "high" | "unknown";
  status: "active" | "stale" | "degraded" | "resolved";
  detectedAt: string;
  disruptionType: string;
  rawRef: string;
  geo: Geo | null;
  evidence: DashboardSignalEvidence | null;
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
  supplierRegion: string | null;
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
  kpis: DashboardKpis;
  network: DashboardNetwork;
  severityBreakdown: DashboardSeverityBreakdown;
  /** Derived from synthetic markers in the DB, not a click-local flag. */
  dataViewMode: DataViewMode;
}

const emptyNetwork = (): DashboardNetwork => ({
  regions: [],
  routes: [],
  destination: null,
  healthyRegionCount: 0,
  totalRegionCount: 0,
  networkHealthPercent: 100,
  disruptedRouteCount: 0,
});

const emptyDashboardData = (): DashboardData => ({
  signals: [],
  risks: [],
  drafts: [],
  alerts: [],
  ticks: [],
  kpis: {
    skusAtRisk: 0,
    needsReorder: 0,
    awaitingApproval: 0,
    readyToSend: 0,
    activeDisruptions: 0,
  },
  network: emptyNetwork(),
  severityBreakdown: { high: 0, med: 0, low: 0, unknown: 0 },
  dataViewMode: "live",
});

export const loadDashboard = async (): Promise<DashboardData> => {
  try {
    const client = createSupabaseAdminClient();
    const [
      ongoingSignals,
      degradedSignals,
      resolvedSignals,
      flags,
      recommendations,
      drafts,
      alerts,
      ticks,
      skus,
      suppliers,
      shipments,
    ] = await Promise.all([
      // Ongoing first so live active rows are never crowded out by resolved demos.
      client
        .from("signals")
        .select()
        .in("status", ["active", "stale"])
        .order("detected_at", { ascending: false }),
      client
        .from("signals")
        .select()
        .eq("status", "degraded")
        .order("detected_at", { ascending: false })
        .limit(20),
      client
        .from("signals")
        .select()
        .eq("status", "resolved")
        .order("detected_at", { ascending: false })
        .limit(12),
      client
        .from("risk_flags")
        .select()
        .eq("status", "open")
        .order("created_at", { ascending: false }),
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
      client.from("shipments").select(),
    ]);
    const responses = [
      ongoingSignals,
      degradedSignals,
      resolvedSignals,
      flags,
      recommendations,
      drafts,
      alerts,
      ticks,
      skus,
      suppliers,
      shipments,
    ];
    if (responses.some((response) => response.error !== null))
      return emptyDashboardData();

    const ongoingSignalRows = ongoingSignals.data ?? [];
    const activeSignalRows = ongoingSignalRows.filter(
      (signal) => signal.status === "active",
    );
    const feedSignalRows = [
      ...ongoingSignalRows,
      ...(degradedSignals.data ?? []),
      ...(resolvedSignals.data ?? []),
    ];
    const flagRows = flags.data ?? [];
    const recommendationRows = recommendations.data ?? [];
    const draftRows = drafts.data ?? [];
    const alertRows = alerts.data ?? [];
    const tickRows = ticks.data ?? [];
    const skuRows = skus.data ?? [];
    const supplierRows = suppliers.data ?? [];
    const shipmentRows = shipments.data ?? [];

    const signalById = new Map(
      feedSignalRows.map((signal) => [signal.id, signal]),
    );
    const dataViewMode = detectDataViewMode({
      activeSignals: activeSignalRows.map((signal) => ({
        dedupeHash: signal.dedupe_hash,
      })),
      openFlags: flagRows.map((flag) => ({ signalId: flag.signal_id })),
      signalById: new Map(
        [...signalById.entries()].map(([id, signal]) => [
          id,
          { dedupeHash: signal.dedupe_hash },
        ]),
      ),
    });
    const skuById = new Map(skuRows.map((sku) => [sku.id, sku]));
    const supplierById = new Map(
      supplierRows.map((supplier) => [supplier.id, supplier]),
    );
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

    const risks: DashboardRisk[] = [...flagsBySkuId.entries()].map(
      ([skuId, skuFlags]) => {
        const directRecommendation = skuFlags
          .map((flag) => recommendationByFlagId.get(flag.id))
          .find((recommendation) => recommendation !== undefined);
        const recommendation =
          directRecommendation ?? recommendationBySkuId.get(skuId);
        const sku = skuById.get(skuId);
        const supplier =
          sku === undefined ? undefined : supplierById.get(sku.supplier_id);
        const severityRankMap = {
          unknown: 0,
          low: 1,
          med: 2,
          high: 3,
        } as const;
        const severity = skuFlags.reduce(
          (highest, flag) =>
            severityRankMap[flag.severity] > severityRankMap[highest]
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
          supplierRegion: supplier?.region_code ?? null,
        };
      },
    );

    const draftsMapped = draftRows.map((draft) => {
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
    });

    const activeSeverityByRegion = buildActiveSeverityByRegion(
      activeSignalRows.map((signal) => ({
        affectedRegions: signal.affected_regions,
        severity: signal.severity,
      })),
    );
    const network = buildNetworkModel({
      suppliers: supplierRows.map((supplier) => ({
        id: supplier.id,
        regionCode: supplier.region_code,
        geo: supplier.geo,
      })),
      shipments: shipmentRows.map((shipment) => ({
        id: shipment.id,
        supplierId: shipment.supplier_id,
        originGeo: shipment.origin_geo,
        destGeo: shipment.dest_geo,
        routeRegions: shipment.route_regions,
      })),
      activeSeverityByRegion,
    });

    return {
      signals: feedSignalRows.map((signal) => ({
        id: signal.id,
        source: signal.source,
        regions: signal.affected_regions,
        severity: signal.severity,
        status: signal.status,
        detectedAt: signal.detected_at,
        disruptionType: signal.disruption_type,
        rawRef: signal.raw_ref,
        geo: parseStoredGeo(signal.geo),
        evidence: parseStoredEvidence(signal.source, signal.evidence),
      })),
      risks,
      drafts: draftsMapped,
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
      kpis: buildKpis({
        risks,
        drafts: draftsMapped,
        activeDisruptionCount: activeSignalRows.length,
      }),
      network,
      severityBreakdown: buildSeverityBreakdown(risks),
      dataViewMode,
    };
  } catch {
    return emptyDashboardData();
  }
};
