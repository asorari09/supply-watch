import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/db/database.types";
export const upsertRiskFlags = async (
  client: SupabaseClient<Database>,
  rows: Database["public"]["Tables"]["risk_flags"]["Insert"][],
) => {
  const { data, error } = await client
    .from("risk_flags")
    .upsert(rows, { onConflict: "signal_id,sku_id,shipment_id" })
    .select("id");
  if (error) throw new Error(error.message);
  return data;
};
