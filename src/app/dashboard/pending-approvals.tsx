"use client";

import { useState, useTransition } from "react";

import { formatActionMetricsInline } from "@/lib/dashboard/copy";

import {
  approveDraftAction,
  rejectDraftAction,
  sendDraftAction,
  type DraftActionResult,
} from "./actions";
import styles from "./page.module.css";

export interface PendingApprovalDraft {
  id: string;
  subject: string;
  body: string;
  tone: string;
  status: "pending_approval" | "approved" | "rejected" | "sent";
  sku: string;
  ss: number | null;
  rop: number | null;
  inventoryPosition: number | null;
  recommendedQty: number | null;
}

const EmptyState = ({ children }: { children: React.ReactNode }) => (
  <p className={styles.emptyState}>{children}</p>
);

const DraftControls = ({ draft }: { draft: PendingApprovalDraft }) => {
  const [status, setStatus] = useState(draft.status);
  const [body, setBody] = useState(draft.body);
  const [editing, setEditing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const execute = (action: () => Promise<DraftActionResult>): void => {
    setMessage(null);
    startTransition(async () => {
      const result = await action();
      if (result.ok) {
        setStatus(result.status);
        setEditing(false);
        setMessage(
          result.status === "sent"
            ? "Sent - demo delivery logged."
            : result.status === "approved"
              ? "Approved - ready to send."
              : "Rejected - no send.",
        );
      } else {
        setMessage(result.error);
      }
    });
  };

  if (status === "rejected")
    return <p className={styles.draftTerminal}>Rejected - no send</p>;
  if (status === "sent")
    return <p className={styles.draftSent}>Sent - demo delivery logged</p>;
  if (status === "approved")
    return (
      <div className={styles.draftControls}>
        <p className={styles.draftApproved}>Approved - ready to send</p>
        <button
          className={styles.sendButton}
          disabled={isPending}
          onClick={() => execute(() => sendDraftAction(draft.id))}
          type="button"
        >
          {isPending ? "Sending…" : "Send"}
        </button>
        {message === null ? null : (
          <p className={styles.actionMessage}>{message}</p>
        )}
      </div>
    );

  return (
    <div className={styles.draftControls}>
      {editing ? (
        <>
          <label
            className={styles.editLabel}
            htmlFor={`draft-body-${draft.id}`}
          >
            Edit message before approving
          </label>
          <textarea
            className={styles.draftTextarea}
            disabled={isPending}
            id={`draft-body-${draft.id}`}
            onChange={(event) => setBody(event.target.value)}
            value={body}
          />
        </>
      ) : null}
      <div className={styles.actionRow}>
        <button
          className={styles.approveButton}
          disabled={isPending}
          onClick={() => execute(() => approveDraftAction(draft.id, body))}
          type="button"
        >
          {isPending ? "Saving…" : "Approve"}
        </button>
        <button
          className={styles.editToggle}
          disabled={isPending}
          onClick={() => setEditing((value) => !value)}
          type="button"
        >
          {editing ? "Hide edit" : "Edit"}
        </button>
        <button
          className={styles.rejectButton}
          disabled={isPending}
          onClick={() => execute(() => rejectDraftAction(draft.id))}
          type="button"
        >
          Reject
        </button>
      </div>
      {message === null ? null : (
        <p className={styles.actionMessage}>{message}</p>
      )}
    </div>
  );
};

export const PendingApprovals = ({
  drafts,
}: {
  drafts: PendingApprovalDraft[];
}) => {
  const waiting = drafts.filter(
    (draft) => draft.status === "pending_approval",
  ).length;
  return (
    <section className={styles.panel} aria-labelledby="approvals-title">
      <div className={styles.panelHeader}>
        <div>
          <p className={styles.eyebrow}>Your review</p>
          <h2 id="approvals-title">Communications awaiting your approval</h2>
        </div>
        <span className={styles.count}>{waiting} waiting</span>
      </div>
      {drafts.length === 0 ? (
        <EmptyState>No supplier messages waiting for review.</EmptyState>
      ) : (
        <div className={styles.draftList}>
          {drafts.map((draft) => (
            <article className={styles.draft} key={draft.id}>
              <div className={styles.draftMain}>
                <div className={styles.draftTopline}>
                  <p className={styles.draftSku}>{draft.sku}</p>
                  <p className={styles.draftReco}>
                    Recommended order: {draft.recommendedQty ?? "-"} units
                  </p>
                </div>
                <h3>{draft.subject}</h3>
                <p className={styles.draftBodyClamp}>{draft.body}</p>
                <p className={styles.draftMetrics}>
                  {formatActionMetricsInline({
                    ss: draft.ss,
                    rop: draft.rop,
                    inventoryPosition: draft.inventoryPosition,
                  })}
                </p>
              </div>
              <DraftControls draft={draft} />
            </article>
          ))}
        </div>
      )}
    </section>
  );
};
