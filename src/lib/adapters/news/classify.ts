import type { NewsItemWire } from "@/lib/adapters/news/rss.wire";

// Cheap deterministic gate run before classification or any future optional model extraction.
export const DISRUPTION_KEYWORDS = [
  "port",
  "strike",
  "closure",
  "shutdown",
  "earthquake",
  "flood",
  "hurricane",
  "blockade",
  "recall",
  "shortage",
  "congestion",
  "typhoon",
  "tariff",
  "embargo",
] as const;

export interface NewsClassification {
  disruptionType: string;
  severity: "low" | "med" | "high";
  delayDaysEstimate: number;
  affectedRegions: string[];
}

interface ClassificationRule {
  keywords: readonly string[];
  disruptionType: string;
  severity: NewsClassification["severity"];
  delayDaysEstimate: number;
}

const classificationRules: readonly ClassificationRule[] = [
  {
    keywords: ["closure", "shutdown", "blockade", "embargo"],
    disruptionType: "port_closure",
    severity: "high",
    delayDaysEstimate: 7,
  },
  {
    keywords: ["hurricane", "typhoon", "earthquake", "flood"],
    disruptionType: "weather_disruption",
    severity: "high",
    delayDaysEstimate: 7,
  },
  {
    keywords: ["strike"],
    disruptionType: "labor_strike",
    severity: "high",
    delayDaysEstimate: 5,
  },
  {
    keywords: ["congestion", "shortage"],
    disruptionType: "congestion",
    severity: "med",
    delayDaysEstimate: 3,
  },
  {
    keywords: ["tariff", "recall"],
    disruptionType: "trade_disruption",
    severity: "med",
    delayDaysEstimate: 2,
  },
];

export const REGION_KEYWORDS: Readonly<Record<string, string>> = {
  "los angeles": "US-CA",
  california: "US-CA",
  houston: "US-TX",
  texas: "US-TX",
  shanghai: "CN",
  china: "CN",
  rotterdam: "NL",
  netherlands: "NL",
  germany: "DE",
  japan: "JP",
  mexico: "MX",
};

const itemText = (item: NewsItemWire): string =>
  `${item.title ?? ""} ${item.description ?? ""}`.toLowerCase();

const hasKeyword = (text: string, keyword: string): boolean =>
  text.split(/[^a-z0-9]+/).includes(keyword);

export const preFilter = (item: NewsItemWire): boolean => {
  const text = itemText(item);
  return DISRUPTION_KEYWORDS.some((keyword) => hasKeyword(text, keyword));
};

const affectedRegions = (text: string): string[] => [
  ...new Set(
    Object.entries(REGION_KEYWORDS)
      .filter(([keyword]) => text.includes(keyword))
      .map(([, regionCode]) => regionCode),
  ),
];

export const classify = (item: NewsItemWire): NewsClassification | null => {
  const text = itemText(item);
  const rule = classificationRules.find((entry) =>
    entry.keywords.some((keyword) => hasKeyword(text, keyword)),
  );

  return rule === undefined
    ? null
    : {
        disruptionType: rule.disruptionType,
        severity: rule.severity,
        delayDaysEstimate: rule.delayDaysEstimate,
        affectedRegions: affectedRegions(text),
      };
};
