import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { RssNewsAdapter } from "@/lib/adapters/news";
import {
  classify,
  preFilter,
  REGION_KEYWORDS,
} from "@/lib/adapters/news/classify";
import {
  createRssClient,
  parseNewsXml,
  type FetchLike,
  type NewsClient,
} from "@/lib/adapters/news/client";
import { mapItemsToSignals } from "@/lib/adapters/news/map";
import type { NewsItemWire } from "@/lib/adapters/news/rss.wire";
import { signalSchema } from "@/lib/domain";
import { fixedClock, systemClock } from "@/lib/runtime/clock";
import type { Logger } from "@/lib/runtime/logger";
import { createRunContext } from "@/lib/runtime/run-context";

const readFixture = (filename: string): string =>
  readFileSync(new URL(`./__fixtures__/${filename}`, import.meta.url), "utf8");

const realRssXml = readFixture("real-freightwaves-rss.xml");
const activeXml = readFixture("active-port-closure.xml");
const regionlessXml = readFixture("regionless-closure.xml");
const irrelevantXml = readFixture("irrelevant.xml");
const atomActiveXml = readFixture("atom-active.xml");
const malformedXml = readFixture("malformed.xml");

const itemsFrom = (xml: string) => {
  const parsed = parseNewsXml(xml);
  if (!parsed.ok) {
    throw new Error(parsed.reason);
  }

  return parsed.items;
};

const firstItemFrom = (xml: string): NewsItemWire => {
  const item = itemsFrom(xml)[0];
  if (item === undefined) {
    throw new Error("Fixture must contain one normalized news item.");
  }

  return item;
};

const logger: Logger = {
  info: () => undefined,
  warn: () => undefined,
  error: () => undefined,
};

const fixedInstant = systemClock.now();
fixedInstant.setTime(Date.parse("2026-07-13T12:00:00.000Z"));
const context = createRunContext({
  clock: fixedClock(fixedInstant),
  logger,
  mode: "replay",
  tickId: "00000000-0000-4000-8000-000000000001",
});

describe("RSS and Atom wire normalization", () => {
  it("parses a captured real RSS fixture and a normalized Atom fixture", () => {
    expect(parseNewsXml(realRssXml)).toMatchObject({ ok: true });
    expect(parseNewsXml(atomActiveXml)).toMatchObject({ ok: true });
  });

  it("fails closed for malformed XML", () => {
    expect(parseNewsXml(malformedXml)).toMatchObject({
      ok: false,
      reason: "RSS body is not valid XML.",
    });
  });
});

describe("deterministic pre-filter and classifier", () => {
  const activeItem = firstItemFrom(activeXml);
  const regionlessItem = firstItemFrom(regionlessXml);
  const irrelevantItem = firstItemFrom(irrelevantXml);

  it("passes relevant items and drops irrelevant items before classification", () => {
    expect(preFilter(activeItem)).toBe(true);
    expect(preFilter(irrelevantItem)).toBe(false);
  });

  it("classifies a known port closure with an exact region", () => {
    expect(classify(activeItem)).toEqual({
      disruptionType: "port_closure",
      severity: "high",
      delayDaysEstimate: 7,
      affectedRegions: ["US-CA"],
    });
  });

  it("returns no affected regions when a disruption has no resolvable region", () => {
    expect(classify(regionlessItem)).toMatchObject({ affectedRegions: [] });
    expect(REGION_KEYWORDS["los angeles"]).toBe("US-CA");
    expect(REGION_KEYWORDS.shanghai).toBe("CN");
    expect(REGION_KEYWORDS.rotterdam).toBe("NL");
  });
});

describe("mapItemsToSignals", () => {
  const activeItem = itemsFrom(activeXml);
  const regionlessItem = itemsFrom(regionlessXml);
  const irrelevantItem = itemsFrom(irrelevantXml);

  it("maps a resolvable disruption to an active domain signal", () => {
    const [signal] = mapItemsToSignals(activeItem, context);

    expect(signal).toMatchObject({
      source: "news",
      disruptionType: "port_closure",
      severity: "high",
      delayDaysEstimate: 7,
      affectedRegions: ["US-CA"],
      status: "active",
    });
    expect(signalSchema.safeParse(signal).success).toBe(true);
  });

  it("maps a regionless disruption to a degraded signal", () => {
    const [signal] = mapItemsToSignals(regionlessItem, context);

    expect(signal).toMatchObject({
      status: "degraded",
      severity: "unknown",
      confidence: "low",
      affectedRegions: [],
    });
  });

  it("emits no signal for an item dropped by the pre-filter", () => {
    expect(mapItemsToSignals(irrelevantItem, context)).toEqual([]);
  });

  it("uses a stable dedupe hash for the same item and injected clock", () => {
    const first = mapItemsToSignals(activeItem, context);
    const second = mapItemsToSignals(activeItem, context);

    expect(first[0]?.dedupeHash).toBe(second[0]?.dedupeHash);
  });
});

describe("RssNewsAdapter degrade-not-throw", () => {
  const allFailedClient: NewsClient = {
    fetchFeed: async () => ({
      ok: false,
      reason: "RSS feed request timed out.",
    }),
  };

  it("degrades without throwing when all feeds fail", async () => {
    const adapter = new RssNewsAdapter({
      client: allFailedClient,
      feeds: ["https://example.test/one", "https://example.test/two"],
    });

    await expect(adapter.fetch(context)).resolves.toMatchObject({
      ok: false,
      degraded: true,
    });
  });

  it("returns successful degraded output when one feed fails and one succeeds", async () => {
    const activeItems = itemsFrom(activeXml);
    const mixedClient: NewsClient = {
      fetchFeed: async (feedUrl: string) =>
        feedUrl.endsWith("good")
          ? { ok: true, items: activeItems }
          : { ok: false, reason: "RSS feed returned HTTP 503." },
    };
    const adapter = new RssNewsAdapter({
      client: mixedClient,
      feeds: ["https://example.test/bad", "https://example.test/good"],
    });

    await expect(adapter.fetch(context)).resolves.toMatchObject({
      ok: true,
      degraded: true,
    });
  });

  it("degrades without throwing when a feed body is malformed", async () => {
    const fetchImpl: FetchLike = async () =>
      new Response(malformedXml, { status: 200 });
    const adapter = new RssNewsAdapter({
      client: createRssClient({
        fetchImpl,
        retries: 0,
        sleep: async () => undefined,
      }),
      feeds: ["https://example.test/malformed"],
    });

    await expect(adapter.fetch(context)).resolves.toMatchObject({
      ok: false,
      degraded: true,
      reason: "RSS body is not valid XML.",
    });
  });
});
