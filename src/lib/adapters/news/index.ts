import { createNewsLlmClient } from "@/lib/adapters/llm/client";
import { createRssClient, getNewsFeeds } from "@/lib/adapters/news/client";
import type { NewsClient, NewsClientSuccess } from "@/lib/adapters/news/client";
import {
  feedNameFromUrl,
  mapItemsToSignalsWithOptionalLlm,
} from "@/lib/adapters/news/map";
import type { SignalAdapter, SignalAdapterResult } from "@/lib/adapters/types";
import { env } from "@/lib/config/env";
import type { RunContext } from "@/lib/runtime/run-context";

export interface RssNewsAdapterOptions {
  client?: NewsClient;
  feeds?: readonly string[];
}

export class RssNewsAdapter implements SignalAdapter {
  readonly name = "rss-news";

  private readonly client: NewsClient;
  private readonly feeds: readonly string[];

  constructor(options: RssNewsAdapterOptions = {}) {
    this.client = options.client ?? createRssClient();
    this.feeds = options.feeds ?? getNewsFeeds();
  }

  async fetch(ctx: RunContext): Promise<SignalAdapterResult> {
    try {
      const results = await Promise.all(
        this.feeds.map(async (feed) => ({
          feed,
          result: await this.client.fetchFeed(feed),
        })),
      );
      const successfulResults = results.filter(
        (entry): entry is { feed: string; result: NewsClientSuccess } =>
          entry.result.ok,
      );

      if (successfulResults.length === 0) {
        return {
          ok: false,
          degraded: true,
          reason: results
            .map((entry) =>
              entry.result.ok
                ? "RSS feed returned no usable items."
                : entry.result.reason,
            )
            .join(" "),
        };
      }

      const mapping = await mapItemsToSignalsWithOptionalLlm(
        successfulResults.flatMap(({ feed, result }) =>
          result.items.map((item) => ({
            item,
            feedName: feedNameFromUrl(feed),
          })),
        ),
        ctx,
        {
          enableLlm: env.ENABLE_LLM_NEWS,
          maxLlm: env.MAX_NEWS_LLM_PER_TICK,
          llmClient: createNewsLlmClient(),
        },
      );
      const signals = mapping.signals;
      const degraded =
        successfulResults.length !== results.length ||
        signals.some((signal) => signal.status === "degraded");

      return degraded
        ? { ok: true, degraded: true, signals }
        : { ok: true, signals };
    } catch (error: unknown) {
      const reason =
        error instanceof Error ? error.message : "RSS news adapter failed.";
      ctx.logger.error(
        "RSS news adapter degraded after an unexpected failure.",
        {
          reason,
          tickId: ctx.tickId,
        },
      );
      return { ok: false, degraded: true, reason };
    }
  }
}

export const rssNewsAdapter = new RssNewsAdapter();
