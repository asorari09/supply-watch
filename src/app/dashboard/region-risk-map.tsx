import {
  projectLonLat,
  type DashboardNetwork,
  type Severity,
} from "@/lib/dashboard/map-model";

import styles from "./page.module.css";

const WIDTH = 880;
const HEIGHT = 320;

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
  const dy = to.y - from.y;
  const midX = from.x + dx * 0.5;
  const midY = from.y + dy * 0.5 - Math.abs(dx) * 0.18 - 18;
  return `M ${from.x} ${from.y} Q ${midX} ${midY} ${to.x} ${to.y}`;
};

const HubMarker = ({ x, y }: { x: number; y: number }) => (
  <g transform={`translate(${x} ${y})`}>
    <circle className={styles.mapHubHalo} cx={0} cy={0} r={12} />
    <path
      className={styles.mapHub}
      d="M0 -9 L2.6 -2.6 L9.5 -2.6 L4 1.8 L6 9 L0 4.6 L-6 9 L-4 1.8 L-9.5 -2.6 L-2.6 -2.6 Z"
    />
    <text className={styles.mapLabel} textAnchor="middle" x={0} y={22}>
      Destination
    </text>
  </g>
);

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
        aria-label="Supply network region risk map"
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
          <pattern
            height={40}
            id="map-graticule"
            patternUnits="userSpaceOnUse"
            width={40}
          >
            <path
              className={styles.mapGraticule}
              d="M40 0 H0 V40"
              fill="none"
            />
          </pattern>
        </defs>

        <rect
          className={styles.mapOcean}
          height={HEIGHT}
          rx={10}
          width={WIDTH}
          x={0}
          y={0}
        />
        <rect
          fill="url(#map-graticule)"
          height={HEIGHT}
          opacity={0.55}
          width={WIDTH}
          x={0}
          y={0}
        />

        {/* Decorative landmasses aligned to the network frame — markers stay data-driven. */}
        <path
          className={styles.mapLand}
          d="M40 118 C78 72 138 58 198 78 C248 96 286 138 338 152 C392 168 430 148 468 118 C500 92 536 84 574 100 L574 250 C500 268 420 278 348 262 C270 244 196 228 128 214 C84 204 48 172 40 118 Z"
        />
        <path
          className={styles.mapLand}
          d="M468 70 C508 48 556 52 596 78 C632 102 646 138 628 168 C602 156 568 138 536 122 C502 104 480 88 468 70 Z"
        />
        <path
          className={styles.mapLand}
          d="M620 90 C670 58 760 54 820 88 C858 112 872 158 848 188 C808 170 752 148 700 132 C662 118 636 106 620 90 Z"
        />
        <path
          className={styles.mapLandAccent}
          d="M96 198 C132 186 168 190 198 204 C168 214 132 214 96 198 Z"
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
                  r={11}
                />
              )}
              <circle
                className={`${styles.mapPin} ${severityPinClass(region.activeSeverity)}`}
                cx={point.x}
                cy={point.y}
                r={5}
              />
              <text
                className={styles.mapLabel}
                textAnchor="middle"
                x={point.x}
                y={point.y - 14}
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
