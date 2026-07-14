import { formatRegionLabel } from "@/lib/dashboard/copy";

export type Severity = "low" | "med" | "high" | "unknown";

export interface DashboardNetworkRegion {
  regionCode: string;
  label: string;
  lat: number;
  lon: number;
  /** null = healthy / no active disruption */
  activeSeverity: Severity | null;
}

export interface DashboardNetworkRoute {
  id: string;
  fromRegionCode: string;
  toRegionCode: string;
  fromLat: number;
  fromLon: number;
  toLat: number;
  toLon: number;
  atRisk: boolean;
  activeSeverity: Severity | null;
}

export interface DashboardDestination {
  label: string;
  lat: number;
  lon: number;
}

export interface DashboardSeverityBreakdown {
  high: number;
  med: number;
  low: number;
  unknown: number;
}

export interface DashboardKpis {
  skusAtRisk: number;
  needsReorder: number;
  awaitingApproval: number;
  readyToSend: number;
  activeDisruptions: number;
}

export interface DashboardNetwork {
  regions: DashboardNetworkRegion[];
  routes: DashboardNetworkRoute[];
  destination: DashboardDestination | null;
  healthyRegionCount: number;
  totalRegionCount: number;
  /** 0–100 integer */
  networkHealthPercent: number;
  disruptedRouteCount: number;
}

const severityRank = (severity: Severity): number => {
  if (severity === "high") return 3;
  if (severity === "med") return 2;
  if (severity === "low") return 1;
  return 0;
};

export const maxSeverity = (
  left: Severity | null,
  right: Severity,
): Severity => {
  if (left === null) return right;
  return severityRank(right) > severityRank(left) ? right : left;
};

export const parsePointGeo = (
  value: unknown,
): { lat: number; lon: number } | null => {
  if (typeof value !== "object" || value === null) return null;
  const record = value as Record<string, unknown>;
  if (record.kind !== "point") return null;
  if (typeof record.lat !== "number" || typeof record.lon !== "number")
    return null;
  if (!Number.isFinite(record.lat) || !Number.isFinite(record.lon)) return null;
  return { lat: record.lat, lon: record.lon };
};

export const buildActiveSeverityByRegion = (
  activeSignals: ReadonlyArray<{
    affectedRegions: readonly string[];
    severity: Severity;
  }>,
): Map<string, Severity> => {
  const byRegion = new Map<string, Severity>();
  for (const signal of activeSignals) {
    for (const region of signal.affectedRegions) {
      byRegion.set(
        region,
        maxSeverity(byRegion.get(region) ?? null, signal.severity),
      );
    }
  }
  return byRegion;
};

export const buildNetworkModel = (input: {
  suppliers: ReadonlyArray<{
    id: string;
    regionCode: string;
    geo: unknown;
  }>;
  shipments: ReadonlyArray<{
    id: string;
    supplierId: string;
    originGeo: unknown;
    destGeo: unknown;
    routeRegions: readonly string[];
  }>;
  activeSeverityByRegion: ReadonlyMap<string, Severity>;
}): DashboardNetwork => {
  const regionByCode = new Map<string, DashboardNetworkRegion>();
  for (const supplier of input.suppliers) {
    const point = parsePointGeo(supplier.geo);
    if (point === null) continue;
    const existing = regionByCode.get(supplier.regionCode);
    if (existing !== undefined) continue;
    regionByCode.set(supplier.regionCode, {
      regionCode: supplier.regionCode,
      label: formatRegionLabel(supplier.regionCode),
      lat: point.lat,
      lon: point.lon,
      activeSeverity:
        input.activeSeverityByRegion.get(supplier.regionCode) ?? null,
    });
  }

  const regions = [...regionByCode.values()].sort((left, right) =>
    left.regionCode.localeCompare(right.regionCode),
  );
  const healthyRegionCount = regions.filter(
    (region) => region.activeSeverity === null,
  ).length;
  const totalRegionCount = regions.length;
  const networkHealthPercent =
    totalRegionCount === 0
      ? 100
      : Math.round((healthyRegionCount / totalRegionCount) * 100);

  let destination: DashboardDestination | null = null;
  const routes: DashboardNetworkRoute[] = [];
  const seenRoutes = new Set<string>();

  for (const shipment of input.shipments) {
    const origin = parsePointGeo(shipment.originGeo);
    const dest = parsePointGeo(shipment.destGeo);
    if (origin === null || dest === null) continue;
    if (destination === null) {
      destination = {
        label: "Illinois hub (destination)",
        lat: dest.lat,
        lon: dest.lon,
      };
    }
    const fromRegion =
      shipment.routeRegions[0] ??
      input.suppliers.find((supplier) => supplier.id === shipment.supplierId)
        ?.regionCode ??
      "unknown";
    const routeKey = `${fromRegion}->${dest.lat},${dest.lon}`;
    if (seenRoutes.has(routeKey)) continue;
    seenRoutes.add(routeKey);
    let routeSeverity: Severity | null = null;
    for (const region of shipment.routeRegions) {
      const severity = input.activeSeverityByRegion.get(region);
      if (severity === undefined) continue;
      routeSeverity = maxSeverity(routeSeverity, severity);
    }
    routes.push({
      id: routeKey,
      fromRegionCode: fromRegion,
      toRegionCode: "US-IL",
      fromLat: origin.lat,
      fromLon: origin.lon,
      toLat: dest.lat,
      toLon: dest.lon,
      atRisk: routeSeverity !== null,
      activeSeverity: routeSeverity,
    });
  }

  return {
    regions,
    routes,
    destination,
    healthyRegionCount,
    totalRegionCount,
    networkHealthPercent,
    disruptedRouteCount: routes.filter((route) => route.atRisk).length,
  };
};

export const buildSeverityBreakdown = (
  risks: ReadonlyArray<{ severity: Severity }>,
): DashboardSeverityBreakdown => {
  const breakdown: DashboardSeverityBreakdown = {
    high: 0,
    med: 0,
    low: 0,
    unknown: 0,
  };
  for (const risk of risks) {
    breakdown[risk.severity] += 1;
  }
  return breakdown;
};

export const buildKpis = (input: {
  risks: ReadonlyArray<{ recommendedQty: number | null }>;
  drafts: ReadonlyArray<{ status: string }>;
  activeDisruptionCount: number;
}): DashboardKpis => ({
  skusAtRisk: input.risks.length,
  needsReorder: input.risks.filter((risk) => (risk.recommendedQty ?? 0) > 0)
    .length,
  awaitingApproval: input.drafts.filter(
    (draft) => draft.status === "pending_approval",
  ).length,
  readyToSend: input.drafts.filter((draft) => draft.status === "approved")
    .length,
  activeDisruptions: input.activeDisruptionCount,
});

/**
 * Equirectangular projection into SVG viewBox space.
 * Frame is fitted to the seeded supplier footprint (Americas–Asia)
 * so real lat/lon pins stay readable; not a world atlas.
 */
export const NETWORK_MAP_FRAME = {
  west: -135,
  east: 155,
  south: 12,
  north: 58,
} as const;

export const projectLonLat = (
  lon: number,
  lat: number,
  width: number,
  height: number,
  frame: typeof NETWORK_MAP_FRAME = NETWORK_MAP_FRAME,
): { x: number; y: number } => ({
  x: ((lon - frame.west) / (frame.east - frame.west)) * width,
  y: ((frame.north - lat) / (frame.north - frame.south)) * height,
});
