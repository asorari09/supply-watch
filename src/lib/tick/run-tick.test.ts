import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";

import type {
  SignalMonitorDependencies,
  SignalMonitorResult,
} from "@/lib/agents/signal-monitor";
import type { Database } from "@/lib/db/database.types";
import { fixedClock, systemClock } from "@/lib/runtime/clock";
import type { Logger } from "@/lib/runtime/logger";
import { createRunContext } from "@/lib/runtime/run-context";

import {
  runTick,
  type AssessmentDependencies,
  type AssessmentRunResult,
  type TickDependencies,
} from "./run-tick";

const logger: Logger = {
  info: () => undefined,
  warn: () => undefined,
  error: () => undefined,
};

const context = createRunContext({
  clock: fixedClock(systemClock.now()),
  logger,
  mode: "replay",
  tickId: "00000000-0000-4000-8000-000000000010",
});

const monitorResult: SignalMonitorResult = {
  ok: true,
  counts: {
    adaptersRun: 2,
    adaptersDegraded: 0,
    adaptersFailed: 0,
    signalsCollected: 3,
    signalsAfterDedupe: 2,
    upserted: 2,
  },
};

const assessmentResult: AssessmentRunResult = {
  ok: true,
  counts: { flags: 2, recommendations: 1, alerts: 1 },
};

const createDependencies = (
  overrides: Partial<TickDependencies> = {},
): TickDependencies => {
  const client = {} as SupabaseClient<Database>;
  const signalMonitorDependencies = {
    adapters: [],
    client,
  } satisfies SignalMonitorDependencies;
  const assessmentDependencies: AssessmentDependencies = { client };

  return {
    client,
    signalMonitorDependencies,
    assessmentDependencies,
    runMonitor: vi.fn(async () => monitorResult),
    runAssessment: vi.fn(async () => assessmentResult),
    tryTickLock: vi.fn(async () => true),
    releaseTickLock: vi.fn(async () => undefined),
    triggerSource: "manual",
    ...overrides,
  };
};

describe("runTick", () => {
  it("runs both stages and releases an acquired lock", async () => {
    const deps = createDependencies();

    const result = await runTick(context, deps);

    expect(result).toMatchObject({
      ok: true,
      skipped: false,
      tickId: context.tickId,
      estCostUsd: 0,
      signalCounts: monitorResult.counts,
      assessmentCounts: assessmentResult.counts,
    });
    expect(deps.runMonitor).toHaveBeenCalledOnce();
    expect(deps.runAssessment).toHaveBeenCalledOnce();
    expect(deps.releaseTickLock).toHaveBeenCalledOnce();
  });

  it("short-circuits without releasing when another tick holds the lock", async () => {
    const deps = createDependencies({ tryTickLock: vi.fn(async () => false) });

    const result = await runTick(context, deps);

    expect(result).toMatchObject({
      ok: true,
      skipped: true,
      reason: "tick already running",
    });
    expect(deps.runMonitor).not.toHaveBeenCalled();
    expect(deps.runAssessment).not.toHaveBeenCalled();
    expect(deps.releaseTickLock).not.toHaveBeenCalled();
  });

  it.each(["monitor", "assessment"])(
    "returns failure and releases the lock when %s throws",
    async (failingStage) => {
      const deps = createDependencies(
        failingStage === "monitor"
          ? {
              runMonitor: vi.fn(async () =>
                Promise.reject(new Error("monitor")),
              ),
            }
          : {
              runAssessment: vi.fn(async () =>
                Promise.reject(new Error("assessment")),
              ),
            },
      );

      const result = await runTick(context, deps);

      expect(result).toMatchObject({ ok: false, skipped: false });
      expect(deps.releaseTickLock).toHaveBeenCalledOnce();
    },
  );
});
