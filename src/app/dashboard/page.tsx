import type { Metadata } from "next";

import {
  loadDashboard,
  type DashboardAlert,
  type DashboardData,
  type DashboardRisk,
} from "@/lib/dashboard/load-dashboard";

import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "Supply Risk Console",
  description: "Operational supply disruption monitoring dashboard.",
};

export const dynamic = "force-dynamic";

const formatTimestamp = (value: string): string =>
  new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(Date.parse(value));

const severityLabel = (severity: DashboardRisk["severity"]): string =>
  severity === "med" ? "medium" : severity;

const ModeBadge = ({ mode }: { mode: "live" | "replay" }) => (
  <span
    className={`${styles.modeBadge} ${mode === "replay" ? styles.replay : ""}`}
  >
    <span aria-hidden="true" className={styles.modeDot} />
    MODE: {mode}
  </span>
);

const EmptyState = ({ children }: { children: React.ReactNode }) => (
  <p className={styles.emptyState}>{children}</p>
);

const SignalFeed = ({ signals }: Pick<DashboardData, "signals">) => (
  <section className={styles.panel} aria-labelledby="signal-feed-title">
    <div className={styles.panelHeader}>
      <div>
        <p className={styles.eyebrow}>External conditions</p>
        <h2 id="signal-feed-title">Signal feed</h2>
      </div>
      <span className={styles.count}>{signals.length} recent</span>
    </div>
    {signals.length === 0 ? (
      <EmptyState>No normalized signals have been recorded yet.</EmptyState>
    ) : (
      <ul className={styles.signalList}>
        {signals.map((signal) => (
          <li
            key={signal.id}
            className={
              signal.status === "degraded" ? styles.degradedSignal : ""
            }
          >
            <div className={styles.signalTopline}>
              <span
                className={`${styles.chip} ${styles[`severity${signal.severity}`]}`}
              >
                {severityLabel(signal.severity)}
              </span>
              <span className={styles.source}>{signal.source}</span>
              <time className={styles.signalTime} dateTime={signal.detectedAt}>
                {formatTimestamp(signal.detectedAt)}
              </time>
            </div>
            <p>{signal.regions.join(" · ") || "No region supplied"}</p>
            <span
              className={`${styles.status} ${signal.status === "degraded" ? styles.statusDegraded : ""}`}
            >
              {signal.status}
            </span>
          </li>
        ))}
      </ul>
    )}
  </section>
);

const AtRiskCard = ({ risk }: { risk: DashboardRisk }) => {
  const leadTimeAfter =
    risk.leadTimeBase === null ? null : risk.leadTimeBase + risk.leadTimeDelta;
  return (
    <article className={`${styles.riskCard} ${styles[`risk${risk.severity}`]}`}>
      <div className={styles.riskHeader}>
        <div>
          <p className={styles.eyebrow}>At-risk SKU</p>
          <h3>{risk.sku}</h3>
        </div>
        <span
          className={`${styles.chip} ${styles[`severity${risk.severity}`]}`}
        >
          {severityLabel(risk.severity)}
        </span>
      </div>
      <div className={styles.exposureBadges}>
        {risk.exposureTypes.map((exposureType) => (
          <span className={styles.exposureBadge} key={exposureType}>
            {exposureType.replace("_", " ")}
          </span>
        ))}
        <span className={styles.disruptionBadge}>
          {risk.disruptionTypes
            .map((type) => type.replaceAll("_", " "))
            .join(" · ")}
        </span>
      </div>
      <div className={styles.deltaGrid}>
        <div>
          <span>Lead time</span>
          <strong>
            {risk.leadTimeBase === null ? "—" : `${risk.leadTimeBase}d`}
          </strong>
          <b aria-hidden="true">→</b>
          <strong>{leadTimeAfter === null ? "—" : `${leadTimeAfter}d`}</strong>
        </div>
        <div>
          <span>Reorder point</span>
          <strong className={styles.adjustedRop}>{risk.rop ?? "—"}</strong>
          <small>adjusted</small>
        </div>
        <div className={styles.safetyStock}>
          <span>Safety stock</span>
          <strong>{risk.ss ?? "—"}</strong>
        </div>
      </div>
      <div className={styles.riskFooter}>
        <p className={styles.inventoryMetric}>
          On-hand {risk.onHand ?? "—"} · Inventory position{" "}
          {risk.inventoryPosition ?? "—"}
        </p>
        {risk.recommendedQty === 0 ? (
          <p className={styles.noReorder}>✓ No reorder needed — monitoring</p>
        ) : (
          <div className={styles.recommendationBlock}>
            <span>Recommend</span>
            <strong className={styles.recommendationMetric}>
              {risk.recommendedQty ?? "—"} <em>units</em>
            </strong>
          </div>
        )}
      </div>
    </article>
  );
};

