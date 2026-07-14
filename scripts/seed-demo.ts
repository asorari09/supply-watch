// SYNTHETIC demo data only. This script creates a visible public dashboard state.
import { randomUUID } from "node:crypto";

import { runAssessment } from "@/lib/agents/assessment-engine";
import { createSupabaseAdminClient } from "@/lib/db/admin-client";
import type { Database } from "@/lib/db/database.types";
import { toSignalRow } from "@/lib/db/mappers/signal.mapper";
import { signalSchema } from "@/lib/domain";
import { createRunContext } from "@/lib/runtime/run-context";

const demoSignalIds = [
  "50000000-0000-4000-8000-000000000001",
  "50000000-0000-4000-8000-000000000002",
  "50000000-0000-4000-8000-000000000003",
] as const;
const demoDedupeHashes = [
  "demo-seed-route-storm-v1",
  "demo-seed-supplier-port-closure-v1",
  "demo-seed-supplier-labor-strike-v1",
] as const;
const demoDraftId = "60000000-0000-4000-8000-000000000001";

type SupplierRow = Database["public"]["Tables"]["suppliers"]["Row"];
type ShipmentRow = Database["public"]["Tables"]["shipments"]["Row"];
type SkuRow = Database["public"]["Tables"]["skus"]["Row"];

const requireData = <T>(data: T[] | null, label: string): T[] => {
  if (data === null || data.length === 0)
    throw new Error(
      `${label} are missing. Run pnpm db:seed before pnpm seed:demo.`,
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

const countRows = async (
  table: "risk_flags" | "reorder_recommendations" | "alerts" | "comms_drafts",
) => {
  const { count, error } = await createSupabaseAdminClient()
    .from(table)
    .select("id", { count: "exact", head: true });
  requireSuccess(error);
  return count ?? 0;
};

const run = async (): Promise<void> => {
  const client = createSupabaseAdminClient();
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

  const context = createRunContext({ mode: "live", tickId: randomUUID() });
  const detectedAt = context.clock.now().toISOString();
  const signals = [
    signalSchema.parse({
      id: demoSignalIds[0],
      source: "weather",
      disruptionType: "storm",
      affectedRegions: [routeSupplier.region_code],
      geo: { kind: "regions", regionCodes: [routeSupplier.region_code] },
      severity: "high",
      delayDaysEstimate: 7,
      confidence: "high",
      detectedAt,
      rawRef: "demo-seed:route-storm",
      dedupeHash: demoDedupeHashes[0],
      status: "active",
    }),
    signalSchema.parse({
      id: demoSignalIds[1],
      source: "news",
      disruptionType: "port_closure",
      affectedRegions: [portClosureSupplier.region_code],
      geo: { kind: "regions", regionCodes: [portClosureSupplier.region_code] },
      severity: "high",
      delayDaysEstimate: 7,
      confidence: "high",
      detectedAt,
      rawRef: "demo-seed:supplier-port-closure",
      dedupeHash: demoDedupeHashes[1],
      status: "active",
    }),
    signalSchema.parse({
      id: demoSignalIds[2],
      source: "news",
      disruptionType: "labor_strike",
      affectedRegions: [laborStrikeSupplier.region_code],
      geo: { kind: "regions", regionCodes: [laborStrikeSupplier.region_code] },
      severity: "med",
      delayDaysEstimate: 3,
      confidence: "high",
      detectedAt,
      rawRef: "demo-seed:supplier-labor-strike",
      dedupeHash: demoDedupeHashes[2],
      status: "active",
    }),
  ];
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
    throw new Error(assessment.failure ?? "Demo assessment failed.");
  if (assessment.counts.flags === 0)
    throw new Error(
      "Demo assessment produced zero flags; no dashboard state was created.",
    );

  const pending = assessment.result.pendingDraftRefs[0];
  if (pending !== undefined) {
    const { data: recommendation, error: recommendationError } = await client
      .from("reorder_recommendations")
      .select("id")
      .eq("risk_flag_id", pending.flag.id)
      .eq("inputs_hash", pending.recommendation.inputsHash)
      .maybeSingle();
    requireSuccess(recommendationError);
    if (recommendation !== null) {
      const { error: draftError } = await client.from("comms_drafts").upsert(
        {
          id: demoDraftId,
          risk_flag_id: pending.flag.id,
          recommendation_id: recommendation.id,
          generation: 1,
          subject: `Action requested: ${pending.flag.signal.disruptionType.replaceAll("_", " ")}`,
          body: `A ${pending.flag.signal.disruptionType.replaceAll("_", " ")} affects your supply route. Please confirm the updated delivery plan and available mitigation options.`,
          tone: "direct and collaborative",
          model_used: "demo-template",
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
    }
  }

  const [riskFlags, recommendations, alerts, drafts] = await Promise.all([
    countRows("risk_flags"),
    countRows("reorder_recommendations"),
    countRows("alerts"),
    countRows("comms_drafts"),
  ]);
  console.info(
    JSON.stringify({
      signalsUpserted: signals.length,
      flags: assessment.counts.flags,
      recommendations: assessment.counts.recommendations,
      alerts: assessment.counts.alerts,
      pendingDrafts: drafts,
      publicRows: { riskFlags, recommendations, alerts, drafts },
    }),
  );
};

void run().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
