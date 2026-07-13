import { XMLParser, XMLValidator } from "fast-xml-parser";

import {
  normalizedNewsFeedWireSchema,
  type NewsItemWire,
} from "@/lib/adapters/news/rss.wire";

export const NEWS_FEEDS = [
  "https://www.freightwaves.com/feed",
  "https://www.supplychaindive.com/feeds/news/",
] as const;

export interface NewsClientSuccess {
  ok: true;
  items: NewsItemWire[];
}

export interface NewsClientFailure {
  ok: false;
  reason: string;
}

export type NewsClientResult = NewsClientSuccess | NewsClientFailure;

export interface NewsClient {
  fetchFeed(feedUrl: string): Promise<NewsClientResult>;
}

export type FetchLike = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>;

export interface RssClientOptions {
  fetchImpl?: FetchLike;
  retries?: number;
  sleep?: (milliseconds: number) => Promise<void>;
  timeoutMs?: number;
}

const defaultTimeoutMs = 8000;
const defaultRetries = 2;
const xmlParser = new XMLParser({
  ignoreAttributes: false,
  parseTagValue: false,
  trimValues: true,
});

const readPositiveInteger = (
  value: string | undefined,
  fallback: number,
): number => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
};

const defaultSleep = async (milliseconds: number): Promise<void> => {
  await new Promise<void>((resolve) => {
    setTimeout(resolve, milliseconds);
  });
};

const asRecord = (value: unknown): Record<string, unknown> | undefined =>
  typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;

const asArray = (value: unknown): unknown[] =>
  Array.isArray(value) ? value : value === undefined ? [] : [value];

const asText = (value: unknown): string | undefined => {
  if (typeof value === "string") {
    return value;
  }

  const record = asRecord(value);
  const text = record?.["#text"];
  return typeof text === "string" ? text : undefined;
};

const linkFromAtom = (value: unknown): string | undefined => {
  for (const link of asArray(value)) {
    const record = asRecord(link);
    const href = record?.["@_href"];
    if (typeof href === "string") {
      return href;
    }
  }

  return asText(value);
};

const categories = (value: unknown): string[] =>
  asArray(value).flatMap((entry) => {
    const text = asText(entry);
    if (text !== undefined) {
      return [text];
    }

    const term = asRecord(entry)?.["@_term"];
    return typeof term === "string" ? [term] : [];
  });

const normalizeRssItem = (value: unknown): NewsItemWire => {
  const item = asRecord(value) ?? {};
  return {
    title: asText(item.title),
    link: asText(item.link),
    description: asText(item.description),
    publishedAt: asText(item.pubDate),
    categories: categories(item.category),
  };
};

const normalizeAtomEntry = (value: unknown): NewsItemWire => {
  const entry = asRecord(value) ?? {};
  return {
    title: asText(entry.title),
    link: linkFromAtom(entry.link),
    description: asText(entry.summary) ?? asText(entry.content),
    publishedAt: asText(entry.updated) ?? asText(entry.published),
    categories: categories(entry.category),
  };
};

export const parseNewsXml = (xml: string): NewsClientResult => {
  if (XMLValidator.validate(xml) !== true) {
    return { ok: false, reason: "RSS body is not valid XML." };
  }

  try {
    const parsed = asRecord(xmlParser.parse(xml));
    const rssChannel = asRecord(asRecord(parsed?.rss)?.channel);
    const atomFeed = asRecord(parsed?.feed);
    const normalized = rssChannel
      ? { items: asArray(rssChannel.item).map(normalizeRssItem) }
      : atomFeed
        ? { items: asArray(atomFeed.entry).map(normalizeAtomEntry) }
        : undefined;

    const wire = normalizedNewsFeedWireSchema.safeParse(normalized);
    return wire.success
      ? { ok: true, items: wire.data.items }
      : {
          ok: false,
          reason: "RSS body did not contain a valid RSS or Atom feed.",
        };
  } catch {
    return { ok: false, reason: "RSS XML parsing failed." };
  }
};

export const getNewsFeeds = (): string[] => {
  const extraFeeds = (process.env.NEWS_RSS_FEEDS ?? "")
    .split(",")
    .map((feed) => feed.trim())
    .filter((feed) => feed.length > 0);

  return [...NEWS_FEEDS, ...extraFeeds];
};

export const createRssClient = (options: RssClientOptions = {}): NewsClient => {
  const fetchImpl = options.fetchImpl ?? fetch;
  const timeoutMs =
    options.timeoutMs ??
    readPositiveInteger(process.env.NEWS_TIMEOUT_MS, defaultTimeoutMs);
  const retries =
    options.retries ??
    readPositiveInteger(process.env.NEWS_RETRIES, defaultRetries);
  const sleep = options.sleep ?? defaultSleep;

  return {
    fetchFeed: async (feedUrl: string): Promise<NewsClientResult> => {
      let lastReason = "RSS request did not complete.";

      for (let attempt = 0; attempt <= retries; attempt += 1) {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), timeoutMs);

        try {
          const response = await fetchImpl(feedUrl, {
            signal: controller.signal,
          });
          if (!response.ok) {
            lastReason = `RSS feed returned HTTP ${response.status}.`;
          } else {
            return parseNewsXml(await response.text());
          }
        } catch (error: unknown) {
          lastReason =
            error instanceof Error && error.name === "AbortError"
              ? "RSS feed request timed out."
              : "RSS feed network request failed.";
        } finally {
          clearTimeout(timeout);
        }

        if (attempt < retries) {
          await sleep(300 * 2 ** attempt);
        }
      }

      return { ok: false, reason: lastReason };
    },
  };
};
