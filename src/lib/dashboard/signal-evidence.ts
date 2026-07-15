import {
  geoSchema,
  newsSignalEvidenceSchema,
  weatherSignalEvidenceSchema,
  type Geo,
  type NewsSignalEvidence,
  type WeatherSignalEvidence,
} from "@/lib/domain";

export type DashboardSignalEvidence =
  NewsSignalEvidence | WeatherSignalEvidence;

export const isHttpUrl = (value: string): boolean =>
  value.startsWith("https://") || value.startsWith("http://");

export const parseStoredGeo = (value: unknown): Geo | null => {
  const parsed = geoSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
};

export const parseStoredEvidence = (
  source: "news" | "weather",
  value: unknown,
): DashboardSignalEvidence | null => {
  if (value === null || value === undefined) return null;
  if (source === "news") {
    const parsed = newsSignalEvidenceSchema.safeParse(value);
    return parsed.success ? parsed.data : null;
  }
  const parsed = weatherSignalEvidenceSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
};

/** Human Open-Meteo docs page for a stored monitored-location coordinate. */
export const openMeteoForecastUrl = (lat: number, lon: number): string =>
  `https://open-meteo.com/en/docs#latitude=${encodeURIComponent(String(lat))}&longitude=${encodeURIComponent(String(lon))}&daily=weather_code,precipitation_sum,wind_gusts_10m_max&timezone=auto`;

export const newsArticleUrl = (input: {
  evidence: NewsSignalEvidence | null;
  rawRef: string;
}): string | null => {
  if (
    input.evidence?.articleUrl !== null &&
    input.evidence?.articleUrl !== undefined
  ) {
    const fromEvidence = input.evidence.articleUrl.trim();
    if (fromEvidence.length > 0 && isHttpUrl(fromEvidence)) return fromEvidence;
  }
  const fromRaw = input.rawRef.trim();
  if (fromRaw.length > 0 && isHttpUrl(fromRaw)) return fromRaw;
  return null;
};

export const isNewsEvidence = (
  evidence: DashboardSignalEvidence | null,
): evidence is NewsSignalEvidence =>
  evidence !== null && "feedName" in evidence && "articleUrl" in evidence;

export const isWeatherEvidence = (
  evidence: DashboardSignalEvidence | null,
): evidence is WeatherSignalEvidence =>
  evidence !== null && "thresholdRule" in evidence && "windGust" in evidence;
