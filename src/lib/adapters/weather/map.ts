import { createHash } from "node:crypto";

import type { MonitoredLocation } from "@/lib/adapters/weather/client";
import type { OpenMeteoForecastWire } from "@/lib/adapters/weather/open-meteo.wire";
import { signalSchema } from "@/lib/domain";
import type { Signal } from "@/lib/domain";
import type { RunContext } from "@/lib/runtime/run-context";

interface WeatherThreshold {
  disruptionType: string;
  severity: "low" | "med" | "high";
  delayDaysEstimate: number;
  matches: (values: DailyWeatherValues) => boolean;
  describe: (values: DailyWeatherValues) => string;
}

interface DailyWeatherValues {
  windGustKph: number;
  precipitationMm: number;
  weatherCode: number;
}

// Ordered deterministic thresholds. The first matching disruption is emitted.
const weatherThresholds: readonly WeatherThreshold[] = [
  {
    disruptionType: "storm",
    severity: "high",
    delayDaysEstimate: 7,
    matches: ({ windGustKph }) => windGustKph >= 100,
    describe: ({ windGustKph }) => `gust ${windGustKph} >= 100 -> storm/high`,
  },
  {
    disruptionType: "flood",
    severity: "high",
    delayDaysEstimate: 5,
    matches: ({ precipitationMm }) => precipitationMm >= 50,
    describe: ({ precipitationMm }) =>
      `precipitation ${precipitationMm} >= 50 -> flood/high`,
  },
  {
    disruptionType: "storm",
    severity: "med",
    delayDaysEstimate: 4,
    matches: ({ windGustKph }) => windGustKph >= 40,
    describe: ({ windGustKph }) => `gust ${windGustKph} >= 40 -> storm/med`,
  },
  {
    disruptionType: "flood",
    severity: "med",
    delayDaysEstimate: 3,
    matches: ({ weatherCode }) => weatherCode >= 63,
    describe: ({ weatherCode }) =>
      `weatherCode ${weatherCode} >= 63 -> flood/med`,
  },
];

const stableHash = (value: string): string =>
  createHash("sha256").update(value).digest("hex");

const stableUuid = (value: string): string => {
  const hash = stableHash(value);
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-4${hash.slice(13, 16)}-8${hash.slice(17, 20)}-${hash.slice(20, 32)}`;
};

const dailyValues = (
  wire: OpenMeteoForecastWire,
): DailyWeatherValues | undefined => {
  const windGustKph = wire.daily.wind_gusts_10m_max?.[0];
  const precipitationMm = wire.daily.precipitation_sum?.[0];
  const weatherCode = wire.daily.weather_code?.[0];

  if (
    typeof windGustKph !== "number" ||
    typeof precipitationMm !== "number" ||
    typeof weatherCode !== "number" ||
    !Number.isFinite(windGustKph) ||
    !Number.isFinite(precipitationMm) ||
    !Number.isFinite(weatherCode)
  ) {
    return undefined;
  }

  return { windGustKph, precipitationMm, weatherCode };
};

const validatedSignal = (
  candidate: unknown,
  ctx: RunContext,
): Signal | undefined => {
  const parsed = signalSchema.safeParse(candidate);
  if (!parsed.success) {
    ctx.logger.warn("Dropping weather signal that failed domain validation.", {
      issues: parsed.error.issues.length,
      tickId: ctx.tickId,
    });
    return undefined;
  }

  return parsed.data;
};

const degradedSignal = (
  location: MonitoredLocation,
  ctx: RunContext,
): Signal | undefined => {
  const detectedAt = ctx.clock.now().toISOString();
  const canonical = `weather|${location.regionCode}|degraded|${detectedAt.slice(0, 10)}`;

  return validatedSignal(
    {
      id: stableUuid(canonical),
      source: "weather",
      disruptionType: "unknown_weather_data",
      affectedRegions: [location.regionCode],
      geo: { kind: "point", lat: location.lat, lon: location.lon },
      severity: "unknown",
      delayDaysEstimate: 0,
      confidence: "low",
      detectedAt,
      rawRef: `open-meteo:${location.name}`,
      dedupeHash: stableHash(canonical),
      status: "degraded",
    },
    ctx,
  );
};

export const mapWireToSignals = (
  wire: OpenMeteoForecastWire,
  location: MonitoredLocation,
  ctx: RunContext,
): Signal[] => {
  const values = dailyValues(wire);
  if (values === undefined) {
    const degraded = degradedSignal(location, ctx);
    return degraded === undefined ? [] : [degraded];
  }

  const threshold = weatherThresholds.find((entry) => entry.matches(values));
  if (threshold === undefined) {
    return [];
  }

  const detectedAt = ctx.clock.now().toISOString();
  const canonical = `weather|${location.regionCode}|${threshold.disruptionType}|${detectedAt.slice(0, 10)}`;
  const active = validatedSignal(
    {
      id: stableUuid(canonical),
      source: "weather",
      disruptionType: threshold.disruptionType,
      affectedRegions: [location.regionCode],
      geo: { kind: "point", lat: location.lat, lon: location.lon },
      severity: threshold.severity,
      delayDaysEstimate: threshold.delayDaysEstimate,
      confidence: "high",
      detectedAt,
      rawRef: `open-meteo:${location.name}:${wire.daily.time[0]}`,
      dedupeHash: stableHash(canonical),
      status: "active",
      evidence: {
        windGust: values.windGustKph,
        precipitation: values.precipitationMm,
        weatherCode: values.weatherCode,
        thresholdRule: threshold.describe(values),
        locationName: location.name,
      },
    },
    ctx,
  );

  return active === undefined ? [] : [active];
};
