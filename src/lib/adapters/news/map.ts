import { createHash } from "node:crypto";

import type { LlmCompletionClient } from "@/lib/adapters/llm/client";
import { preFilter, classify } from "@/lib/adapters/news/classify";
import { extractWithLlm } from "@/lib/adapters/news/extract-llm";
import type { NewsItemWire } from "@/lib/adapters/news/rss.wire";
import { env } from "@/lib/config/env";
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

export interface NewsLlmOptions {
  enableLlm?: boolean;
  llmClient?: LlmCompletionClient | undefined;
  maxLlm?: number;
}

export interface NewsMappingResult {
  signals: Signal[];
  llmCalls: number;
  estimatedCostUsd: number;
}

const GPT_4O_MINI_INPUT_OUTPUT_USD_PER_1K_TOKENS = 0.0006;

export const mapItemsToSignalsWithOptionalLlm = async (
  items: readonly NewsItemWire[],
  ctx: RunContext,
  options: NewsLlmOptions = {},
): Promise<NewsMappingResult> => {
  const enableLlm = options.enableLlm ?? env.ENABLE_LLM_NEWS;
  const maxLlm = options.maxLlm ?? env.MAX_NEWS_LLM_PER_TICK;
  let llmCalls = 0;
  const signals: Signal[] = [];

  for (const item of items) {
    if (!preFilter(item)) continue;
    const deterministic = classify(item);
    if (deterministic === null) continue;
    const extraction =
      enableLlm && llmCalls < maxLlm
        ? ((llmCalls += 1),
          await extractWithLlm(item, { client: options.llmClient }))
        : null;
    const classification =
      extraction === null
        ? deterministic
        : {
            ...deterministic,
            disruptionType: extraction.disruptionType,
            affectedRegions: extraction.affectedRegions,
            severity:
              extraction.severityHint === "unknown"
                ? deterministic.severity
                : extraction.severityHint,
          };
    const detectedAt = ctx.clock.now().toISOString();
    const key = item.link ?? item.title ?? "unidentified-news-item";
    const canonical = `news|${key}|${detectedAt.slice(0, 10)}`;
    const degraded = classification.affectedRegions.length === 0;
    const signal = validatedSignal(
      {
        id: stableUuid(canonical),
        source: "news",
        disruptionType: classification.disruptionType,
        affectedRegions: classification.affectedRegions,
        geo: { kind: "regions", regionCodes: classification.affectedRegions },
        severity: degraded ? "unknown" : classification.severity,
        delayDaysEstimate: classification.delayDaysEstimate,
        confidence: degraded ? "low" : "high",
        detectedAt,
        rawRef: key,
        dedupeHash: stableHash(canonical),
        status: degraded ? "degraded" : "active",
      },
      ctx,
    );
    if (signal !== undefined) signals.push(signal);
  }
  return {
    signals,
    llmCalls,
    estimatedCostUsd:
      ((llmCalls * 200) / 1000) * GPT_4O_MINI_INPUT_OUTPUT_USD_PER_1K_TOKENS,
  };
};
