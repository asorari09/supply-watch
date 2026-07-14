"use client";

import { useState } from "react";

import {
  formatActionCauseLine,
  formatActionOrderTitle,
  formatAffectedSummary,
  formatDraftSubject,
  formatProjectedStock,
  formatSeverityBasis,
  formatSeverityLabel,
} from "@/lib/dashboard/copy";
import type {
  DashboardDraft,
  DashboardRisk,
} from "@/lib/dashboard/load-dashboard";

import styles from "./page.module.css";

const linkedDraftForRisk = (
  risk: DashboardRisk,
  drafts: readonly DashboardDraft[],
): DashboardDraft | null => {
  const forSku = drafts.filter((draft) => draft.sku === risk.sku);
  return (
    forSku.find((draft) => draft.status === "pending_approval") ??
    forSku[0] ??
    null
  );
};

const ActionItem = ({
  risk,
  drafts,
  expanded,
  onToggle,
}: {
  risk: DashboardRisk;
  drafts: readonly DashboardDraft[];
  expanded: boolean;
  onToggle: () => void;
}) => {
  const draft = linkedDraftForRisk(risk, drafts);
  const detailId = `action-detail-${risk.id}`;

  return (
    <li
      className={`${styles.actionRowItem} ${expanded ? styles.actionRowItemOpen : ""}`}
    >
      <button
        aria-controls={detailId}
        aria-expanded={expanded}
        className={styles.actionRowTrigger}
        onClick={onToggle}
        type="button"
      >
        <div className={styles.actionSkuCell}>
          <span
            className={`${styles.chip} ${styles[`severity${risk.severity}`]}`}
          >
            {formatSeverityLabel(risk.severity)}
          </span>
          <span className={styles.actionSku}>{risk.sku}</span>
        </div>
        <strong className={styles.actionOrder}>
          {formatActionOrderTitle(risk.recommendedQty)}
        </strong>
        <p className={styles.actionCause}>
          {formatActionCauseLine({
            disruptionTypes: risk.disruptionTypes,
            leadTimeBase: risk.leadTimeBase,
            leadTimeDelta: risk.leadTimeDelta,
          })}
        </p>
      </button>
      {expanded ? (
        <div className={styles.actionDetail} id={detailId}>
          <p className={styles.actionDetailBasis}>
            {formatSeverityBasis({
              severity: risk.severity,
              inventoryPosition: risk.inventoryPosition,
              rop: risk.rop,
            })}
          </p>
          <dl className={styles.actionDetailGrid}>
            <div className={styles.actionDetailField}>
              <dt>SS</dt>
              <dd>{risk.ss ?? "-"}</dd>
            </div>
            <div className={styles.actionDetailField}>
              <dt>ROP</dt>
              <dd>{risk.rop ?? "-"}</dd>
            </div>
            <div className={styles.actionDetailField}>
              <dt>Stock</dt>
              <dd>{formatProjectedStock(risk.inventoryPosition)}</dd>
            </div>
            <div className={styles.actionDetailField}>
              <dt>Order qty</dt>
              <dd>{risk.recommendedQty ?? "-"}</dd>
            </div>
          </dl>
          <div className={styles.actionDetailPlain}>
            <span className={styles.actionDetailLabel}>Affected</span>
            <p>
              {formatAffectedSummary({
                exposureTypes: risk.exposureTypes,
                disruptionTypes: risk.disruptionTypes,
              })}
            </p>
          </div>
          <div className={styles.actionDetailPlain}>
            <span className={styles.actionDetailLabel}>Linked draft</span>
            {draft === null ? (
              <p>No linked supplier draft</p>
            ) : (
              <p>
                {formatDraftSubject(draft.subject)}
                {draft.status === "pending_approval"
                  ? " (awaiting approval)"
                  : ` (${draft.status})`}
              </p>
            )}
          </div>
        </div>
      ) : null}
    </li>
  );
};

export const ActionItems = ({
  risks,
  drafts,
}: {
  risks: DashboardRisk[];
  drafts: DashboardDraft[];
}) => {
  const [openId, setOpenId] = useState<string | null>(null);

  return (
    <ul className={styles.actionTable}>
      {risks.map((risk) => (
        <ActionItem
          drafts={drafts}
          expanded={openId === risk.id}
          key={risk.id}
          onToggle={() =>
            setOpenId((current) => (current === risk.id ? null : risk.id))
          }
          risk={risk}
        />
      ))}
    </ul>
  );
};
