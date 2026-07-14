import { randomUUID } from "node:crypto";

import type { SupabaseClient } from "@supabase/supabase-js";

import { runAssessment } from "@/lib/agents/assessment-engine";
import { createSupabaseAdminClient } from "@/lib/db/admin-client";
import type { Database } from "@/lib/db/database.types";
import { toSignalRow } from "@/lib/db/mappers/signal.mapper";
import { signalSchema } from "@/lib/domain";
import { createRunContext } from "@/lib/runtime/run-context";

type SupplierRow = Database["public"]["Tables"]["suppliers"]["Row"];
type ShipmentRow = Database["public"]["Tables"]["shipments"]["Row"];
type SkuRow = Database["public"]["Tables"]["skus"]["Row"];

export interface DemoInjectionSummary {
  signals: number;
  flags: number;
  recommendations: number;
  alerts: number;
  pendingDrafts: number;
}

const requireData = <T>(data: T[] | null, label: string): T[] => {
  if (data === null || data.length === 0)
    throw new Error(
      `${label} are missing. Run pnpm db:seed before injecting a demo.`,
    );
  return data;
};

const requireSuccess = (error: { message: string } | null): void => {
  if (error !== null) throw new Error(error.message);
};

const inventoryPosition = (sku: SkuRow): number =>
  sku.on_hand + sku.on_order - sku.backorders;

const selectDemoSuppliers = (
  suppliers: SupplierRow[],
  shipments: ShipmentRow[],
  skus: SkuRow[],
) => {
  const supplierById = new Map(
    suppliers.map((supplier) => [supplier.id, supplier]),
  );
  const routeShipment = shipments.find((shipment) => {
    const supplier = supplierById.get(shipment.supplier_id);
    return (
      supplier !== undefined &&
      shipment.route_regions.includes(supplier.region_code)
    );
  });
  if (routeShipment === undefined)
    throw new Error("No seeded shipment route overlaps its supplier region.");
  const routeSupplier = supplierById.get(routeShipment.supplier_id);
  if (routeSupplier === undefined)
    throw new Error("Route shipment supplier is missing.");

  const supplierRisk = new Map<string, number>();
  for (const sku of skus) {
    supplierRisk.set(
      sku.supplier_id,
      Math.min(
        supplierRisk.get(sku.supplier_id) ?? Infinity,
        inventoryPosition(sku),
      ),
    );
  }
  const additionalSuppliers = suppliers
    .filter((supplier) => supplier.id !== routeSupplier.id)
    .sort(
      (left, right) =>
        (supplierRisk.get(left.id) ?? Infinity) -
        (supplierRisk.get(right.id) ?? Infinity),
    )
    .slice(0, 2);
  if (additionalSuppliers.length < 2)
    throw new Error(
      "At least three seeded suppliers are required for demo signals.",
    );
  return { routeSupplier, additionalSuppliers };
};

const clearPriorSyntheticScenario = async (
  client: SupabaseClient<Database>,
): Promise<void> => {
  const [currentSignals, legacySignals] = await Promise.all([
    client.from("signals").select("id").like("dedupe_hash", "synthetic-demo:%"),
    client.from("signals").select("id").like("dedupe_hash", "demo-seed-%"),
  ]);
  requireSuccess(currentSignals.error);
  requireSuccess(legacySignals.error);
  const signalIds = [
    ...new Set([
      ...(currentSignals.data ?? []).map((signal) => signal.id),
      ...(legacySignals.data ?? []).map((signal) => signal.id),
    ]),
  ];
  if (signalIds.length === 0) return;

  const { data: flags, error: flagsError } = await client
    .from("risk_flags")
    .select("id")
    .in("signal_id", signalIds);
  requireSuccess(flagsError);
  const flagIds = (flags ?? []).map((flag) => flag.id);
  if (flagIds.length > 0) {
    const { data: drafts, error: draftsError } = await client
      .from("comms_drafts")
      .select("id")
      .in("risk_flag_id", flagIds);
    requireSuccess(draftsError);
    const draftIds = (drafts ?? []).map((draft) => draft.id);
    if (draftIds.length > 0) {
      const { error } = await client
        .from("approval_records")
        .delete()
        .in("draft_id", draftIds);
      requireSuccess(error);
    }
    const [draftDelete, alertDelete] = await Promise.all([
      client.from("comms_drafts").delete().in("risk_flag_id", flagIds),
      client.from("alerts").delete().in("risk_flag_id", flagIds),
    ]);
    requireSuccess(draftDelete.error);
    requireSuccess(alertDelete.error);
    const { error: recommendationDeleteError } = await client
      .from("reorder_recommendations")
      .delete()
      .in("risk_flag_id", flagIds);
    requireSuccess(recommendationDeleteError);
    const { error: resolveFlagsError } = await client
      .from("risk_flags")
      .update({ status: "resolved" })
      .in("id", flagIds)
      .neq("status", "resolved");
    requireSuccess(resolveFlagsError);
  }
  const { error: resolveSignalsError } = await client
    .from("signals")
    .update({ status: "resolved" })
    .in("id", signalIds);
  requireSuccess(resolveSignalsError);
};

