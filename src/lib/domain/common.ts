import { z } from "zod";

export const regionCodeSchema = z
  .string()
  .min(1)
  .regex(/^[A-Z]{2}(-[A-Z0-9]{1,3})?$/)
  .brand<"RegionCode">();
export type RegionCode = z.infer<typeof regionCodeSchema>;

export const uuidStringSchema = z.string().uuid();
export type UuidString = z.infer<typeof uuidStringSchema>;

export const isoTimestampSchema = z.string().datetime({ offset: true });
export type IsoTimestamp = z.infer<typeof isoTimestampSchema>;

const pointGeoSchema = z
  .object({
    kind: z.literal("point"),
    lat: z.number().min(-90).max(90),
    lon: z.number().min(-180).max(180),
  })
  .strict();

const bboxGeoSchema = z
  .object({
    kind: z.literal("bbox"),
    minLat: z.number().min(-90).max(90),
    minLon: z.number().min(-180).max(180),
    maxLat: z.number().min(-90).max(90),
    maxLon: z.number().min(-180).max(180),
  })
  .strict();

const regionsGeoSchema = z
  .object({
    kind: z.literal("regions"),
    regionCodes: z.array(regionCodeSchema),
  })
  .strict();

export const geoSchema = z.union([
  pointGeoSchema,
  bboxGeoSchema,
  regionsGeoSchema,
]);
export type Geo = z.infer<typeof geoSchema>;
