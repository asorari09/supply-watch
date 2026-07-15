"use client";

import { useEffect, useState } from "react";

import {
  formatAlertLevel,
  formatAlertMessage,
  formatAlertRuleReason,
  formatAlertTriggerLine,
  formatDisruptionType,
  formatRegionList,
  formatSeverityLabel,
  formatSignalSource,
  formatSignalStatus,
  formatTimestamp,
} from "@/lib/dashboard/copy";
import type {
  DashboardAlert,
  DashboardData,
  DashboardSignal,
} from "@/lib/dashboard/load-dashboard";
import {
  isNewsEvidence,
  isWeatherEvidence,
  newsArticleUrl,
  openMeteoForecastUrl,
} from "@/lib/dashboard/signal-evidence";

import styles from "./page.module.css";

const EmptyState = ({ children }: { children: React.ReactNode }) => (
  <p className={styles.emptyState}>{children}</p>
);

const SignalEvidenceDetail = ({ signal }: { signal: DashboardSignal }) => {
  const articleUrl = newsArticleUrl({
    evidence: isNewsEvidence(signal.evidence) ? signal.evidence : null,
    rawRef: signal.rawRef,
  });
  const point =
    signal.geo !== null && signal.geo.kind === "point" ? signal.geo : null;

  return (
    <div className={styles.signalDetail}>
      <dl className={styles.signalDetailGrid}>
        <div className={styles.signalDetailField}>
          <dt>Classification</dt>
          <dd>{formatDisruptionType(signal.disruptionType)}</dd>
        </div>
        <div className={styles.signalDetailField}>
          <dt>Severity</dt>
          <dd>{formatSeverityLabel(signal.severity)}</dd>
        </div>
        <div className={styles.signalDetailField}>
          <dt>Region</dt>
          <dd>{formatRegionList(signal.regions)}</dd>
        </div>
        <div className={styles.signalDetailField}>
          <dt>Detected</dt>
          <dd>
            <time dateTime={signal.detectedAt}>
              {formatTimestamp(signal.detectedAt)}
            </time>
          </dd>
        </div>
      </dl>

      {signal.source === "news" ? (
        <div className={styles.signalEvidenceBlock}>
          {isNewsEvidence(signal.evidence) ? (
            <>
              <p className={styles.signalEvidenceLine}>
                {signal.evidence.title !== null &&
                signal.evidence.title.trim().length > 0
                  ? signal.evidence.title
                  : "Article title not captured"}
              </p>
              <p className={styles.signalEvidenceMeta}>
                Feed: {signal.evidence.feedName}
              </p>
            </>
          ) : (
            <p className={styles.signalEvidenceMeta}>
              Source metadata not captured for this signal.
            </p>
          )}
          {articleUrl !== null ? (
            <a
              className={styles.signalEvidenceLink}
              href={articleUrl}
              rel="noopener noreferrer"
              target="_blank"
            >
              View source article
            </a>
          ) : (
            <p className={styles.signalEvidenceMeta}>
              Source link not available
            </p>
          )}
        </div>
      ) : null}

      {signal.source === "weather" ? (
        <div className={styles.signalEvidenceBlock}>
          {isWeatherEvidence(signal.evidence) ? (
            <>
              <p className={styles.signalEvidenceLine}>
                Wind gusts {signal.evidence.windGust} km/h, precipitation{" "}
                {signal.evidence.precipitation} mm -{" "}
                {signal.evidence.thresholdRule}
              </p>
              <p className={styles.signalEvidenceMeta}>
                Location: {signal.evidence.locationName}
              </p>
            </>
          ) : (
            <p className={styles.signalEvidenceMeta}>
              Measurement detail not captured for this signal
            </p>
          )}
          {point !== null ? (
            <a
              className={styles.signalEvidenceLink}
              href={openMeteoForecastUrl(point.lat, point.lon)}
              rel="noopener noreferrer"
              target="_blank"
            >
              View forecast
            </a>
          ) : null}
        </div>
      ) : null}
    </div>
  );
};

const SignalItem = ({ signal }: { signal: DashboardSignal }) => {
  const [expanded, setExpanded] = useState(false);
  const detailId = `signal-detail-${signal.id}`;
  const anchorId = `signal-${signal.id}`;

  useEffect(() => {
    const openFromHash = (): void => {
      if (window.location.hash !== `#${anchorId}`) return;
      setExpanded(true);
      const details = document.getElementById(anchorId)?.closest("details");
      if (details !== null && details !== undefined) details.open = true;
    };
    openFromHash();
    window.addEventListener("hashchange", openFromHash);
    return () => window.removeEventListener("hashchange", openFromHash);
  }, [anchorId]);

  return (
    <li
      className={`${styles.signalRowItem} ${expanded ? styles.signalRowItemOpen : ""}`}
      id={anchorId}
    >
      <button
        aria-controls={detailId}
        aria-expanded={expanded}
        className={styles.signalRowTrigger}
        onClick={() => setExpanded((current) => !current)}
        type="button"
      >
        <div className={styles.signalTopline}>
          <span
            className={`${styles.chip} ${styles[`severity${signal.severity}`]}`}
          >
            {formatSeverityLabel(signal.severity)}
          </span>
          <span className={styles.source}>
            {formatSignalSource(signal.source)}
          </span>
          <time className={styles.signalTime} dateTime={signal.detectedAt}>
            {formatTimestamp(signal.detectedAt)}
          </time>
        </div>
        <p className={styles.signalListRegion}>
          {formatRegionList(signal.regions)}
        </p>
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
      </button>
      {expanded ? (
        <div className={styles.signalDetailWrap} id={detailId}>
          <SignalEvidenceDetail signal={signal} />
        </div>
      ) : null}
    </li>
  );
};

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
        <h2 id="whats-happening-title">What&apos;s happening</h2>
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

