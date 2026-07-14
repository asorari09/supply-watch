import type { Severity } from "@/lib/domain";

export const MAX_LEAD_TIME_DELTA = 60;

const delayMap: Readonly<Record<string, Partial<Record<Severity, number>>>> = {
  storm: { high: 7, med: 4, low: 2 },
  flood: { high: 5, med: 3, low: 1 },
  port_closure: { high: 7, med: 4, low: 2 },
  labor_strike: { high: 5, med: 3, low: 1 },
  weather_disruption: { high: 7, med: 4, low: 2 },
  congestion: { high: 3, med: 2, low: 1 },
  trade_disruption: { high: 2, med: 1, low: 1 },
};

export const delayDaysFor = (
  disruptionType: string,
  severity: Severity,
): number => delayMap[disruptionType]?.[severity] ?? 0;
