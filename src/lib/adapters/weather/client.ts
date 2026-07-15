import { openMeteoForecastWireSchema } from "@/lib/adapters/weather/open-meteo.wire";
import type { OpenMeteoForecastWire } from "@/lib/adapters/weather/open-meteo.wire";

export interface MonitoredLocation {
  name: string;
  regionCode: string;
  lat: number;
  lon: number;
}

export const MONITORED_LOCATIONS: readonly MonitoredLocation[] = [
  { name: "Houston, Texas", regionCode: "US-TX", lat: 29.7604, lon: -95.3698 },
  {
    name: "Long Beach, California",
    regionCode: "US-CA",
    lat: 33.7701,
    lon: -118.1937,
  },
  { name: "Shenzhen, China", regionCode: "CN", lat: 22.5431, lon: 114.0579 },
  { name: "Frankfurt, Germany", regionCode: "DE", lat: 50.1109, lon: 8.6821 },
  { name: "Monterrey, Mexico", regionCode: "MX", lat: 25.6866, lon: -100.3161 },
  { name: "Tokyo, Japan", regionCode: "JP", lat: 35.6762, lon: 139.6503 },
];

export interface WeatherClientSuccess {
  ok: true;
  wire: OpenMeteoForecastWire;
}

export interface WeatherClientFailure {
  ok: false;
  reason: string;
}

export type WeatherClientResult = WeatherClientSuccess | WeatherClientFailure;

export interface WeatherClient {
  fetchForecast(location: MonitoredLocation): Promise<WeatherClientResult>;
}

export type FetchLike = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>;

export interface OpenMeteoClientOptions {
  baseUrl?: string;
  fetchImpl?: FetchLike;
  retries?: number;
  sleep?: (milliseconds: number) => Promise<void>;
  timeoutMs?: number;
}

const defaultBaseUrl = "https://api.open-meteo.com/v1/forecast";
const defaultTimeoutMs = 8000;
const defaultRetries = 2;

const readPositiveInteger = (
  value: string | undefined,
  fallback: number,
): number => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
};

const defaultSleep = async (milliseconds: number): Promise<void> => {
  await new Promise<void>((resolve) => {
    setTimeout(resolve, milliseconds);
  });
};

export const buildOpenMeteoUrl = (
  location: MonitoredLocation,
  baseUrl: string = process.env.OPEN_METEO_BASE_URL ?? defaultBaseUrl,
): string => {
  const url = new URL(baseUrl);
  url.searchParams.set("latitude", String(location.lat));
  url.searchParams.set("longitude", String(location.lon));
  url.searchParams.set(
    "daily",
    "wind_gusts_10m_max,precipitation_sum,weather_code",
  );
  url.searchParams.set("timezone", "UTC");
  return url.toString();
};

const resolveBaseUrl = (value: string | undefined): string =>
  value !== undefined && value.trim().length > 0
    ? value.trim()
    : defaultBaseUrl;

export const createOpenMeteoClient = (
  options: OpenMeteoClientOptions = {},
): WeatherClient => {
  const fetchImpl = options.fetchImpl ?? fetch;
  const baseUrl = resolveBaseUrl(
    options.baseUrl ?? process.env.OPEN_METEO_BASE_URL,
  );
  const timeoutMs =
    options.timeoutMs ??
    readPositiveInteger(process.env.WEATHER_TIMEOUT_MS, defaultTimeoutMs);
  const retries =
    options.retries ??
    readPositiveInteger(process.env.WEATHER_RETRIES, defaultRetries);
  const sleep = options.sleep ?? defaultSleep;

  return {
    fetchForecast: async (
      location: MonitoredLocation,
    ): Promise<WeatherClientResult> => {
      let lastReason = "Open-Meteo request did not complete.";

      for (let attempt = 0; attempt <= retries; attempt += 1) {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), timeoutMs);

        try {
          const response = await fetchImpl(
            buildOpenMeteoUrl(location, baseUrl),
            {
              signal: controller.signal,
            },
          );

          if (!response.ok) {
            lastReason = `Open-Meteo returned HTTP ${response.status}.`;
          } else {
            const parsed = openMeteoForecastWireSchema.safeParse(
              await response.json(),
            );
            if (parsed.success) {
              return { ok: true, wire: parsed.data };
            }
            return {
              ok: false,
              reason: "Open-Meteo returned a malformed body.",
            };
          }
        } catch (error: unknown) {
          lastReason =
            error instanceof Error && error.name === "AbortError"
              ? "Open-Meteo request timed out."
              : "Open-Meteo network request failed.";
        } finally {
          clearTimeout(timeout);
        }

        if (attempt < retries) {
          await sleep(300 * 2 ** attempt);
        }
      }

      return { ok: false, reason: lastReason };
    },
  };
};
