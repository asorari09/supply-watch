import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

import type { Database } from "@/lib/db/database.types";

const databaseEnvSchema = z.object({
  SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().trim().min(1),
});

export const createSupabaseAdminClient = () =>
  createClient<Database>(
    databaseEnvSchema.parse(process.env).SUPABASE_URL,
    databaseEnvSchema.parse(process.env).SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: {
        autoRefreshToken: false,
        detectSessionInUrl: false,
        persistSession: false,
      },
    },
  );
