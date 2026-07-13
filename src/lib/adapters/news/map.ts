import { createHash } from "node:crypto";

import { preFilter, classify } from "@/lib/adapters/news/classify";
import type { NewsItemWire } from "@/lib/adapters/news/rss.wire";
import { signalSchema } from "@/lib/domain";
import type { Signal } from "@/lib/domain";
import type { RunContext } from "@/lib/runtime/run-context";

const stableHash = (value: string): string =>
  createHash("sha256").update(value).digest("hex");

const stableUuid = (value: string): string => {
  const hash = stableHash(value);
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-4${hash.slice(13, 16)}-8${hash.slice(17, 20)}-${hash.slice(20, 32)}`;
};

const validatedSignal = (
  candidate: unknown,
  ctx: RunContext,
): Signal | undefined => {
  const parsed = signalSchema.safeParse(candidate);
  if (!parsed.success) {
    ctx.logger.warn("Dropping news signal that failed domain validation.", {
      issues: parsed.error.issues.length,
      tickId: ctx.tickId,
    });
    return undefined;
  }

  return parsed.data;
};

export const mapItemsToSignals = (
  items: readonly NewsItemWire[],
  ctx: RunContext,
): Signal[] =>
  items.flatMap((item) => {
    if (!preFilter(item)) {
      return [];
    }

    const classification = classify(item);
    if (classification === null) {
      return [];
    }

    const detectedAt = ctx.clock.now().toISOString();
    const canonicalItemKey =
      item.link ?? item.title ?? "unidentified-news-item";
    const canonical = `news|${canonicalItemKey}|${detectedAt.slice(0, 10)}`;
    const isDegraded = classification.affectedRegions.length === 0;
    const signal = validatedSignal(
      {
        id: stableUuid(canonical),
        source: "news",
        disruptionType: classification.disruptionType,
        affectedRegions: classification.affectedRegions,
        geo: { kind: "regions", regionCodes: classification.affectedRegions },
        severity: isDegraded ? "unknown" : classification.severity,
        delayDaysEstimate: classification.delayDaysEstimate,
        confidence: isDegraded ? "low" : "high",
        detectedAt,
        rawRef: canonicalItemKey,
        dedupeHash: stableHash(canonical),
        status: isDegraded ? "degraded" : "active",
      },
      ctx,
    );

    return signal === undefined ? [] : [signal];
  });
