import { z } from "zod";

import {
  geoSchema,
  isoTimestampSchema,
  regionCodeSchema,
  uuidStringSchema,
} from "@/lib/domain/common";
import { shipmentStatusSchema } from "@/lib/domain/enums";

export const shipmentSchema = z
  .object({
    id: uuidStringSchema,
    skuId: uuidStringSchema,
    supplierId: uuidStringSchema,
    originGeo: geoSchema,
    destGeo: geoSchema,
    routeRegions: z.array(regionCodeSchema),
    eta: isoTimestampSchema,
    qty: z.number().int().nonnegative(),
    status: shipmentStatusSchema,
  })
  .strict();
export type Shipment = z.infer<typeof shipmentSchema>;
export const shipmentInsertSchema = shipmentSchema.omit({ id: true });
