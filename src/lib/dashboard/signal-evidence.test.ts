import { describe, expect, it } from "vitest";

import {
  isHttpUrl,
  newsArticleUrl,
  openMeteoForecastUrl,
  parseStoredEvidence,
} from "@/lib/dashboard/signal-evidence";

describe("signal evidence helpers", () => {
  it("recognizes http source links only", () => {
    expect(isHttpUrl("https://example.test/a")).toBe(true);
    expect(isHttpUrl("open-meteo:Houston")).toBe(false);
  });

  it("prefers evidence articleUrl then raw_ref URL", () => {
    expect(
      newsArticleUrl({
        evidence: {
          title: "A",
          feedName: "FreightWaves",
          articleUrl: "https://example.test/from-evidence",
        },
        rawRef: "https://example.test/from-raw",
      }),
    ).toBe("https://example.test/from-evidence");
    expect(
      newsArticleUrl({
        evidence: null,
        rawRef: "https://example.test/from-raw",
      }),
    ).toBe("https://example.test/from-raw");
    expect(
      newsArticleUrl({
        evidence: { title: null, feedName: "FreightWaves", articleUrl: null },
        rawRef: "Port of Los Angeles closure",
      }),
    ).toBeNull();
  });

  it("builds Open-Meteo forecast links from stored coordinates", () => {
    expect(openMeteoForecastUrl(29.7604, -95.3698)).toContain(
      "latitude=29.7604",
    );
    expect(openMeteoForecastUrl(29.7604, -95.3698)).toContain(
      "longitude=-95.3698",
    );
  });

  it("rejects malformed evidence payloads", () => {
    expect(parseStoredEvidence("news", { title: "x" })).toBeNull();
    expect(
      parseStoredEvidence("weather", {
        windGust: 10,
        precipitation: 1,
        weatherCode: 1,
        thresholdRule: "gust 10 >= 40 -> storm/med",
        locationName: "Houston, Texas",
      }),
    ).toMatchObject({ windGust: 10 });
  });
});
