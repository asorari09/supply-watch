import type { SupabaseClient } from "@supabase/supabase-js";

import { runAssessment } from "@/lib/agents/assessment-engine";
import {
  createDefaultSignalMonitorDependencies,
  runSignalMonitor,
  type SignalMonitorDependencies,
  type SignalMonitorResult,
} from "@/lib/agents/signal-monitor";
import type { Database } from "@/lib/db/database.types";
import type { TickTriggerSource } from "@/lib/domain";
import type { RunContext } from "@/lib/runtime/run-context";

export interface AssessmentRunResult {
  ok: boolean;
  counts?: Record<string, number>;
  failure?: string;
}

export interface AssessmentDependencies {
  client: SupabaseClient<Database>;
}

export interface TickResult {
  ok: boolean;
  skipped: boolean;
  tickId: string;
  estCostUsd: number;
  reason?: string;
  error?: string;
  signalCounts?: SignalMonitorResult["counts"];
  assessmentCounts?: Record<string, number>;
}

export interface TickDependencies {
  client: SupabaseClient<Database>;
  signalMonitorDependencies: SignalMonitorDependencies;
  assessmentDependencies: AssessmentDependencies;
  runMonitor: (
    ctx: RunContext,
    deps: SignalMonitorDependencies,
  ) => Promise<SignalMonitorResult>;
  runAssessment: (
    ctx: RunContext,
    deps: AssessmentDependencies,
  ) => Promise<AssessmentRunResult>;
  tryTickLock: (client: SupabaseClient<Database>) => Promise<boolean>;
  releaseTickLock: (client: SupabaseClient<Database>) => Promise<void>;
  triggerSource: TickTriggerSource;
}

const tryTickLock = async (
  client: SupabaseClient<Database>,
): Promise<boolean> => {
  const { data, error } = await client.rpc("try_tick_lock");
  if (error !== null) {
    throw new Error("Could not acquire the tick lock.");
  }

  return data;
};

const releaseTickLock = async (
  client: SupabaseClient<Database>,
): Promise<void> => {
  const { error } = await client.rpc("release_tick_lock");
  if (error !== null) {
    throw new Error("Could not release the tick lock.");
  }
};

export const createDefaultTickDependencies = (): TickDependencies => {
  const signalMonitorDependencies = createDefaultSignalMonitorDependencies();
  const client = signalMonitorDependencies.client;

  return {
    client,
    signalMonitorDependencies,
    assessmentDependencies: { client },
    runMonitor: runSignalMonitor,
    runAssessment,
    tryTickLock,
    releaseTickLock,
    triggerSource: "manual",
  };
};

const failureResult = (ctx: RunContext): TickResult => ({
  ok: false,
  skipped: false,
  error: "Tick failed.",
  tickId: ctx.tickId,
  estCostUsd: 0,
});

export const runTick = async (
  ctx: RunContext,
  deps: TickDependencies,
): Promise<TickResult> => {
  let acquired = false;

  try {
    acquired = await deps.tryTickLock(deps.client);
    if (!acquired) {
      return {
        ok: true,
        skipped: true,
        reason: "tick already running",
        tickId: ctx.tickId,
        estCostUsd: 0,
      };
    }

    let result: TickResult;
    try {
      const signalMonitorResult = await deps.runMonitor(
        ctx,
        deps.signalMonitorDependencies,
      );
      const assessmentResult = await deps.runAssessment(
        ctx,
        deps.assessmentDependencies,
      );

      if (!signalMonitorResult.ok || !assessmentResult.ok) {
        result = failureResult(ctx);
      } else {
        result = {
          ok: true,
          skipped: false,
          signalCounts: signalMonitorResult.counts,
          assessmentCounts: assessmentResult.counts ?? {},
          tickId: ctx.tickId,
          estCostUsd: 0,
        };
      }
    } catch {
      result = failureResult(ctx);
    } finally {
      try {
        await deps.releaseTickLock(deps.client);
      } catch {
        ctx.logger.error("Tick lock release failed.", { tickId: ctx.tickId });
        result = failureResult(ctx);
      }
    }

    return result;
  } catch {
    if (acquired) {
      try {
        await deps.releaseTickLock(deps.client);
      } catch {
        ctx.logger.error("Tick lock release failed.", { tickId: ctx.tickId });
      }
    }

    return failureResult(ctx);
  }
};
