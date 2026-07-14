import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

import type { Database } from "@/lib/db/database.types";

const databaseEnvSchema = z.object({
  SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().trim().min(1),
});

export type DatabaseSchema = "public" | "eval";

export function createSupabaseAdminClient(): SupabaseClient<Database>;
export function createSupabaseAdminClient(
  schema: "eval",
): SupabaseClient<Database, "eval">;
export function createSupabaseAdminClient(
  schema: DatabaseSchema = "public",
): SupabaseClient<Database> | SupabaseClient<Database, "eval"> {
  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = databaseEnvSchema.parse(
    process.env,
  );
  const options = {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
  };
  return schema === "eval"
    ? createClient<Database, "eval">(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
        ...options,
        db: { schema: "eval" },
      })
    : createClient<Database>(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, options);
}
