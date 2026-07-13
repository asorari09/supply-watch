import type { Database } from "@/lib/db/database.types";

export interface TickLogCounts {
  adaptersRun: number;
  adaptersDegraded: number;
  adaptersFailed: number;
  signalsCollected: number;
  signalsAfterDedupe: number;
  upserted: number;
  failure?: number;
}

export interface TickLogInput {
  id: string;
  mode: Database["public"]["Enums"]["tick_mode"];
  clockNow: string;
  counts: TickLogCounts;
  durationMs: number;
}

export const toTickLogRow = (
  input: TickLogInput,
): Database["public"]["Tables"]["tick_logs"]["Insert"] => ({
  id: input.id,
  trigger_source: "manual",
  mode: input.mode,
  clock_now: input.clockNow,
  counts: { ...input.counts },
  duration_ms: input.durationMs,
  est_cost_usd: 0,
  created_at: input.clockNow,
});
