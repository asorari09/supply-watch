import "server-only";

import { createSupabaseAdminClient as createAdminClient } from "@/lib/db/admin-client";

export const createSupabaseAdminClient = () => createAdminClient();
