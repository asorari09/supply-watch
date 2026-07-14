import type { Metadata } from "next";

import {
  formatDataViewLabel,
  formatMonitoringLine,
  severityRank,
} from "@/lib/dashboard/copy";
import type { DataViewMode } from "@/lib/dashboard/demo-mode";
import {
  loadDashboard,
  type DashboardData,
  type DashboardRisk,
} from "@/lib/dashboard/load-dashboard";

import { ActionItems } from "./action-items";
import { DemoBanner, InjectDisruption } from "./inject-disruption";
import styles from "./page.module.css";
import { PendingApprovals } from "./pending-approvals";
import { RegionRiskMap } from "./region-risk-map";
import { SeverityDonut } from "./severity-donut";
import { AlertsPanel, WhatsHappeningPanel } from "./supporting-panels";
import { SystemStatus } from "./system-status";

export const metadata: Metadata = {
  title: "Supply Risk Console",
  description: "Supply-chain risk monitoring console.",
};

export const dynamic = "force-dynamic";

const EmptyState = ({ children }: { children: React.ReactNode }) => (
  <p className={styles.emptyState}>{children}</p>
);

const DataViewBadge = ({ mode }: { mode: DataViewMode }) => (
  <span
    className={`${styles.modeBadge} ${mode === "demo" ? styles.demoMode : styles.liveMode}`}
  >
    <span aria-hidden="true" className={styles.modeDot} />
    {formatDataViewLabel(mode)}
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
      <div className={styles.statChips}>
        <div className={styles.statChip}>
          <span>Network health</span>
          <strong>{data.network.networkHealthPercent}%</strong>
          <em>
            {data.network.healthyRegionCount}/{data.network.totalRegionCount}{" "}
            regions clear
          </em>
        </div>
        <div className={styles.statChip}>
          <span>Routes at risk</span>
          <strong>{data.network.disruptedRouteCount}</strong>
          <em>of {data.network.routes.length} tracked lanes</em>
        </div>
      </div>
    </aside>
  </section>
);

const MonitoringRow = ({ risk }: { risk: DashboardRisk }) => (
  <li className={styles.monitorRow}>
    <span className={styles.monitorLabel}>Monitoring</span>
    <span className={styles.monitorText}>
      {formatMonitoringLine({
        sku: risk.sku,
        disruptionTypes: risk.disruptionTypes,
      })}
    </span>
  </li>
);

export default async function DashboardPage() {
  const data = await loadDashboard();
  const dataViewMode = data.dataViewMode;
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
    <main
      className={`${styles.dashboard} ${dataViewMode === "demo" ? styles.dashboardDemo : ""}`}
    >
      <DemoBanner dataViewMode={dataViewMode} />
      <header className={styles.topbar}>
        <h1>Supply Risk Console</h1>
        <div className={styles.headerControls}>
          <InjectDisruption dataViewMode={dataViewMode} />
          <DataViewBadge mode={dataViewMode} />
        </div>
      </header>

      <KpiBar data={data} />
      <NetworkHero data={data} />

      <section className={styles.sectionBlock} aria-labelledby="action-title">
        <div className={styles.sectionTitle}>
          <h2 id="action-title">Action needed</h2>
          <span>{actionRisks.length} items</span>
        </div>
        {actionRisks.length === 0 ? (
          <EmptyState>
            Nothing to order right now. Exposed products with healthy stock
            appear under monitoring below.
          </EmptyState>
        ) : (
          <ActionItems drafts={data.drafts} risks={actionRisks} />
        )}
      </section>

      {monitoringRisks.length === 0 ? null : (
        <section
          className={styles.sectionBlock}
          aria-labelledby="monitoring-title"
        >
          <div className={styles.sectionTitle}>
            <h2 id="monitoring-title">Monitoring: no action needed</h2>
            <span>{monitoringRisks.length} items</span>
          </div>
          <div className={styles.monitorList}>
            <ul className={styles.monitorTable}>
              {monitoringRisks.map((risk) => (
                <MonitoringRow key={risk.id} risk={risk} />
              ))}
            </ul>
          </div>
        </section>
      )}

      <section className={styles.sectionBlock}>
        <PendingApprovals drafts={data.drafts} />
      </section>

      <section className={styles.sectionBlock} aria-label="Supporting details">
        <div className={styles.sectionTitle}>
          <h2>Supporting details</h2>
        </div>
        <div className={styles.supportGrid}>
          <WhatsHappeningPanel signals={data.signals} />
          <AlertsPanel alerts={data.alerts} />
        </div>
        <div className={styles.supportingNote}>
          <SystemStatus ticks={data.ticks} dataViewMode={dataViewMode} />
        </div>
      </section>
    </main>
  );
}
