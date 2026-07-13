import { z } from "zod";

import { isoTimestampSchema, uuidStringSchema } from "@/lib/domain/common";
import { commsDraftStatusSchema } from "@/lib/domain/enums";

export const commsDraftSchema = z
  .object({
    id: uuidStringSchema,
    riskFlagId: uuidStringSchema,
    recommendationId: uuidStringSchema,
    generation: z.number().int().nonnegative(),
    subject: z.string(),
    body: z.string(),
    tone: z.string(),
    modelUsed: z.string(),
    status: commsDraftStatusSchema,
    sentAt: isoTimestampSchema.optional(),
    tickId: uuidStringSchema,
    createdAt: isoTimestampSchema,
  })
  .strict();
export type CommsDraft = z.infer<typeof commsDraftSchema>;
export const commsDraftInsertSchema = commsDraftSchema.omit({
  id: true,
  createdAt: true,
});
