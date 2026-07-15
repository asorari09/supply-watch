import { describe, expect, it } from "vitest";

import { toSignalRow } from "@/lib/db/mappers/signal.mapper";
import { signalSchema } from "@/lib/domain";

const signal = signalSchema.parse({
  id: "00000000-0000-4000-8000-000000000001",
  source: "weather",
  disruptionType: "storm",
  affectedRegions: ["US-TX"],
  geo: { kind: "point", lat: 29.7604, lon: -95.3698 },
  severity: "high",
  delayDaysEstimate: 7,
  confidence: "high",
  detectedAt: "2026-07-13T12:00:00.000Z",
  expiresAt: "2026-07-15T12:00:00.000Z",
  rawRef: "fixture:storm",
  dedupeHash: "weather-us-tx-storm-2026-07-13",
  status: "active",
  evidence: {
    windGust: 126.7,
    precipitation: 82.8,
    weatherCode: 65,
    thresholdRule: "gust 126.7 >= 100 -> storm/high",
    locationName: "Houston, Texas",
  },
});

describe("toSignalRow", () => {
  it("maps a domain Signal to exact snake_case persistence fields", () => {
    expect(toSignalRow(signal)).toEqual({
      id: "00000000-0000-4000-8000-000000000001",
      source: "weather",
      disruption_type: "storm",
      affected_regions: ["US-TX"],
      geo: { kind: "point", lat: 29.7604, lon: -95.3698 },
      severity: "high",
      delay_days_estimate: 7,
      confidence: "high",
      detected_at: "2026-07-13T12:00:00.000Z",
      expires_at: "2026-07-15T12:00:00.000Z",
      raw_ref: "fixture:storm",
      dedupe_hash: "weather-us-tx-storm-2026-07-13",
      status: "active",
      evidence: {
        windGust: 126.7,
        precipitation: 82.8,
        weatherCode: 65,
        thresholdRule: "gust 126.7 >= 100 -> storm/high",
        locationName: "Houston, Texas",
      },
    });
  });
});
