import type { Database, Json } from "@/lib/db/database.types";
import type { Signal } from "@/lib/domain";

export const toSignalRow = (
  signal: Signal,
): Database["public"]["Tables"]["signals"]["Insert"] => ({
  id: signal.id,
  source: signal.source,
  disruption_type: signal.disruptionType,
  affected_regions: signal.affectedRegions,
  geo: signal.geo,
  severity: signal.severity,
  delay_days_estimate: signal.delayDaysEstimate,
  confidence: signal.confidence,
  detected_at: signal.detectedAt,
  ...(signal.expiresAt === undefined ? {} : { expires_at: signal.expiresAt }),
  raw_ref: signal.rawRef,
  dedupe_hash: signal.dedupeHash,
  status: signal.status,
  ...(signal.evidence === undefined
    ? {}
    : { evidence: signal.evidence as Json }),
});
