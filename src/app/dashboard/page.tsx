import type { Metadata } from "next";

import {
  formatActionHeadline,
  formatActionSupport,
  formatAlertLevel,
  formatAlertMessage,
  formatDisruptionType,
  formatExposureType,
  formatModeLabel,
  formatMonitoringLine,
  formatProjectedStockShort,
  formatRegionList,
  formatSeverityLabel,
  formatSignalSource,
  formatSignalStatus,
  formatTimeOnly,
  formatTimestamp,
  severityRank,
} from "@/lib/dashboard/copy";
import {
  loadDashboard,
  type DashboardAlert,
  type DashboardData,
  type DashboardRisk,
  type DashboardTick,
} from "@/lib/dashboard/load-dashboard";

import { InjectDisruption } from "./inject-disruption";
import styles from "./page.module.css";
import { PendingApprovals } from "./pending-approvals";
import { RegionRiskMap } from "./region-risk-map";
import { SeverityDonut } from "./severity-donut";

export const metadata: Metadata = {
  title: "Supply Risk Console",
  description: "Live supply-chain risk monitoring and recommended actions.",
};

export const dynamic = "force-dynamic";

const EmptyState = ({ children }: { children: React.ReactNode }) => (
  <p className={styles.emptyState}>{children}</p>
);

const ModeBadge = ({ mode }: { mode: "live" | "replay" }) => (
  <span
    className={`${styles.modeBadge} ${mode === "replay" ? styles.replay : ""}`}
  >
    <span aria-hidden="true" className={styles.modeDot} />
    {formatModeLabel(mode)}
  </span>
);

const KpiBar = ({ data }: { data: DashboardData }) => {
  const tiles = [
    { label: "SKUs at risk", value: data.kpis.skusAtRisk },
    { label: "Needs reorder now", value: data.kpis.needsReorder },
    { label: "Awaiting your approval", value: data.kpis.awaitingApproval },
    { label: "Approved, ready to send", value: data.kpis.readyToSend },
    { label: "Active disruptions", value: data.kpis.activeDisruptions },
  ];
  return (
    <section aria-label="Executive summary" className={styles.kpiRow}>
      {tiles.map((tile) => (
        <div className={styles.kpiTile} key={tile.label}>
          <span>{tile.label}</span>
          <strong>{tile.value}</strong>
        </div>
      ))}
    </section>
  );
};

const NetworkHero = ({ data }: { data: DashboardData }) => (
  <section aria-label="Supply network risk" className={styles.heroGrid}>
    <RegionRiskMap network={data.network} />
    <aside className={styles.heroSide}>
      <SeverityDonut breakdown={data.severityBreakdown} />
      <div className={styles.statCard}>
        <span>Network health</span>
        <strong className={styles.statValue}>
          {data.network.networkHealthPercent}%
        </strong>
        <em>
          {data.network.healthyRegionCount} of {data.network.totalRegionCount}{" "}
          supplier regions clear
        </em>
      </div>
      <div className={styles.statCard}>
        <span>Routes at risk</span>
        <strong className={styles.statValue}>
          {data.network.disruptedRouteCount}
        </strong>
        <em>
          of {data.network.routes.length} tracked lanes with an active
          disruption on the path
        </em>
      </div>
    </aside>
  </section>
);

const ActionCard = ({ risk }: { risk: DashboardRisk }) => (
  <article
    className={`${styles.actionCard} ${styles[`action${risk.severity}`]}`}
  >
    <h3 className={styles.actionHeadline}>
      {formatActionHeadline({
        sku: risk.sku,
        recommendedQty: risk.recommendedQty,
        severity: risk.severity,
      })}
    </h3>
    <p className={styles.actionSupport}>
      {formatActionSupport({
        disruptionTypes: risk.disruptionTypes,
        leadTimeBase: risk.leadTimeBase,
        leadTimeDelta: risk.leadTimeDelta,
        inventoryPosition: risk.inventoryPosition,
        rop: risk.rop,
      })}
    </p>
    <div className={styles.chipRow}>
      <span className={`${styles.chip} ${styles[`severity${risk.severity}`]}`}>
        {formatSeverityLabel(risk.severity)}
      </span>
      {risk.exposureTypes.map((exposureType) => (
        <span className={styles.exposureBadge} key={exposureType}>
          {formatExposureType(exposureType)}
        </span>
      ))}
      {risk.disruptionTypes.map((type) => (
        <span className={styles.disruptionBadge} key={type}>
          {formatDisruptionType(type)}
        </span>
      ))}
    </div>
    <dl className={styles.metricRow}>
      <div>
        <dt>Safety stock buffer</dt>
        <dd>{risk.ss ?? "—"}</dd>
      </div>
      <div>
        <dt>Reorder point</dt>
        <dd>{risk.rop ?? "—"}</dd>
      </div>
      <div>
        <dt>Projected stock</dt>
        <dd>{formatProjectedStockShort(risk.inventoryPosition)}</dd>
      </div>
    </dl>
  </article>
);

