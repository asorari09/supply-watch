import type { DashboardSeverityBreakdown } from "@/lib/dashboard/map-model";

import styles from "./page.module.css";

const COLORS = {
  high: "#E5484D",
  med: "#F5A623",
  low: "#7B75E8",
  unknown: "#8A90A2",
} as const;

type SeverityKey = keyof typeof COLORS;

export const SeverityDonut = ({
  breakdown,
}: {
  breakdown: DashboardSeverityBreakdown;
}) => {
  const total =
    breakdown.high + breakdown.med + breakdown.low + breakdown.unknown;
  const segments: Array<{ key: SeverityKey; value: number }> = (
    [
      { key: "high", value: breakdown.high },
      { key: "med", value: breakdown.med },
      { key: "low", value: breakdown.low },
      { key: "unknown", value: breakdown.unknown },
    ] as const
  ).filter((segment) => segment.value > 0);

  const radius = 42;
  const stroke = 14;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  return (
    <div className={styles.donutCard}>
      <p className={styles.eyebrow}>At-risk mix</p>
      <h3>SKUs by severity</h3>
      {total === 0 ? (
        <p className={styles.emptyState}>No at-risk SKUs right now.</p>
      ) : (
        <div className={styles.donutBody}>
          <svg
            aria-hidden="true"
            height={120}
            viewBox="0 0 120 120"
            width={120}
          >
            <circle
              cx={60}
              cy={60}
              fill="none"
              r={radius}
              stroke="#E6E8EC"
              strokeWidth={stroke}
            />
            {segments.map((segment) => {
              const length = (segment.value / total) * circumference;
              const circle = (
                <circle
                  cx={60}
                  cy={60}
                  fill="none"
                  key={segment.key}
                  r={radius}
                  stroke={COLORS[segment.key]}
                  strokeDasharray={`${length} ${circumference - length}`}
                  strokeDashoffset={-offset}
                  strokeLinecap="butt"
                  strokeWidth={stroke}
                  transform="rotate(-90 60 60)"
                />
              );
              offset += length;
              return circle;
            })}
            <text
              className={styles.donutCenter}
              dominantBaseline="middle"
              textAnchor="middle"
              x={60}
              y={60}
            >
              {total}
            </text>
          </svg>
          <ul className={styles.donutLegend}>
            <li>
              <span style={{ background: COLORS.high }} /> High{" "}
              <strong>{breakdown.high}</strong>
            </li>
            <li>
              <span style={{ background: COLORS.med }} /> Medium{" "}
              <strong>{breakdown.med}</strong>
            </li>
            <li>
              <span style={{ background: COLORS.low }} /> Low{" "}
              <strong>{breakdown.low}</strong>
            </li>
            {breakdown.unknown === 0 ? null : (
              <li>
                <span style={{ background: COLORS.unknown }} /> Unknown{" "}
                <strong>{breakdown.unknown}</strong>
              </li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
};
