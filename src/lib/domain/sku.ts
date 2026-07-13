import { z } from "zod";

import { uuidStringSchema } from "@/lib/domain/common";

export const skuSchema = z
  .object({
    id: uuidStringSchema,
    sku: z.string(),
    supplierId: uuidStringSchema,
    onHand: z.number().int().nonnegative(),
    onOrder: z.number().int().nonnegative(),
    backorders: z.number().int().nonnegative(),
    avgDailyDemand: z.number().nonnegative(),
    demandStd: z.number().nonnegative(),
    unitCost: z.number().nonnegative(),
    holdingCost: z.number().nonnegative(),
    orderCost: z.number().nonnegative(),
    moq: z.number().int().nonnegative(),
    serviceLevelZ: z.number().nonnegative(),
  })
  .strict();
export type Sku = z.infer<typeof skuSchema>;
export const skuInsertSchema = skuSchema.omit({ id: true });
