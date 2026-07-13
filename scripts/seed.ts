// SYNTHETIC sample data only. This dataset is for the honest portfolio demo.
import { createSupabaseAdminClient } from "@/lib/db/admin-client";
import type { Database } from "@/lib/db/database.types";

type SupplierInsert = Database["public"]["Tables"]["suppliers"]["Insert"];
type SkuInsert = Database["public"]["Tables"]["skus"]["Insert"];
type ShipmentInsert = Database["public"]["Tables"]["shipments"]["Insert"];
type SeedSupplier = SupplierInsert & { id: string };
type SeedSku = SkuInsert & { id: string; supplier_id: string };

const supplierIds = {
  california: "00000000-0000-4000-8000-000000000002",
  china: "00000000-0000-4000-8000-000000000003",
  germany: "00000000-0000-4000-8000-000000000004",
  japan: "00000000-0000-4000-8000-000000000006",
  mexico: "00000000-0000-4000-8000-000000000005",
  texas: "00000000-0000-4000-8000-000000000001",
} as const;

const suppliers: SeedSupplier[] = [
  {
    id: supplierIds.texas,
    name: "Lone Star Components",
    region_code: "US-TX",
    geo: { lat: 29.7604, lon: -95.3698 },
    lead_time_days_base: 14,
    lead_time_std_days: 2,
    reliability: 0.96,
  },
  {
    id: supplierIds.california,
    name: "Pacific Circuit Works",
    region_code: "US-CA",
    geo: { lat: 33.7701, lon: -118.1937 },
    lead_time_days_base: 12,
    lead_time_std_days: 2,
    reliability: 0.97,
  },
  {
    id: supplierIds.china,
    name: "Shenzhen Precision Parts",
    region_code: "CN",
    geo: { lat: 22.5431, lon: 114.0579 },
    lead_time_days_base: 28,
    lead_time_std_days: 5,
    reliability: 0.91,
  },
  {
    id: supplierIds.germany,
    name: "Rhein Industrial Systems",
    region_code: "DE",
    geo: { lat: 50.1109, lon: 8.6821 },
    lead_time_days_base: 21,
    lead_time_std_days: 3,
    reliability: 0.95,
  },
  {
    id: supplierIds.mexico,
    name: "Monterrey Fabrication",
    region_code: "MX",
    geo: { lat: 25.6866, lon: -100.3161 },
    lead_time_days_base: 10,
    lead_time_std_days: 2,
    reliability: 0.94,
  },
  {
    id: supplierIds.japan,
    name: "Tokyo Motion Labs",
    region_code: "JP",
    geo: { lat: 35.6762, lon: 139.6503 },
    lead_time_days_base: 24,
    lead_time_std_days: 4,
    reliability: 0.96,
  },
];

