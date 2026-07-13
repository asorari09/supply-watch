import { z } from "zod";

import { isoTimestampSchema, uuidStringSchema } from "@/lib/domain/common";
import { alertDeliveryViaSchema, alertLevelSchema } from "@/lib/domain/enums";

export const alertSchema = z
  .object({
    id: uuidStringSchema,
    riskFlagId: uuidStringSchema,
    level: alertLevelSchema,
    messageTemplate: z.string(),
    createdAt: isoTimestampSchema,
    deliveredVia: alertDeliveryViaSchema,
  })
  .strict();
export type Alert = z.infer<typeof alertSchema>;
export const alertInsertSchema = alertSchema.omit({
  id: true,
  createdAt: true,
});
