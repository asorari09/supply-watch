import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";

import type { SignalAdapter } from "@/lib/adapters/types";
import { runSignalMonitor } from "@/lib/agents/signal-monitor";
import type { SignalMonitorDependencies } from "@/lib/agents/signal-monitor";
import type { Database } from "@/lib/db/database.types";
import { signalSchema } from "@/lib/domain";
import { fixedClock, systemClock } from "@/lib/runtime/clock";
import type { Logger } from "@/lib/runtime/logger";
import { createRunContext } from "@/lib/runtime/run-context";

const baseSignal = (dedupeHash: string, id: string) =>
  signalSchema.parse({
    id,
    source: "news",
    disruptionType: "port_closure",
    affectedRegions: ["US-CA"],
    geo: { kind: "regions", regionCodes: ["US-CA"] },
    severity: "high",
    delayDaysEstimate: 7,
    confidence: "high",
    detectedAt: "2026-07-13T12:00:00.000Z",
    rawRef: `fixture:${dedupeHash}`,
    dedupeHash,
    status: "active",
  });

const logger: Logger = {
  info: () => undefined,
  warn: () => undefined,
  error: () => undefined,
};

describe("runSignalMonitor composition", () => {
  it("runs every adapter, dedupes signals, tolerates failures, and writes one TickLog", async () => {
    let weatherCalls = 0;
    let newsCalls = 0;
    let failedCalls = 0;
    const shared = baseSignal(
      "shared-hash",
      "00000000-0000-4000-8000-000000000001",
    );
    const weather: SignalAdapter = {
      name: "weather-stub",
      fetch: async () => {
        weatherCalls += 1;
        return {
          ok: true,
          signals: [
            baseSignal("weather-hash", "00000000-0000-4000-8000-000000000002"),
            shared,
          ],
        };
      },
    };
    const news: SignalAdapter = {
      name: "news-stub",
      fetch: async () => {
        newsCalls += 1;
        return {
          ok: true,
          degraded: true,
          signals: [
            shared,
            baseSignal("news-hash", "00000000-0000-4000-8000-000000000003"),
          ],
        };
      },
    };
    const failed: SignalAdapter = {
      name: "failed-stub",
      fetch: async () => {
        failedCalls += 1;
        return { ok: false, degraded: true, reason: "fixture failure" };
      },
    };
    const tickRows: Database["public"]["Tables"]["tick_logs"]["Insert"][] = [];
    const dependencies: SignalMonitorDependencies = {
      adapters: [weather, news, failed],
      client: {} as SupabaseClient<Database>,
      upsert: async (_client, rows) => ({
        inserted: rows.length,
        updated: 0,
        upserted: rows.length,
      }),
      writeTickLog: async (_client, row) => {
        tickRows.push(row);
      },
    };
    const context = createRunContext({
      clock: fixedClock(systemClock.now()),
      logger,
      mode: "replay",
      tickId: "00000000-0000-4000-8000-000000000004",
    });

    const result = await runSignalMonitor(context, dependencies);

    expect(result).toMatchObject({
      ok: true,
      counts: {
        adaptersRun: 3,
        adaptersDegraded: 1,
        adaptersFailed: 1,
        signalsCollected: 4,
        signalsAfterDedupe: 3,
        upserted: 3,
      },
    });
    expect(weatherCalls).toBe(1);
    expect(newsCalls).toBe(1);
    expect(failedCalls).toBe(1);
    expect(tickRows).toHaveLength(1);
    expect(tickRows[0]?.counts).toMatchObject({
      signalsAfterDedupe: 3,
      upserted: 3,
    });
    expect(tickRows[0]?.est_cost_usd).toBe(0);
  });
});
