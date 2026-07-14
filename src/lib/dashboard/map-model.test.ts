import { describe, expect, it } from "vitest";

import {
  buildActiveSeverityByRegion,
  buildNetworkModel,
  buildSeverityBreakdown,
  parsePointGeo,
  projectLonLat,
} from "@/lib/dashboard/map-model";

describe("map-model", () => {
  it("parses supplier point geo", () => {
    expect(parsePointGeo({ kind: "point", lat: 29.76, lon: -95.37 })).toEqual({
      lat: 29.76,
      lon: -95.37,
    });
    expect(
      parsePointGeo({ kind: "regions", regionCodes: ["US-TX"] }),
    ).toBeNull();
  });

  it("builds region severity from active signals only", () => {
    const byRegion = buildActiveSeverityByRegion([
      {
        affectedRegions: ["US-TX", "US-IL"],
        severity: "med",
      },
      {
        affectedRegions: ["US-TX"],
        severity: "high",
      },
    ]);
    expect(byRegion.get("US-TX")).toBe("high");
    expect(byRegion.get("US-IL")).toBe("med");
  });

  it("marks routes at risk when a route region has an active signal", () => {
    const network = buildNetworkModel({
      suppliers: [
        {
          id: "s1",
          regionCode: "US-TX",
          geo: { kind: "point", lat: 29.76, lon: -95.37 },
        },
        {
          id: "s2",
          regionCode: "DE",
          geo: { kind: "point", lat: 50.11, lon: 8.68 },
        },
      ],
      shipments: [
        {
          id: "sh1",
          supplierId: "s1",
          originGeo: { kind: "point", lat: 29.76, lon: -95.37 },
          destGeo: { kind: "point", lat: 41.88, lon: -87.63 },
          routeRegions: ["US-TX", "US-IL"],
        },
        {
          id: "sh2",
          supplierId: "s2",
          originGeo: { kind: "point", lat: 50.11, lon: 8.68 },
          destGeo: { kind: "point", lat: 41.88, lon: -87.63 },
          routeRegions: ["DE", "US-IL"],
        },
      ],
      activeSeverityByRegion: new Map([["US-TX", "high"]]),
    });
    expect(network.totalRegionCount).toBe(2);
    expect(network.healthyRegionCount).toBe(1);
    expect(network.networkHealthPercent).toBe(50);
    expect(
      network.regions.find((r) => r.regionCode === "US-TX")?.activeSeverity,
    ).toBe("high");
    expect(
      network.regions.find((r) => r.regionCode === "DE")?.activeSeverity,
    ).toBeNull();
    expect(network.disruptedRouteCount).toBe(1);
    expect(
      network.routes.find((r) => r.fromRegionCode === "US-TX")?.atRisk,
    ).toBe(true);
  });

  it("counts at-risk SKUs by max severity for the donut", () => {
    expect(
      buildSeverityBreakdown([
        { severity: "high" },
        { severity: "high" },
        { severity: "med" },
        { severity: "low" },
      ]),
    ).toEqual({ high: 2, med: 1, low: 1, unknown: 0 });
  });

  it("projects lon/lat inside the network frame", () => {
    const houston = projectLonLat(-95.37, 29.76, 960, 480);
    const tokyo = projectLonLat(139.65, 35.68, 960, 480);
    expect(houston.x).toBeGreaterThan(0);
    expect(houston.x).toBeLessThan(tokyo.x);
    expect(houston.y).toBeGreaterThan(0);
    expect(houston.y).toBeLessThan(480);
  });
});
