import { describe, expect, it } from "vitest";

import { OpenMeteoWeatherAdapter } from "@/lib/adapters/weather";
import missingClassificationField from "@/lib/adapters/weather/__fixtures__/missing-classification-field.json";
import missingRequiredDailyField from "@/lib/adapters/weather/__fixtures__/missing-required-daily-field.json";
import normalHouston from "@/lib/adapters/weather/__fixtures__/normal-houston.json";
import stormHoustonBeryl from "@/lib/adapters/weather/__fixtures__/storm-houston-beryl.json";
import wrongShape from "@/lib/adapters/weather/__fixtures__/wrong-shape.json";
import {
  createOpenMeteoClient,
  type FetchLike,
  type MonitoredLocation,
} from "@/lib/adapters/weather/client";
import { mapWireToSignals } from "@/lib/adapters/weather/map";
import { openMeteoForecastWireSchema } from "@/lib/adapters/weather/open-meteo.wire";
import { signalSchema } from "@/lib/domain";
import { fixedClock, systemClock } from "@/lib/runtime/clock";
import type { Logger } from "@/lib/runtime/logger";
import { createRunContext } from "@/lib/runtime/run-context";

const location: MonitoredLocation = {
  name: "Houston, Texas",
  regionCode: "US-TX",
  lat: 29.7604,
  lon: -95.3698,
};

const logger: Logger = {
  info: () => undefined,
  warn: () => undefined,
  error: () => undefined,
};

const fixedInstant = systemClock.now();
fixedInstant.setTime(Date.parse("2026-07-13T12:00:00.000Z"));
const context = createRunContext({
  clock: fixedClock(fixedInstant),
  logger,
  mode: "replay",
  tickId: "00000000-0000-4000-8000-000000000001",
});

const parseFixture = (fixture: unknown) =>
  openMeteoForecastWireSchema.parse(fixture);

describe("Open-Meteo wire schema", () => {
  it("parses a captured Open-Meteo response", () => {
    expect(openMeteoForecastWireSchema.safeParse(normalHouston).success).toBe(
      true,
    );
  });

  it("rejects fixtures missing required wire data or with a wrong shape", () => {
    expect(
      openMeteoForecastWireSchema.safeParse(missingRequiredDailyField).success,
    ).toBe(false);
    expect(openMeteoForecastWireSchema.safeParse(wrongShape).success).toBe(
      false,
    );
  });
});

describe("mapWireToSignals", () => {
  it("maps the captured Houston forecast to a deterministic medium flood signal", () => {
    const [signal] = mapWireToSignals(
      parseFixture(normalHouston),
      location,
      context,
    );

    expect(signal).toMatchObject({
      disruptionType: "flood",
      severity: "med",
      delayDaysEstimate: 3,
      status: "active",
    });
    expect(signalSchema.safeParse(signal).success).toBe(true);
  });

  it("maps the captured Hurricane Beryl response to a high storm signal", () => {
    const [signal] = mapWireToSignals(
      parseFixture(stormHoustonBeryl),
      location,
      context,
    );

    expect(signal).toMatchObject({
      disruptionType: "storm",
      severity: "high",
      delayDaysEstimate: 7,
      status: "active",
    });
  });

  it("emits a degraded signal when a classification field is missing", () => {
    const signals = mapWireToSignals(
      parseFixture(missingClassificationField),
      location,
      context,
    );

    expect(signals).toHaveLength(1);
    expect(signals[0]).toMatchObject({
      status: "degraded",
      severity: "unknown",
      confidence: "low",
    });
  });

  it("uses a stable dedupe hash for the same fixture and injected clock", () => {
    const first = mapWireToSignals(
      parseFixture(normalHouston),
      location,
      context,
    );
    const second = mapWireToSignals(
      parseFixture(normalHouston),
      location,
      context,
    );

    expect(first[0]?.dedupeHash).toBe(second[0]?.dedupeHash);
  });
});

describe("OpenMeteoWeatherAdapter degrade-not-throw", () => {
  const failureAdapter = (fetchImpl: FetchLike) =>
    new OpenMeteoWeatherAdapter({
      client: createOpenMeteoClient({
        fetchImpl,
        retries: 0,
        sleep: async () => undefined,
      }),
      locations: [location],
    });

  it("degrades without throwing on a timeout", async () => {
    const timeoutError = new Error("timeout");
    timeoutError.name = "AbortError";
    const adapter = failureAdapter(async () => Promise.reject(timeoutError));

    await expect(adapter.fetch(context)).resolves.toMatchObject({
      ok: false,
      degraded: true,
      reason: "Open-Meteo request timed out.",
    });
  });

  it("degrades without throwing on a non-200 response", async () => {
    const adapter = failureAdapter(
      async () => new Response("unavailable", { status: 503 }),
    );

    await expect(adapter.fetch(context)).resolves.toMatchObject({
      ok: false,
      degraded: true,
      reason: "Open-Meteo returned HTTP 503.",
    });
  });

  it("degrades without throwing on a malformed response body", async () => {
    const adapter = failureAdapter(
      async () => new Response(JSON.stringify(wrongShape), { status: 200 }),
    );

    await expect(adapter.fetch(context)).resolves.toMatchObject({
      ok: false,
      degraded: true,
      reason: "Open-Meteo returned a malformed body.",
    });
  });
});
