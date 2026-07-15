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

/** News provenance captured at ingest. Values may be null when the wire lacked them. */
export const newsSignalEvidenceSchema = z
  .object({
    title: z.string().nullable(),
    feedName: z.string().min(1),
    articleUrl: z.string().nullable(),
  })
  .strict();
export type NewsSignalEvidence = z.infer<typeof newsSignalEvidenceSchema>;

/** Weather provenance: measured day-0 values and the threshold rule that fired. */
export const weatherSignalEvidenceSchema = z
  .object({
    windGust: z.number(),
    precipitation: z.number(),
    weatherCode: z.number(),
    thresholdRule: z.string().min(1),
    locationName: z.string().min(1),
  })
  .strict();
export type WeatherSignalEvidence = z.infer<typeof weatherSignalEvidenceSchema>;

export const signalEvidenceSchema = z.union([
  newsSignalEvidenceSchema,
  weatherSignalEvidenceSchema,
]);
export type SignalEvidence = z.infer<typeof signalEvidenceSchema>;

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
    evidence: signalEvidenceSchema.optional(),
  })
  .strict();
export type Signal = z.infer<typeof signalSchema>;
export const signalInsertSchema = signalSchema.omit({ id: true });
