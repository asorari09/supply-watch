import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/db/database.types";
export const upsertReorderRecommendations = async (
  client: SupabaseClient<Database, "public" | "eval">,
  rows: Database["public"]["Tables"]["reorder_recommendations"]["Insert"][],
) => {
  const { data, error } = await client
    .from("reorder_recommendations")
    .upsert(rows, { onConflict: "risk_flag_id,inputs_hash" })
    .select("id");
  if (error) throw new Error(error.message);
  return data;
};
