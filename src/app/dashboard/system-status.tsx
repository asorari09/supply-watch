"use client";

import { useId, useState } from "react";

import { formatDataViewLabel, formatTimeOnly } from "@/lib/dashboard/copy";
import type { DataViewMode } from "@/lib/dashboard/demo-mode";
import type { DashboardTick } from "@/lib/dashboard/load-dashboard";

import styles from "./page.module.css";

export const SystemStatus = ({
  ticks,
  dataViewMode,
}: {
  ticks: DashboardTick[];
  dataViewMode: DataViewMode;
}) => {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const latest = ticks[0];
  const modeLabel = formatDataViewLabel(dataViewMode);

  return (
    <div className={styles.systemStatusBar}>
      <span
        aria-hidden="true"
        className={`${styles.systemDot} ${dataViewMode === "demo" ? styles.systemDotSim : ""}`}
      />
      <span className={styles.systemModeLabel}>{modeLabel}</span>
      <button
        aria-controls={panelId}
        aria-expanded={open}
        className={styles.systemInfoButton}
        onClick={() => setOpen((value) => !value)}
        type="button"
      >
        <span aria-hidden="true">i</span>
        <span className={styles.srOnly}>System status details</span>
      </button>
      {open ? (
        <div className={styles.systemPopover} id={panelId} role="dialog">
          <p>
            <strong>System status</strong>
          </p>
          {latest === undefined ? (
            <p>Waiting for the first check.</p>
          ) : (
            <ul>
              <li>Last checked: {formatTimeOnly(latest.clockNow)}</li>
              <li>Data view: {modeLabel}</li>
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
};
