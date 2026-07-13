import { afterEach, describe, expect, it } from "vitest";

import type { SignalAdapter } from "@/lib/adapters/types";
import { runSignalMonitor } from "@/lib/agents/signal-monitor";
import { createSupabaseAdminClient } from "@/lib/db/admin-client";
import { signalSchema } from "@/lib/domain";
import { fixedClock, systemClock } from "@/lib/runtime/clock";
import type { Logger } from "@/lib/runtime/logger";
import { createRunContext } from "@/lib/runtime/run-context";

const integrationEnvPresent = [
  "SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
].every((key) => (process.env[key] ?? "").trim().length > 0);
const integrationIt = integrationEnvPresent ? it : it.skip;
const dedupeHashes = [
  "integration-signal-monitor-weather",
  "integration-signal-monitor-news",
];
const tickIds = [
  "00000000-0000-4000-8000-000000000101",
  "00000000-0000-4000-8000-000000000102",
];

const logger: Logger = {
  info: () => undefined,
  warn: () => undefined,
  error: () => undefined,
};

const signals = [
  signalSchema.parse({
    id: "00000000-0000-4000-8000-000000000201",
    source: "weather",
    disruptionType: "storm",
    affectedRegions: ["US-TX"],
    geo: { kind: "point", lat: 29.7604, lon: -95.3698 },
    severity: "high",
    delayDaysEstimate: 7,
    confidence: "high",
    detectedAt: "2026-07-13T12:00:00.000Z",
    rawRef: "integration:weather",
    dedupeHash: dedupeHashes[0] ?? "",
    status: "active",
  }),
  signalSchema.parse({
    id: "00000000-0000-4000-8000-000000000202",
    source: "news",
    disruptionType: "port_closure",
    affectedRegions: ["US-CA"],
    geo: { kind: "regions", regionCodes: ["US-CA"] },
    severity: "high",
    delayDaysEstimate: 7,
    confidence: "high",
    detectedAt: "2026-07-13T12:00:00.000Z",
    rawRef: "integration:news",
    dedupeHash: dedupeHashes[1] ?? "",
    status: "active",
  }),
];

const adapter: SignalAdapter = {
  name: "integration-stub",
  fetch: async () => ({ ok: true, signals }),
};

const cleanIntegrationRows = async (): Promise<void> => {
  if (!integrationEnvPresent) {
    return;
  }

  const client = createSupabaseAdminClient();
  await client.from("signals").delete().in("dedupe_hash", dedupeHashes);
  await client.from("tick_logs").delete().in("id", tickIds);
};

const countIntegrationSignals = async (): Promise<number | null> => {
  const client = createSupabaseAdminClient();
  const { count, error } = await client
    .from("signals")
    .select("id", { count: "exact", head: true })
    .in("dedupe_hash", dedupeHashes);

  if (error !== null) {
    throw new Error(error.message);
  }

  return count;
};

afterEach(cleanIntegrationRows);

describe("signal monitor live DB idempotency", () => {
  integrationIt(
    integrationEnvPresent
      ? "keeps one row per dedupe hash after a second monitor run"
      : "skips because SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is missing",
    async () => {
      await cleanIntegrationRows();
      const client = createSupabaseAdminClient();
      const clock = fixedClock(systemClock.now());

      await runSignalMonitor(
        createRunContext({ clock, logger, tickId: tickIds[0] ?? "" }),
        { adapters: [adapter], client },
      );
      expect(await countIntegrationSignals()).toBe(2);
      await runSignalMonitor(
        createRunContext({ clock, logger, tickId: tickIds[1] ?? "" }),
        { adapters: [adapter], client },
      );
      expect(await countIntegrationSignals()).toBe(2);
    },
  );
});
