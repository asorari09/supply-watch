import { z } from "zod";

import {
  geoSchema,
  regionCodeSchema,
  uuidStringSchema,
} from "@/lib/domain/common";

export const supplierSchema = z
  .object({
    id: uuidStringSchema,
    name: z.string(),
    regionCode: regionCodeSchema,
    geo: geoSchema,
    leadTimeDaysBase: z.number().int().nonnegative(),
    leadTimeStdDays: z.number().int().nonnegative().optional(),
    reliability: z.number(),
  })
  .strict();
export type Supplier = z.infer<typeof supplierSchema>;
export const supplierInsertSchema = supplierSchema.omit({ id: true });
