"use client";

import { useState } from "react";

import {
  formatAlertLevel,
  formatAlertMessage,
  formatRegionList,
  formatSeverityLabel,
  formatSignalSource,
  formatSignalStatus,
  formatTimestamp,
} from "@/lib/dashboard/copy";
import type {
  DashboardAlert,
  DashboardData,
} from "@/lib/dashboard/load-dashboard";

import styles from "./page.module.css";

const EmptyState = ({ children }: { children: React.ReactNode }) => (
  <p className={styles.emptyState}>{children}</p>
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

const ONGOING_VISIBLE = 5;

export const WhatsHappeningPanel = ({
  signals,
}: Pick<DashboardData, "signals">) => {
  const [showMoreOngoing, setShowMoreOngoing] = useState(false);
  const incomplete = signals.filter((signal) => signal.status === "degraded");
  const ongoing = signals.filter(
    (signal) => signal.status !== "resolved" && signal.status !== "degraded",
  );
  const cleared = signals.filter((signal) => signal.status === "resolved");
  const visibleOngoing = showMoreOngoing
    ? ongoing
    : ongoing.slice(0, ONGOING_VISIBLE);
  const hiddenOngoing = Math.max(0, ongoing.length - ONGOING_VISIBLE);

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
        <EmptyState>All clear - no ongoing weather or news events.</EmptyState>
      ) : (
        <>
          <ul className={styles.signalList}>
            {visibleOngoing.map((signal) => (
              <SignalItem key={signal.id} signal={signal} />
            ))}
          </ul>
          {hiddenOngoing > 0 && !showMoreOngoing ? (
            <button
              className={styles.toggleCleared}
              onClick={() => setShowMoreOngoing(true)}
              type="button"
            >
              Show more ({hiddenOngoing})
            </button>
          ) : null}
          {showMoreOngoing && hiddenOngoing > 0 ? (
            <button
              className={styles.toggleCleared}
              onClick={() => setShowMoreOngoing(false)}
              type="button"
            >
              Show less
            </button>
          ) : null}
        </>
      )}
      {incomplete.length === 0 ? null : (
        <details>
          <summary className={styles.toggleCleared}>
            Show incomplete ({incomplete.length})
          </summary>
          <ul className={styles.signalList}>
            {incomplete.map((signal) => (
              <SignalItem key={signal.id} signal={signal} />
            ))}
          </ul>
        </details>
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

export const AlertsPanel = ({ alerts }: { alerts: DashboardAlert[] }) => {
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
        <EmptyState>All clear - no stock alerts right now.</EmptyState>
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
