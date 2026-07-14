import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/db/database.types";
export const upsertAlerts = async (
  client: SupabaseClient<Database>,
  rows: Database["public"]["Tables"]["alerts"]["Insert"][],
) => {
  const { data, error } = await client
    .from("alerts")
    .upsert(rows, { onConflict: "risk_flag_id,level" })
    .select("id");
  if (error) throw new Error(error.message);
  return data;
};
