import { createSupabaseAdminClient } from "@/lib/db/admin-client";

const requireRows = async (
  table: "suppliers" | "skus" | "shipments",
): Promise<number> => {
  const client = createSupabaseAdminClient();
  const { count, error } = await client
    .from(table)
    .select("id", { count: "exact", head: true });

  if (error !== null) {
    throw new Error(error.message);
  }

  const rowCount = count ?? 0;
  if (rowCount <= 0) {
    throw new Error(`${table} must contain synthetic seed data.`);
  }

  return rowCount;
};

const run = async (): Promise<void> => {
  const [suppliers, skus, shipments] = await Promise.all([
    requireRows("suppliers"),
    requireRows("skus"),
    requireRows("shipments"),
  ]);

  console.info(JSON.stringify({ suppliers, skus, shipments }));
};

void run().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
