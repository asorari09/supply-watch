import {
  projectLonLat,
  type DashboardNetwork,
  type Severity,
} from "@/lib/dashboard/map-model";

import styles from "./page.module.css";

const WIDTH = 880;
const HEIGHT = 300;

const severityPinClass = (severity: Severity | null) => {
  if (severity === "high") return styles.mapPinHigh;
  if (severity === "med") return styles.mapPinMed;
  if (severity === "low") return styles.mapPinLow;
  return styles.mapPinHealthy;
};

const routeClass = (severity: Severity | null, atRisk: boolean) => {
  if (!atRisk) return styles.mapRouteHealthy;
  if (severity === "high") return styles.mapRouteHigh;
  if (severity === "med") return styles.mapRouteMed;
  return styles.mapRouteLow;
};

const curvedRoute = (
  from: { x: number; y: number },
  to: { x: number; y: number },
): string => {
  const dx = to.x - from.x;
  const midX = from.x + dx * 0.5;
  const midY = Math.min(from.y, to.y) - Math.abs(dx) * 0.16 - 24;
  return `M ${from.x} ${from.y} Q ${midX} ${midY} ${to.x} ${to.y}`;
};

const HubMarker = ({ x, y }: { x: number; y: number }) => (
  <g transform={`translate(${x} ${y})`}>
    <circle className={styles.mapHubHalo} cx={0} cy={0} r={14} />
    <path
      className={styles.mapHub}
      d="M0 -9 L2.6 -2.6 L9.5 -2.6 L4 1.8 L6 9 L0 4.6 L-6 9 L-4 1.8 L-9.5 -2.6 L-2.6 -2.6 Z"
    />
    <text className={styles.mapLabel} textAnchor="middle" x={0} y={24}>
      Destination
    </text>
  </g>
);

/**
 * Abstract network diagram (Option B): real supplier lat/lon + routes, no
 * landmass basemap. Chosen because react-simple-maps peers React ≤18 and
 * ships no types — not viable on Next 15 / React 19.
 */
export const RegionRiskMap = ({ network }: { network: DashboardNetwork }) => {
  const dest =
    network.destination === null
      ? null
      : projectLonLat(
          network.destination.lon,
          network.destination.lat,
          WIDTH,
          HEIGHT,
        );

  return (
    <figure className={styles.mapFigure}>
      <div className={styles.mapOverlay}>
        Network status — {network.networkHealthPercent}% healthy
      </div>
      <svg
        aria-label="Supply network region risk diagram"
        className={styles.mapSvg}
        role="img"
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      >
        <defs>
          <marker
            id="route-arrow"
            markerHeight={7}
            markerWidth={7}
            orient="auto"
            refX={6}
            refY={3.5}
          >
            <path className={styles.mapRouteArrow} d="M0,0 L7,3.5 L0,7 Z" />
          </marker>
        </defs>

        <rect
          className={styles.mapCanvas}
          height={HEIGHT}
          rx={10}
          width={WIDTH}
          x={0}
          y={0}
        />

        {/* Soft zone labels — layout guides only, not geography claims. */}
        <text className={styles.mapZoneLabel} x={90} y={28}>
          Americas
        </text>
        <text className={styles.mapZoneLabel} x={420} y={28}>
          Europe
        </text>
        <text className={styles.mapZoneLabel} x={720} y={28}>
          Asia
        </text>
        <line
          className={styles.mapZoneRule}
          x1={280}
          x2={280}
          y1={40}
          y2={270}
        />
        <line
          className={styles.mapZoneRule}
          x1={560}
          x2={560}
          y1={40}
          y2={270}
        />

        {network.routes.map((route) => {
          const from = projectLonLat(
            route.fromLon,
            route.fromLat,
            WIDTH,
            HEIGHT,
          );
          const to = projectLonLat(route.toLon, route.toLat, WIDTH, HEIGHT);
          return (
            <path
              className={routeClass(route.activeSeverity, route.atRisk)}
              d={curvedRoute(from, to)}
              fill="none"
              key={route.id}
              markerEnd="url(#route-arrow)"
            />
          );
        })}

        {dest === null ? null : <HubMarker x={dest.x} y={dest.y} />}

        {network.regions.map((region) => {
          const point = projectLonLat(region.lon, region.lat, WIDTH, HEIGHT);
          return (
            <g key={region.regionCode}>
              {region.activeSeverity === null ? null : (
                <circle
                  className={`${styles.mapRing} ${severityPinClass(region.activeSeverity)}`}
                  cx={point.x}
                  cy={point.y}
                  r={12}
                />
              )}
              <circle
                className={`${styles.mapPin} ${severityPinClass(region.activeSeverity)}`}
                cx={point.x}
                cy={point.y}
                r={6}
              />
              <text
                className={styles.mapLabel}
                textAnchor="middle"
                x={point.x}
                y={point.y - 16}
              >
                {region.label}
              </text>
            </g>
          );
        })}
      </svg>
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