const skus: SeedSku[] = [
  {
    id: "10000000-0000-4000-8000-000000000001",
    sku: "LSC-CTRL-100",
    supplier_id: supplierIds.texas,
    on_hand: 320,
    on_order: 180,
    backorders: 25,
    avg_daily_demand: 18,
    demand_std: 5,
    unit_cost: 84,
    holding_cost: 16,
    order_cost: 220,
    moq: 100,
    service_level_z: 1.645,
  },
  {
    id: "10000000-0000-4000-8000-000000000002",
    sku: "LSC-SENS-210",
    supplier_id: supplierIds.texas,
    on_hand: 460,
    on_order: 240,
    backorders: 10,
    avg_daily_demand: 14,
    demand_std: 4,
    unit_cost: 42,
    holding_cost: 9,
    order_cost: 180,
    moq: 80,
    service_level_z: 1.645,
  },
  {
    id: "10000000-0000-4000-8000-000000000003",
    sku: "PCW-BOARD-330",
    supplier_id: supplierIds.california,
    on_hand: 270,
    on_order: 300,
    backorders: 40,
    avg_daily_demand: 22,
    demand_std: 6,
    unit_cost: 115,
    holding_cost: 24,
    order_cost: 260,
    moq: 100,
    service_level_z: 1.645,
  },
  {
    id: "10000000-0000-4000-8000-000000000004",
    sku: "PCW-POWER-415",
    supplier_id: supplierIds.california,
    on_hand: 390,
    on_order: 160,
    backorders: 0,
    avg_daily_demand: 12,
    demand_std: 3,
    unit_cost: 67,
    holding_cost: 13,
    order_cost: 190,
    moq: 60,
    service_level_z: 1.645,
  },
  {
    id: "10000000-0000-4000-8000-000000000005",
    sku: "SPP-FAST-500",
    supplier_id: supplierIds.china,
    on_hand: 680,
    on_order: 500,
    backorders: 75,
    avg_daily_demand: 30,
    demand_std: 9,
    unit_cost: 8,
    holding_cost: 2,
    order_cost: 150,
    moq: 250,
    service_level_z: 1.645,
  },
  {
    id: "10000000-0000-4000-8000-000000000006",
    sku: "SPP-HOUS-610",
    supplier_id: supplierIds.china,
    on_hand: 210,
    on_order: 400,
    backorders: 15,
    avg_daily_demand: 16,
    demand_std: 5,
    unit_cost: 39,
    holding_cost: 8,
    order_cost: 210,
    moq: 120,
    service_level_z: 1.645,
  },
  {
    id: "10000000-0000-4000-8000-000000000007",
    sku: "RIS-VALVE-720",
    supplier_id: supplierIds.germany,
    on_hand: 150,
    on_order: 180,
    backorders: 20,
    avg_daily_demand: 11,
    demand_std: 4,
    unit_cost: 146,
    holding_cost: 31,
    order_cost: 310,
    moq: 50,
    service_level_z: 1.645,
  },
  {
    id: "10000000-0000-4000-8000-000000000008",
    sku: "RIS-SEAL-835",
    supplier_id: supplierIds.germany,
    on_hand: 540,
    on_order: 250,
    backorders: 0,
    avg_daily_demand: 20,
    demand_std: 6,
    unit_cost: 18,
    holding_cost: 4,
    order_cost: 170,
    moq: 150,
    service_level_z: 1.645,
  },
  {
    id: "10000000-0000-4000-8000-000000000009",
    sku: "MFF-BRKT-910",
    supplier_id: supplierIds.mexico,
    on_hand: 740,
    on_order: 360,
    backorders: 30,
    avg_daily_demand: 28,
    demand_std: 8,
    unit_cost: 12,
    holding_cost: 3,
    order_cost: 140,
    moq: 200,
    service_level_z: 1.645,
  },
  {
    id: "10000000-0000-4000-8000-000000000010",
    sku: "MFF-CABLE-102",
    supplier_id: supplierIds.mexico,
    on_hand: 910,
    on_order: 600,
    backorders: 0,
    avg_daily_demand: 35,
    demand_std: 10,
    unit_cost: 6,
    holding_cost: 1.5,
    order_cost: 125,
    moq: 300,
    service_level_z: 1.645,
  },
  {
    id: "10000000-0000-4000-8000-000000000011",
    sku: "TML-SERVO-220",
    supplier_id: supplierIds.japan,
    on_hand: 190,
    on_order: 220,
    backorders: 10,
    avg_daily_demand: 9,
    demand_std: 3,
    unit_cost: 205,
    holding_cost: 44,
    order_cost: 360,
    moq: 40,
    service_level_z: 1.645,
  },
  {
    id: "10000000-0000-4000-8000-000000000012",
    sku: "TML-GEAR-345",
    supplier_id: supplierIds.japan,
    on_hand: 430,
    on_order: 300,
    backorders: 5,
    avg_daily_demand: 15,
    demand_std: 5,
    unit_cost: 76,
    holding_cost: 16,
    order_cost: 230,
    moq: 75,
    service_level_z: 1.645,
  },
];

const shipments: ShipmentInsert[] = skus.map((sku, index) => ({
  id: `20000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
  sku_id: sku.id,
  supplier_id: sku.supplier_id,
  origin_geo:
    suppliers.find((supplier) => supplier.id === sku.supplier_id)?.geo ?? {},
  dest_geo: { lat: 41.8781, lon: -87.6298 },
  route_regions: [
    sku.supplier_id === supplierIds.china
      ? "CN"
      : sku.supplier_id === supplierIds.japan
        ? "JP"
        : sku.supplier_id === supplierIds.germany
          ? "DE"
          : sku.supplier_id === supplierIds.mexico
            ? "MX"
            : sku.supplier_id === supplierIds.california
              ? "US-CA"
              : "US-TX",
    "US-IL",
  ],
  eta: `2026-08-${String(10 + index).padStart(2, "0")}T12:00:00.000Z`,
  qty: [180, 240, 300, 160, 500, 400, 180, 250, 360, 600, 220, 300][index] ?? 0,
  status: "in_transit",
}));

const ensureSuccess = (error: { message: string } | null): void => {
  if (error !== null) {
    throw new Error(error.message);
  }
};

const run = async (): Promise<void> => {
  const client = createSupabaseAdminClient();

  ensureSuccess(
    (await client.from("suppliers").upsert(suppliers, { onConflict: "id" }))
      .error,
  );
  ensureSuccess(
    (await client.from("skus").upsert(skus, { onConflict: "id" })).error,
  );
  ensureSuccess(
    (await client.from("shipments").upsert(shipments, { onConflict: "id" }))
      .error,
  );

  const [supplierCount, skuCount, shipmentCount] = await Promise.all([
    client.from("suppliers").select("id", { count: "exact", head: true }),
    client.from("skus").select("id", { count: "exact", head: true }),
    client.from("shipments").select("id", { count: "exact", head: true }),
  ]);

  ensureSuccess(supplierCount.error);
  ensureSuccess(skuCount.error);
  ensureSuccess(shipmentCount.error);

  console.info(
    JSON.stringify({
      suppliers: supplierCount.count ?? 0,
      skus: skuCount.count ?? 0,
      shipments: shipmentCount.count ?? 0,
    }),
  );
};

void run().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
