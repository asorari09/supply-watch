import { z } from "zod";

import { isoTimestampSchema, uuidStringSchema } from "@/lib/domain/common";
import { tickModeSchema, tickTriggerSourceSchema } from "@/lib/domain/enums";

export const tickLogSchema = z
  .object({
    id: uuidStringSchema,
    triggerSource: tickTriggerSourceSchema,
    mode: tickModeSchema,
    clockNow: isoTimestampSchema,
    counts: z.record(z.string(), z.unknown()),
    durationMs: z.number().int().nonnegative(),
    estCostUsd: z.number().nonnegative(),
    createdAt: isoTimestampSchema,
  })
  .strict();
export type TickLog = z.infer<typeof tickLogSchema>;
export const tickLogInsertSchema = tickLogSchema.omit({
  id: true,
  createdAt: true,
});
