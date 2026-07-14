"use client";

import {
  ComposableMap,
  Geographies,
  Geography,
  Line,
  Marker,
  Sphere,
} from "react-simple-maps";

import type { DashboardNetwork, Severity } from "@/lib/dashboard/map-model";

import styles from "./page.module.css";

const GEO_URL = "/world-countries-110m.json";
const WIDTH = 880;
const HEIGHT = 340;

const SEVERITY_FILL: Record<Severity, string> = {
  high: "#E5484D",
  med: "#F5A623",
  low: "#7B75E8",
  unknown: "#8A90A2",
};

const pinFill = (severity: Severity | null): string =>
  severity === null ? "#8B93A5" : SEVERITY_FILL[severity];

const routeStroke = (severity: Severity | null, atRisk: boolean): string => {
  if (!atRisk || severity === null) return "#C4C9D4";
  return SEVERITY_FILL[severity];
};

export const RegionRiskMap = ({ network }: { network: DashboardNetwork }) => {
  const dest = network.destination;

  return (
    <figure className={styles.mapFigure}>
      <div className={styles.mapOverlay}>
        Network status: {network.networkHealthPercent}% healthy
      </div>
      <ComposableMap
        className={styles.mapSvg ?? "mapSvg"}
        height={HEIGHT}
        projection="geoNaturalEarth1"
        projectionConfig={{
          scale: 155,
          center: [12, 18],
        }}
        width={WIDTH}
      >
        <Sphere fill="#F7F8FA" id="ocean" stroke="#E6E8EC" strokeWidth={0.5} />
        <Geographies geography={GEO_URL}>
          {({ geographies }) =>
            geographies.map((geo) => (
              <Geography
                geography={geo}
                key={geo.rsmKey}
                style={{
                  default: {
                    fill: "#E8EBF0",
                    stroke: "#FFFFFF",
                    strokeWidth: 0.45,
                    outline: "none",
                  },
                  hover: {
                    fill: "#E8EBF0",
                    stroke: "#FFFFFF",
                    strokeWidth: 0.45,
                    outline: "none",
                  },
                  pressed: {
                    fill: "#E8EBF0",
                    stroke: "#FFFFFF",
                    strokeWidth: 0.45,
                    outline: "none",
                  },
                }}
              />
            ))
          }
        </Geographies>

        {network.routes.map((route) => (
          <Line
            from={[route.fromLon, route.fromLat]}
            key={route.id}
            stroke={routeStroke(route.activeSeverity, route.atRisk)}
            strokeLinecap="round"
            strokeOpacity={route.atRisk ? 0.85 : 0.55}
            strokeWidth={1.5}
            to={[route.toLon, route.toLat]}
          />
        ))}

        {dest === null ? null : (
          <Marker coordinates={[dest.lon, dest.lat]}>
            <g>
              <rect
                fill="#7B75E8"
                height={12}
                rx={1.5}
                stroke="#FFFFFF"
                strokeWidth={1.25}
                transform="rotate(45)"
                width={12}
                x={-6}
                y={-6}
              />
              <text
                className={styles.mapLabel}
                dominantBaseline="hanging"
                textAnchor="middle"
                y={14}
              >
                Destination
              </text>
            </g>
          </Marker>
        )}

        {network.regions.map((region) => (
          <Marker
            coordinates={[region.lon, region.lat]}
            key={region.regionCode}
          >
            <g>
              {region.activeSeverity === null ? null : (
                <circle
                  cx={0}
                  cy={0}
                  fill={pinFill(region.activeSeverity)}
                  fillOpacity={0.22}
                  r={11}
                />
              )}
              <circle
                cx={0}
                cy={0}
                fill={pinFill(region.activeSeverity)}
                r={5}
                stroke="#FFFFFF"
                strokeWidth={1.5}
              />
              <text className={styles.mapLabel} textAnchor="middle" y={-12}>
                {region.label}
              </text>
            </g>
          </Marker>
        ))}
      </ComposableMap>
      <div className={styles.mapLegend}>
        <span>
          <i className={`${styles.legendSwatch} ${styles.mapPinHigh}`} /> High
        </span>
        <span>
          <i className={`${styles.legendSwatch} ${styles.mapPinMed}`} /> Medium
        </span>
        <span>
          <i className={`${styles.legendSwatch} ${styles.mapPinLow}`} /> Low
        </span>
        <span>
          <i className={`${styles.legendSwatch} ${styles.mapPinHealthy}`} />{" "}
          Clear
        </span>
      </div>
      {network.totalRegionCount === 0 ? (
        <figcaption className={styles.mapEmpty}>
          No supplier locations available to map.
        </figcaption>
      ) : (
        <figcaption className={styles.mapCaption}>
          {network.regions.filter((r) => r.activeSeverity !== null).length} of{" "}
          {network.totalRegionCount} supplier regions disrupted ·{" "}
          {network.disruptedRouteCount} routes at risk
        </figcaption>
      )}
    </figure>
  );
};
