import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/db/database.types";

export const insertTickLog = async (
  client: SupabaseClient<Database>,
  row: Database["public"]["Tables"]["tick_logs"]["Insert"],
): Promise<void> => {
  const { error } = await client.from("tick_logs").insert(row);

  if (error !== null) {
    throw new Error(error.message);
  }
};
