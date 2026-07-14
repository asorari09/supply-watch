import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/db/database.types";

export const insertApprovalRecord = async (
  client: SupabaseClient<Database>,
  row: Database["public"]["Tables"]["approval_records"]["Insert"],
) => {
  const { data, error } = await client
    .from("approval_records")
    .insert(row)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data;
};

export const findApprovalRecordsForDraft = async (
  client: SupabaseClient<Database>,
  draftId: string,
) => {
  const { data, error } = await client
    .from("approval_records")
    .select()
    .eq("draft_id", draftId);
  if (error) throw new Error(error.message);
  return data;
};
