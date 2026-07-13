import { z } from "zod";

import {
  geoSchema,
  isoTimestampSchema,
  regionCodeSchema,
  uuidStringSchema,
} from "@/lib/domain/common";
import {
  severitySchema,
  signalSourceSchema,
  signalStatusSchema,
} from "@/lib/domain/enums";

export const signalSchema = z
  .object({
    id: uuidStringSchema,
    source: signalSourceSchema,
    disruptionType: z.string(),
    affectedRegions: z.array(regionCodeSchema),
    geo: geoSchema,
    severity: severitySchema,
    delayDaysEstimate: z.number().int().nonnegative(),
    confidence: z.string(),
    detectedAt: isoTimestampSchema,
    expiresAt: isoTimestampSchema.optional(),
    rawRef: z.string(),
    dedupeHash: z.string(),
    status: signalStatusSchema,
  })
  .strict();
export type Signal = z.infer<typeof signalSchema>;
export const signalInsertSchema = signalSchema.omit({ id: true });