const MonitoringCard = ({ risk }: { risk: DashboardRisk }) => (
  <article className={styles.monitorCard}>
    <span className={styles.monitorLabel}>Monitoring — no action needed</span>
    {formatMonitoringLine({
      sku: risk.sku,
      disruptionTypes: risk.disruptionTypes,
    })}
  </article>
);

const SignalItem = ({
  signal,
}: {
  signal: DashboardData["signals"][number];
}) => (
  <li className={signal.status === "degraded" ? styles.degradedSignal : ""}>
    <div className={styles.signalTopline}>
      <span
        className={`${styles.chip} ${styles[`severity${signal.severity}`]}`}
      >
        {formatSeverityLabel(signal.severity)}
      </span>
      <span className={styles.source}>{formatSignalSource(signal.source)}</span>
      <time className={styles.signalTime} dateTime={signal.detectedAt}>
        {formatTimestamp(signal.detectedAt)}
      </time>
    </div>
    <p>{formatRegionList(signal.regions)}</p>
    <span
      className={`${styles.status} ${
        signal.status === "resolved"
          ? styles.statusCleared
          : signal.status === "degraded"
            ? styles.statusDegraded
            : ""
      }`}
    >
      {formatSignalStatus(signal.status)}
    </span>
  </li>
);

const WhatsHappening = ({ signals }: Pick<DashboardData, "signals">) => {
  const ongoing = signals.filter((signal) => signal.status !== "resolved");
  const cleared = signals.filter((signal) => signal.status === "resolved");
  return (
    <section className={styles.panel} aria-labelledby="whats-happening-title">
      <div className={styles.panelHeader}>
        <div>
          <p className={styles.eyebrow}>Context</p>
          <h2 id="whats-happening-title">What&apos;s happening</h2>
        </div>
        <span className={styles.count}>{ongoing.length} ongoing</span>
      </div>
      {ongoing.length === 0 ? (
        <EmptyState>All clear — no ongoing weather or news events.</EmptyState>
      ) : (
        <ul className={styles.signalList}>
          {ongoing.map((signal) => (
            <SignalItem key={signal.id} signal={signal} />
          ))}
        </ul>
      )}
      {cleared.length === 0 ? null : (
        <details>
          <summary className={styles.toggleCleared}>
            Show cleared ({cleared.length})
          </summary>
          <ul className={styles.signalList}>
            {cleared.map((signal) => (
              <SignalItem key={signal.id} signal={signal} />
            ))}
          </ul>
        </details>
      )}
    </section>
  );
};