const AlertDerivationDetail = ({ alert }: { alert: DashboardAlert }) => {
  const leadBase = alert.leadTimeBase;
  const leadAfter =
    leadBase === null || alert.leadTimeDelta === null
      ? null
      : leadBase + alert.leadTimeDelta;

  return (
    <div className={styles.alertDetail}>
      <p className={styles.deterministicLabel}>Deterministic assessment</p>
      <p className={styles.alertRuleLine}>
        {formatAlertRuleReason({
          level: alert.level,
          signalSeverity: alert.signalSeverity,
          inventoryPosition: alert.inventoryPosition,
          rop: alert.rop,
        })}
      </p>
      <div className={styles.alertTriggerBlock}>
        <p className={styles.alertEvidenceMeta}>
          {formatAlertTriggerLine({
            disruptionType: alert.disruptionType,
            regions: alert.regions,
          })}
        </p>
        {alert.signalId !== null && alert.signalInFeed ? (
          <a
            className={styles.signalEvidenceLink}
            href={`#signal-${alert.signalId}`}
          >
            view signal
          </a>
        ) : null}
      </div>
      <dl className={styles.signalDetailGrid}>
        <div className={styles.signalDetailField}>
          <dt>Lead time</dt>
          <dd>
            {leadBase === null || leadAfter === null
              ? "-"
              : `${leadBase}->${leadAfter}d`}
          </dd>
        </div>
        <div className={styles.signalDetailField}>
          <dt>Safety stock</dt>
          <dd>{alert.ss ?? "-"}</dd>
        </div>
        <div className={styles.signalDetailField}>
          <dt>Reorder point</dt>
          <dd>{alert.rop ?? "-"}</dd>
        </div>
        <div className={styles.signalDetailField}>
          <dt>Projected stock</dt>
          <dd>{alert.inventoryPosition ?? "-"}</dd>
        </div>
        <div className={styles.signalDetailField}>
          <dt>Recommended order</dt>
          <dd>{alert.recommendedQty ?? "-"}</dd>
        </div>
      </dl>
    </div>
  );
};

const AlertItem = ({
  alert,
  duplicateCount,
}: {
  alert: DashboardAlert;
  duplicateCount: number;
}) => {
  const [expanded, setExpanded] = useState(false);
  const detailId = `alert-detail-${alert.id}`;

  return (
    <li
      className={`${styles.alertRowItem} ${expanded ? styles.alertRowItemOpen : ""}`}
    >
      <button
        aria-controls={detailId}
        aria-expanded={expanded}
        className={styles.alertRowTrigger}
        onClick={() => setExpanded((current) => !current)}
        type="button"
      >
        <span className={styles.alertSeverity}>
          <i
            aria-hidden="true"
            className={`${styles.alertDot} ${styles[`alertDot${alert.level}`]}`}
          />
          <span
            className={`${styles.alertTag} ${styles[`alertTag${alert.level}`]}`}
          >
            {formatAlertLevel(alert.level)}
          </span>
        </span>
        <div className={styles.alertBody}>
          <p>
            <span className={styles.alertMessage}>
              {formatAlertMessage({
                level: alert.level,
                sku: alert.sku,
              })}
            </span>
            {duplicateCount > 1 ? (
              <span className={styles.alertDuplicateCount}>
                ×{duplicateCount}
              </span>
            ) : null}
          </p>
          <small className={styles.metadata}>
            {alert.sku ?? "Product link unavailable"} ·{" "}
            {formatTimestamp(alert.createdAt)}
          </small>
        </div>
      </button>
      {expanded ? (
        <div className={styles.alertDetailWrap} id={detailId}>
          <AlertDerivationDetail alert={alert} />
        </div>
      ) : null}
    </li>
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
        <h2 id="alerts-title">Alerts</h2>
        <span className={styles.count}>{alerts.length} recent</span>
      </div>
      {alerts.length === 0 ? (
        <EmptyState>All clear - no stock alerts right now.</EmptyState>
      ) : (
        <ul className={styles.alertList}>
          {visibleAlerts.map((alert) => (
            <AlertItem
              alert={alert}
              duplicateCount={alertCount(alert)}
              key={alert.id}
            />
          ))}
        </ul>
      )}
    </section>
  );
};
