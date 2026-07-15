import { createHash } from "node:crypto";

import type { LlmCompletionClient } from "@/lib/adapters/llm/client";
import { preFilter, classify } from "@/lib/adapters/news/classify";
import { extractWithLlm } from "@/lib/adapters/news/extract-llm";
import type { NewsItemWire } from "@/lib/adapters/news/rss.wire";
import { env } from "@/lib/config/env";
import { signalSchema } from "@/lib/domain";
import type { NewsSignalEvidence, Signal } from "@/lib/domain";
import type { RunContext } from "@/lib/runtime/run-context";

const stableHash = (value: string): string =>
  createHash("sha256").update(value).digest("hex");

const stableUuid = (value: string): string => {
  const hash = stableHash(value);
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-4${hash.slice(13, 16)}-8${hash.slice(17, 20)}-${hash.slice(20, 32)}`;
};

/** Display name from the real feed URL we fetched; hostname fallback for custom feeds. */
export const feedNameFromUrl = (feedUrl: string): string => {
  if (feedUrl.includes("freightwaves.com")) return "FreightWaves";
  if (feedUrl.includes("supplychaindive.com")) return "Supply Chain Dive";
  try {
    return new URL(feedUrl).hostname;
  } catch {
    return feedUrl;
  }
};

export interface NewsItemSource {
  item: NewsItemWire;
  feedName: string;
}

const newsEvidence = (
  item: NewsItemWire,
  feedName: string,
): NewsSignalEvidence => ({
  title: item.title ?? null,
  feedName,
  articleUrl: item.link ?? null,
});

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

const buildNewsSignal = (
  source: NewsItemSource,
  classification: {
    disruptionType: string;
    affectedRegions: string[];
    severity: "low" | "med" | "high";
    delayDaysEstimate: number;
  },
  ctx: RunContext,
): Signal | undefined => {
  const { item, feedName } = source;
  const detectedAt = ctx.clock.now().toISOString();
  const canonicalItemKey = item.link ?? item.title ?? "unidentified-news-item";
  const canonical = `news|${canonicalItemKey}|${detectedAt.slice(0, 10)}`;
  const isDegraded = classification.affectedRegions.length === 0;
  return validatedSignal(
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
      evidence: newsEvidence(item, feedName),
    },
    ctx,
  );
};

export const mapItemsToSignals = (
  sources: readonly NewsItemSource[],
  ctx: RunContext,
): Signal[] =>
  sources.flatMap((source) => {
    if (!preFilter(source.item)) {
      return [];
    }

    const classification = classify(source.item);
    if (classification === null) {
      return [];
    }

    const signal = buildNewsSignal(source, classification, ctx);
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
  sources: readonly NewsItemSource[],
  ctx: RunContext,
  options: NewsLlmOptions = {},
): Promise<NewsMappingResult> => {
  const enableLlm = options.enableLlm ?? env.ENABLE_LLM_NEWS;
  const maxLlm = options.maxLlm ?? env.MAX_NEWS_LLM_PER_TICK;
  let llmCalls = 0;
  const signals: Signal[] = [];

  for (const source of sources) {
    if (!preFilter(source.item)) continue;
    const deterministic = classify(source.item);
    if (deterministic === null) continue;
    const extraction =
      enableLlm && llmCalls < maxLlm
        ? ((llmCalls += 1),
          await extractWithLlm(source.item, { client: options.llmClient }))
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
    const signal = buildNewsSignal(source, classification, ctx);
    if (signal !== undefined) signals.push(signal);
  }
  return {
    signals,
    llmCalls,
    estimatedCostUsd:
      ((llmCalls * 200) / 1000) * GPT_4O_MINI_INPUT_OUTPUT_USD_PER_1K_TOKENS,
  };
};