const AlertsPanel = ({ alerts }: { alerts: DashboardAlert[] }) => {
  const visibleAlerts = alerts.filter(
    (alert, index) =>
      alerts.findIndex(
        (candidate) =>
          candidate.sku === alert.sku && candidate.level === alert.level,
      ) === index,
  );
  const alertCount = (alert: DashboardAlert): number =>
    alerts.filter(
      (candidate) =>
        candidate.sku === alert.sku && candidate.level === alert.level,
    ).length;

  return (
    <section className={styles.panel} aria-labelledby="alerts-title">
      <div className={styles.panelHeader}>
        <div>
          <p className={styles.eyebrow}>Attention</p>
          <h2 id="alerts-title">Alerts</h2>
        </div>
        <span className={styles.count}>{alerts.length} recent</span>
      </div>
      {alerts.length === 0 ? (
        <EmptyState>All clear — no stock alerts right now.</EmptyState>
      ) : (
        <ul className={styles.alertList}>
          {visibleAlerts.map((alert) => (
            <li key={alert.id}>
              <span
                className={`${styles.alertRail} ${styles[`alert${alert.level}`]}`}
              />
              <div>
                <p>
                  <span
                    className={`${styles.chip} ${styles[`alert${alert.level}`]}`}
                  >
                    {formatAlertLevel(alert.level)}
                  </span>
                  <span className={styles.alertMessage}>
                    {formatAlertMessage({
                      level: alert.level,
                      sku: alert.sku,
                    })}
                  </span>
                  {alertCount(alert) > 1 ? (
                    <span className={styles.alertDuplicateCount}>
                      ×{alertCount(alert)}
                    </span>
                  ) : null}
                </p>
                <small className={styles.metadata}>
                  {alert.sku ?? "Product link unavailable"} ·{" "}
                  {formatTimestamp(alert.createdAt)}
                </small>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};

const SystemStatus = ({
  ticks,
  mode,
}: {
  ticks: DashboardTick[];
  mode: "live" | "replay";
}) => {
  const latest = ticks[0];
  if (latest === undefined) {
    return (
      <p className={styles.systemStatus}>
        <strong>System status:</strong> Waiting for the first check.
      </p>
    );
  }
  const costNote =
    latest.estimatedCostUsd === 0
      ? " · $0 — no external AI cost"
      : ` · External AI cost $${latest.estimatedCostUsd.toFixed(4)}`;
  return (
    <p className={styles.systemStatus}>
      <strong>System status:</strong> Last checked{" "}
      {formatTimeOnly(latest.clockNow)} · Monitoring {formatModeLabel(mode)}
      {costNote}
    </p>
  );
};

export default async function DashboardPage() {
  const data = await loadDashboard();
  const mode = data.ticks[0]?.mode ?? "live";
  const actionRisks = data.risks
    .filter((risk) => (risk.recommendedQty ?? 0) > 0)
    .sort(
      (left, right) =>
        severityRank(right.severity) - severityRank(left.severity),
    );
  const monitoringRisks = data.risks.filter(
    (risk) => (risk.recommendedQty ?? 0) === 0,
  );

  return (
    <main className={styles.dashboard}>
      <header className={styles.topbar}>
        <div>
          <p className={styles.kicker}>Supply Watch</p>
          <h1>Supply Risk Console</h1>
          <p className={styles.subhead}>
            Live supply-chain risk monitoring and recommended actions.
          </p>
        </div>
        <div className={styles.headerControls}>
          <InjectDisruption />
          <ModeBadge mode={mode} />
        </div>
      </header>

      <KpiBar data={data} />
      <NetworkHero data={data} />

      <section className={styles.sectionBlock} aria-labelledby="action-title">
        <div className={styles.sectionTitle}>
          <div>
            <p className={styles.eyebrow}>What to do</p>
            <h2 id="action-title">Action needed</h2>
          </div>
          <span>{actionRisks.length} items</span>
        </div>
        {actionRisks.length === 0 ? (
          <EmptyState>
            Nothing to order right now. Exposed products with healthy stock
            appear under monitoring below.
          </EmptyState>
        ) : (
          <div className={styles.actionList}>
            {actionRisks.map((risk) => (
              <ActionCard key={risk.id} risk={risk} />
            ))}
          </div>
        )}
      </section>

      {monitoringRisks.length === 0 ? null : (
        <section
          className={styles.sectionBlock}
          aria-labelledby="monitoring-title"
        >
          <div className={styles.sectionTitle}>
            <div>
              <p className={styles.eyebrow}>Watchlist</p>
              <h2 id="monitoring-title">Monitoring — no action needed</h2>
            </div>
            <span>{monitoringRisks.length} items</span>
          </div>
          <div className={styles.monitorList}>
            {monitoringRisks.map((risk) => (
              <MonitoringCard key={risk.id} risk={risk} />
            ))}
          </div>
        </section>
      )}

      <section className={styles.sectionBlock}>
        <PendingApprovals drafts={data.drafts} />
      </section>

      <section className={styles.sectionBlock} aria-label="Supporting evidence">
        <div className={styles.sectionTitle}>
          <div>
            <p className={styles.eyebrow}>Background</p>
            <h2>Supporting details</h2>
          </div>
        </div>
        <div className={styles.supportGrid}>
          <WhatsHappening signals={data.signals} />
          <AlertsPanel alerts={data.alerts} />
        </div>
        <div className={styles.supportingNote}>
          <SystemStatus ticks={data.ticks} mode={mode} />
        </div>
      </section>
    </main>
  );
}
