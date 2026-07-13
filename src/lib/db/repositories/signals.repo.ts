import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/db/database.types";

export interface SignalUpsertCounts {
  inserted: number;
  updated: number;
  upserted: number;
}

type SignalRow = Database["public"]["Tables"]["signals"]["Insert"];

export const upsertSignals = async (
  client: SupabaseClient<Database>,
  rows: readonly SignalRow[],
): Promise<SignalUpsertCounts> => {
  if (rows.length === 0) {
    return { inserted: 0, updated: 0, upserted: 0 };
  }

  const dedupeHashes = rows.map((row) => row.dedupe_hash);
  const { data: existingRows, error: existingError } = await client
    .from("signals")
    .select("dedupe_hash")
    .in("dedupe_hash", dedupeHashes);

  if (existingError !== null) {
    throw new Error(existingError.message);
  }

  const existingHashes = new Set(existingRows.map((row) => row.dedupe_hash));
  const { data: upsertedRows, error: upsertError } = await client
    .from("signals")
    .upsert([...rows], { onConflict: "dedupe_hash" })
    .select("id");

  if (upsertError !== null) {
    throw new Error(upsertError.message);
  }

  return {
    inserted: rows.filter((row) => !existingHashes.has(row.dedupe_hash)).length,
    updated: rows.filter((row) => existingHashes.has(row.dedupe_hash)).length,
    upserted: upsertedRows.length,
  };
};
