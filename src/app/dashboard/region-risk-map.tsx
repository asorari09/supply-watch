import {
  projectLonLat,
  type DashboardNetwork,
  type Severity,
} from "@/lib/dashboard/map-model";

import styles from "./page.module.css";

const WIDTH = 960;
const HEIGHT = 480;

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

const curvePath = (
  from: { x: number; y: number },
  to: { x: number; y: number },
): string => {
  const midX = (from.x + to.x) / 2;
  const midY = Math.min(from.y, to.y) - Math.abs(to.x - from.x) * 0.12;
  return `M ${from.x} ${from.y} Q ${midX} ${midY} ${to.x} ${to.y}`;
};

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
        Network status — {network.networkHealthPercent}% of supply network
        healthy
      </div>
      <svg
        aria-label="Supply network region risk map"
        className={styles.mapSvg}
        role="img"
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      >
        <rect
          className={styles.mapOcean}
          height={HEIGHT}
          rx={12}
          width={WIDTH}
          x={0}
          y={0}
        />
        {/* Decorative geography frame only; markers and routes are data-driven. */}
        <path
          className={styles.mapLand}
          d="M80 220 C160 130 280 120 380 170 C470 220 520 250 610 230 C700 210 780 160 900 190 L900 360 C780 340 680 360 560 380 C440 400 300 360 180 330 C120 310 70 280 80 220 Z"
        />
        <path
          className={styles.mapLand}
          d="M720 90 C780 70 860 90 910 140 C930 165 920 210 890 220 C840 200 780 170 740 140 C720 125 710 105 720 90 Z"
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
              d={curvePath(from, to)}
              fill="none"
              key={route.id}
            />
          );
        })}

        {dest === null ? null : (
          <g>
            <circle className={styles.mapHub} cx={dest.x} cy={dest.y} r={7} />
            <text
              className={styles.mapLabel}
              textAnchor="middle"
              x={dest.x}
              y={dest.y + 22}
            >
              Destination
            </text>
          </g>
        )}

        {network.regions.map((region) => {
          const point = projectLonLat(region.lon, region.lat, WIDTH, HEIGHT);
          return (
            <g key={region.regionCode}>
              {region.activeSeverity === null ? null : (
                <circle
                  className={`${styles.mapGlow} ${severityPinClass(region.activeSeverity)}`}
                  cx={point.x}
                  cy={point.y}
                  r={16}
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
                y={point.y - 12}
              >
                {region.label}
              </text>
            </g>
          );
        })}
      </svg>
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
