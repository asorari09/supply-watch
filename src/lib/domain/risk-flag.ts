import { z } from "zod";

import { isoTimestampSchema, uuidStringSchema } from "@/lib/domain/common";
import {
  exposureTypeSchema,
  riskFlagStatusSchema,
  severitySchema,
} from "@/lib/domain/enums";

export const riskFlagSchema = z
  .object({
    id: uuidStringSchema,
    signalId: uuidStringSchema,
    shipmentId: uuidStringSchema.optional(),
    skuId: uuidStringSchema,
    exposureType: exposureTypeSchema,
    computedLeadTimeDelta: z.number().int().nonnegative(),
    severity: severitySchema,
    status: riskFlagStatusSchema,
    createdAt: isoTimestampSchema,
    tickId: uuidStringSchema,
  })
  .strict();
export type RiskFlag = z.infer<typeof riskFlagSchema>;
export const riskFlagInsertSchema = riskFlagSchema.omit({
  id: true,
  createdAt: true,
});