const PendingApprovals = ({ drafts }: Pick<DashboardData, "drafts">) => (
  <section className={styles.panel} aria-labelledby="approvals-title">
    <div className={styles.panelHeader}>
      <div>
        <p className={styles.eyebrow}>Human review queue</p>
        <h2 id="approvals-title">Pending approvals</h2>
      </div>
      <span className={styles.count}>{drafts.length} waiting</span>
    </div>
    {drafts.length === 0 ? (
      <EmptyState>No supplier communications await review.</EmptyState>
    ) : (
      <div className={styles.draftList}>
        {drafts.map((draft) => (
          <article className={styles.draft} key={draft.id}>
            <div>
              <p className={styles.draftSku}>{draft.sku}</p>
              <h3>{draft.subject}</h3>
              <p className={styles.draftBody}>{draft.body}</p>
              <span className={styles.tone}>{draft.tone}</span>
            </div>
            <dl>
              <div>
                <dt>Safety stock</dt>
                <dd>{draft.ss ?? "—"}</dd>
              </div>
              <div>
                <dt>ROP</dt>
                <dd>{draft.rop ?? "—"}</dd>
              </div>
              <div>
                <dt>Inventory position</dt>
                <dd>{draft.inventoryPosition ?? "—"}</dd>
              </div>
              <div>
                <dt>Recommendation</dt>
                <dd>{draft.recommendedQty ?? "—"} units</dd>
              </div>
            </dl>
          </article>
        ))}
      </div>
    )}
  </section>
);

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
          <p className={styles.eyebrow}>Threshold crossings</p>
          <h2 id="alerts-title">Alerts</h2>
        </div>
        <span className={styles.count}>{alerts.length} recent</span>
      </div>
      {alerts.length === 0 ? (
        <EmptyState>No alert thresholds have been crossed.</EmptyState>
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
                    {alert.level}
                  </span>
                  {alert.message}
                  {alertCount(alert) > 1 ? (
                    <span className={styles.alertDuplicateCount}>
                      ×{alertCount(alert)}
                    </span>
                  ) : null}
                </p>
                <small className={styles.metadata}>
                  {alert.sku ?? "Unlinked SKU"} ·{" "}
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

const TickLogPanel = ({ ticks }: Pick<DashboardData, "ticks">) => (
  <section className={styles.panel} aria-labelledby="ticks-title">
    <div className={styles.panelHeader}>
      <div>
        <p className={styles.eyebrow}>Pipeline health</p>
        <h2 id="ticks-title">Recent ticks</h2>
      </div>
      <span className={styles.count}>{ticks.length} logged</span>
    </div>
    {ticks.length === 0 ? (
      <EmptyState>The first scheduled tick will appear here.</EmptyState>
    ) : (
      <div className={styles.tickTable}>
        <div className={styles.tickHead}>
          <span>Run</span>
          <span>Counts</span>
          <span>Duration</span>
          <span>Cost</span>
        </div>
        {ticks.map((tick) => (
          <div className={styles.tickRow} key={tick.id}>
            <div>
              <strong>{tick.triggerSource}</strong>
              <small className={styles.metadata}>
                <ModeBadge mode={tick.mode} /> {formatTimestamp(tick.clockNow)}
              </small>
            </div>
            <code>{tick.counts}</code>
            <span>{tick.durationMs}ms</span>
            <span>${tick.estimatedCostUsd.toFixed(4)}</span>
          </div>
        ))}
      </div>
    )}
  </section>
);

export default async function DashboardPage() {
  const data = await loadDashboard();
  const mode = data.ticks[0]?.mode ?? "live";
  return (
    <main className={styles.dashboard}>
      <header className={styles.topbar}>
        <div>
          <p className={styles.kicker}>Supply disruption response</p>
          <h1>Risk operations console</h1>
          <p className={styles.subhead}>
            Deterministic inventory decisions, surfaced for human review.
          </p>
        </div>
        <ModeBadge mode={mode} />
      </header>
      <section className={styles.heroSection} aria-labelledby="risk-title">
        <div className={styles.sectionTitle}>
          <div>
            <p className={styles.eyebrow}>Priority queue</p>
            <h2 id="risk-title">At-risk inventory</h2>
          </div>
          <span>{data.risks.length} open flags</span>
        </div>
        {data.risks.length === 0 ? (
          <EmptyState>
            No open risk flags. The deterministic engine will surface exposure
            here.
          </EmptyState>
        ) : (
          <div className={styles.riskGrid}>
            {data.risks.map((risk) => (
              <AtRiskCard key={risk.id} risk={risk} />
            ))}
          </div>
        )}
      </section>
      <div className={styles.consoleGrid}>
        <SignalFeed signals={data.signals} />
        <AlertsPanel alerts={data.alerts} />
        <PendingApprovals drafts={data.drafts} />
        <TickLogPanel ticks={data.ticks} />
      </div>
    </main>
  );
}
