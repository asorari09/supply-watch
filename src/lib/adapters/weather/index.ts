import type { SignalAdapter, SignalAdapterResult } from "@/lib/adapters/types";
import {
  createOpenMeteoClient,
  MONITORED_LOCATIONS,
} from "@/lib/adapters/weather/client";
import type {
  MonitoredLocation,
  WeatherClient,
} from "@/lib/adapters/weather/client";
import { mapWireToSignals } from "@/lib/adapters/weather/map";
import type { RunContext } from "@/lib/runtime/run-context";

export interface OpenMeteoWeatherAdapterOptions {
  client?: WeatherClient;
  locations?: readonly MonitoredLocation[];
}

export class OpenMeteoWeatherAdapter implements SignalAdapter {
  readonly name = "open-meteo-weather";

  private readonly client: WeatherClient;
  private readonly locations: readonly MonitoredLocation[];

  constructor(options: OpenMeteoWeatherAdapterOptions = {}) {
    this.client = options.client ?? createOpenMeteoClient();
    this.locations = options.locations ?? MONITORED_LOCATIONS;
  }

  async fetch(ctx: RunContext): Promise<SignalAdapterResult> {
    try {
      const results = await Promise.all(
        this.locations.map(async (location) => ({
          location,
          result: await this.client.fetchForecast(location),
        })),
      );
      const successfulResults = results.filter(
        (
          entry,
        ): entry is {
          location: MonitoredLocation;
          result: { ok: true; wire: Parameters<typeof mapWireToSignals>[0] };
        } => entry.result.ok,
      );

      if (successfulResults.length === 0) {
        return {
          ok: false,
          degraded: true,
          reason: results
            .map((entry) =>
              entry.result.ok
                ? "Open-Meteo returned no usable data."
                : entry.result.reason,
            )
            .join(" "),
        };
      }

      const signals = successfulResults.flatMap(({ location, result }) =>
        mapWireToSignals(result.wire, location, ctx),
      );
      const degraded =
        successfulResults.length !== results.length ||
        signals.some((signal) => signal.status === "degraded");

      return degraded
        ? { ok: true, degraded: true, signals }
        : { ok: true, signals };
    } catch (error: unknown) {
      const reason =
        error instanceof Error ? error.message : "Open-Meteo adapter failed.";
      ctx.logger.error(
        "Open-Meteo adapter degraded after an unexpected failure.",
        {
          reason,
          tickId: ctx.tickId,
        },
      );
      return { ok: false, degraded: true, reason };
    }
  }
}

export const openMeteoWeatherAdapter = new OpenMeteoWeatherAdapter();
