import { z } from "zod";

import { isoTimestampSchema, uuidStringSchema } from "@/lib/domain/common";

export const reorderRecommendationSchema = z
  .object({
    id: uuidStringSchema,
    skuId: uuidStringSchema,
    riskFlagId: uuidStringSchema,
    ss: z.number().int().nonnegative(),
    rop: z.number().int().nonnegative(),
    inventoryPosition: z.number().int(),
    recommendedQty: z.number().int().nonnegative(),
    formulaBranch: z.string(),
    rationaleTemplate: z.string(),
    isInsufficientData: z.boolean(),
    inputsHash: z.string(),
    createdAt: isoTimestampSchema,
  })
  .strict();
export type ReorderRecommendation = z.infer<typeof reorderRecommendationSchema>;
export const reorderRecommendationInsertSchema =
  reorderRecommendationSchema.omit({ id: true, createdAt: true });