export const injectSyntheticDisruption =
  async (): Promise<DemoInjectionSummary> => {
    const client = createSupabaseAdminClient();
    await clearPriorSyntheticScenario(client);
    const [suppliersResult, shipmentsResult, skusResult] = await Promise.all([
      client.from("suppliers").select(),
      client.from("shipments").select(),
      client.from("skus").select(),
    ]);
    requireSuccess(suppliersResult.error);
    requireSuccess(shipmentsResult.error);
    requireSuccess(skusResult.error);
    const suppliers = requireData(suppliersResult.data, "Seeded suppliers");
    const shipments = requireData(shipmentsResult.data, "Seeded shipments");
    const skus = requireData(skusResult.data, "Seeded SKUs");
    const { routeSupplier, additionalSuppliers } = selectDemoSuppliers(
      suppliers,
      shipments,
      skus,
    );
    const [portClosureSupplier, laborStrikeSupplier] = additionalSuppliers;
    if (portClosureSupplier === undefined || laborStrikeSupplier === undefined)
      throw new Error("Demo suppliers are unavailable.");

    const context = createRunContext({ mode: "replay", tickId: randomUUID() });
    const detectedAt = context.clock.now().toISOString();
    const injectionId = randomUUID();
    const signalInputs = [
      {
        id: randomUUID(),
        source: "weather" as const,
        disruptionType: "storm",
        region: routeSupplier.region_code,
        severity: "high" as const,
        label: "route-storm",
      },
      {
        id: randomUUID(),
        source: "news" as const,
        disruptionType: "port_closure",
        region: portClosureSupplier.region_code,
        severity: "high" as const,
        label: "supplier-port-closure",
      },
      {
        id: randomUUID(),
        source: "news" as const,
        disruptionType: "labor_strike",
        region: laborStrikeSupplier.region_code,
        severity: "med" as const,
        label: "supplier-labor-strike",
      },
    ];
    const signals = signalInputs.map((input) =>
      signalSchema.parse({
        id: input.id,
        source: input.source,
        disruptionType: input.disruptionType,
        affectedRegions: [input.region],
        geo: { kind: "regions", regionCodes: [input.region] },
        severity: input.severity,
        delayDaysEstimate: input.severity === "high" ? 7 : 3,
        confidence: "high",
        detectedAt,
        rawRef: `synthetic-demo:${injectionId}:${input.label}`,
        dedupeHash: `synthetic-demo:${injectionId}:${input.label}`,
        status: "active",
      }),
    );
    const { error: signalError } = await client
      .from("signals")
      .upsert(signals.map(toSignalRow), { onConflict: "dedupe_hash" });
    requireSuccess(signalError);

    const assessment = await runAssessment(context, {
      client,
      enableNarration: false,
    });
    if (
      !assessment.ok ||
      assessment.counts === undefined ||
      assessment.result === undefined
    )
      throw new Error(assessment.failure ?? "Synthetic assessment failed.");
    if (assessment.counts.flags === 0)
      throw new Error(
        "Synthetic assessment produced zero flags; demo cascade was not created.",
      );

    const pending =
      assessment.result.pendingDraftRefs.find((candidate) =>
        candidate.flag.signal.dedupeHash.startsWith("synthetic-demo:"),
      ) ?? assessment.result.pendingDraftRefs[0];
    let pendingDrafts = 0;
    if (pending !== undefined) {
      const { data: recommendation, error: recommendationError } = await client
        .from("reorder_recommendations")
        .select("id")
        .eq("risk_flag_id", pending.recommendation.riskFlagId)
        .eq("inputs_hash", pending.recommendation.inputsHash)
        .maybeSingle();
      requireSuccess(recommendationError);
      if (recommendation !== null) {
        const { error: draftError } = await client.from("comms_drafts").upsert(
          {
            id: randomUUID(),
            risk_flag_id: pending.flag.id,
            recommendation_id: recommendation.id,
            generation: 1,
            subject: `Synthetic demo: ${pending.flag.signal.disruptionType.replaceAll("_", " ")}`,
            body: `Synthetic demo disruption: a ${pending.flag.signal.disruptionType.replaceAll("_", " ")} affects this supply route. Please confirm the updated delivery plan and available mitigation options.`,
            tone: "direct and collaborative",
            model_used: "synthetic-demo-template",
            status: "pending_approval",
            tick_id: context.tickId,
            created_at: detectedAt,
          },
          {
            onConflict: "risk_flag_id,recommendation_id,generation",
            ignoreDuplicates: true,
          },
        );
        requireSuccess(draftError);
        pendingDrafts = 1;
      }
    }

    return {
      signals: signals.length,
      flags: assessment.counts.flags,
      recommendations: assessment.counts.recommendations,
      alerts: assessment.counts.alerts,
      pendingDrafts,
    };
  };
