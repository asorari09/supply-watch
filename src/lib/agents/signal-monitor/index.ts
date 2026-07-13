import type { SupabaseClient } from "@supabase/supabase-js";

import { RssNewsAdapter } from "@/lib/adapters/news";
import type { SignalAdapter } from "@/lib/adapters/types";
import { OpenMeteoWeatherAdapter } from "@/lib/adapters/weather";
import { createSupabaseAdminClient } from "@/lib/db/admin-client";
import type { Database } from "@/lib/db/database.types";
import { toSignalRow } from "@/lib/db/mappers/signal.mapper";
import {
  toTickLogRow,
  type TickLogCounts,
} from "@/lib/db/mappers/tick-log.mapper";
import { upsertSignals } from "@/lib/db/repositories/signals.repo";
import { insertTickLog } from "@/lib/db/repositories/tick-logs.repo";
import type { Signal } from "@/lib/domain";
import type { RunContext } from "@/lib/runtime/run-context";

export interface SignalMonitorResult {
  ok: boolean;
  counts: TickLogCounts;
  failure?: string;
}

export interface SignalMonitorDependencies {
  adapters: readonly SignalAdapter[];
  client: SupabaseClient<Database>;
  upsert?: typeof upsertSignals;
  writeTickLog?: typeof insertTickLog;
}

export const createDefaultSignalMonitorDependencies =
  (): SignalMonitorDependencies => ({
    adapters: [new OpenMeteoWeatherAdapter(), new RssNewsAdapter()],
    client: createSupabaseAdminClient(),
  });

const dedupeSignals = (signals: readonly Signal[]): Signal[] => {
  const byHash = new Map<string, Signal>();
  for (const signal of signals) {
    byHash.set(signal.dedupeHash, signal);
  }

  return [...byHash.values()];
};

const durationSince = (startedAtMs: number, ctx: RunContext): number =>
  Math.max(0, ctx.clock.now().getTime() - startedAtMs);

const writeMonitorTickLog = async (
  deps: SignalMonitorDependencies,
  ctx: RunContext,
  counts: TickLogCounts,
  startedAtMs: number,
): Promise<void> => {
  const clockNow = ctx.clock.now().toISOString();
  await (deps.writeTickLog ?? insertTickLog)(
    deps.client,
    toTickLogRow({
      id: ctx.tickId,
      mode: ctx.mode,
      clockNow,
      counts,
      durationMs: durationSince(startedAtMs, ctx),
    }),
  );
};

export const runSignalMonitor = async (
  ctx: RunContext,
  deps: SignalMonitorDependencies,
): Promise<SignalMonitorResult> => {
  const startedAtMs = ctx.clock.now().getTime();
  const counts: TickLogCounts = {
    adaptersRun: 0,
    adaptersDegraded: 0,
    adaptersFailed: 0,
    signalsCollected: 0,
    signalsAfterDedupe: 0,
    upserted: 0,
  };

  try {
    const collected: Signal[] = [];

    for (const adapter of deps.adapters) {
      counts.adaptersRun += 1;
      const result = await adapter.fetch(ctx);
      if (!result.ok) {
        counts.adaptersFailed += 1;
        ctx.logger.warn("Signal adapter failed; continuing monitor pass.", {
          adapter: adapter.name,
          reason: result.reason,
          tickId: ctx.tickId,
        });
        continue;
      }

      if (result.degraded === true) {
        counts.adaptersDegraded += 1;
      }
      collected.push(...result.signals);
    }

    counts.signalsCollected = collected.length;
    const dedupedSignals = dedupeSignals(collected);
    counts.signalsAfterDedupe = dedupedSignals.length;
    const upsertResult = await (deps.upsert ?? upsertSignals)(
      deps.client,
      dedupedSignals.map(toSignalRow),
    );
    counts.upserted = upsertResult.upserted;

    await writeMonitorTickLog(deps, ctx, counts, startedAtMs);
    return { ok: true, counts };
  } catch (error: unknown) {
    const failure =
      error instanceof Error ? error.message : "Signal monitor failed.";
    counts.failure = 1;
    ctx.logger.error("Signal monitor failed closed.", {
      failure,
      tickId: ctx.tickId,
    });

    try {
      await writeMonitorTickLog(deps, ctx, counts, startedAtMs);
    } catch (tickLogError: unknown) {
      ctx.logger.error("Signal monitor could not write its failure TickLog.", {
        failure:
          tickLogError instanceof Error
            ? tickLogError.message
            : "Unknown error.",
        tickId: ctx.tickId,
      });
    }

    return { ok: false, counts, failure };
  }
};
