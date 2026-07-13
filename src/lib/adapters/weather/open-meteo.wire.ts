import { z } from "zod";

const dailySchema = z
  .object({
    time: z.array(z.string()).min(1),
    wind_gusts_10m_max: z.array(z.number()).optional(),
    precipitation_sum: z.array(z.number()).optional(),
    weather_code: z.array(z.number()).optional(),
  })
  .passthrough();

export const openMeteoForecastWireSchema = z
  .object({
    latitude: z.number(),
    longitude: z.number(),
    daily: dailySchema,
  })
  .passthrough();

export type OpenMeteoForecastWire = z.infer<typeof openMeteoForecastWireSchema>;
