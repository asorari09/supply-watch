import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/db/database.types";

export const upsertCommsDrafts = async (
  client: SupabaseClient<Database>,
  rows: Database["public"]["Tables"]["comms_drafts"]["Insert"][],
) => {
  if (rows.length === 0) return [];
  const { data, error } = await client
    .from("comms_drafts")
    .upsert(rows, {
      onConflict: "risk_flag_id,recommendation_id,generation",
      ignoreDuplicates: true,
    })
    .select("id");
  if (error) throw new Error(error.message);
  return data;
};

export const findCommsDrafts = async (
  client: SupabaseClient<Database>,
  riskFlagId: string,
  recommendationId: string,
) => {
  const { data, error } = await client
    .from("comms_drafts")
    .select("generation,status")
    .eq("risk_flag_id", riskFlagId)
    .eq("recommendation_id", recommendationId);
  if (error) throw new Error(error.message);
  return data;
};
