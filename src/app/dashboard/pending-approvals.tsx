"use client";

import { useState, useTransition } from "react";

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
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const execute = (action: () => Promise<DraftActionResult>): void => {
    setMessage(null);
    startTransition(async () => {
      const result = await action();
      if (result.ok) {
        setStatus(result.status);
        setMessage(
          result.status === "sent"
            ? "Mock send recorded."
            : `Draft ${result.status}.`,
        );
      } else {
        setMessage(result.error);
      }
    });
  };

  if (status === "rejected")
    return <p className={styles.draftTerminal}>Rejected — terminal state</p>;
  if (status === "sent")
    return <p className={styles.draftSent}>Sent — mock transport recorded</p>;
  if (status === "approved")
    return (
      <div className={styles.draftControls}>
        <p className={styles.draftApproved}>Approved — ready to send</p>
        <button
          className={styles.sendButton}
          disabled={isPending}
          onClick={() => execute(() => sendDraftAction(draft.id))}
          type="button"
        >
          {isPending ? "Sending…" : "Send mock email"}
        </button>
        {message === null ? null : (
          <p className={styles.actionMessage}>{message}</p>
        )}
      </div>
    );

  return (
    <div className={styles.draftControls}>
      <label className={styles.editLabel} htmlFor={`draft-body-${draft.id}`}>
        Review and edit body
      </label>
      <textarea
        className={styles.draftTextarea}
        disabled={isPending}
        id={`draft-body-${draft.id}`}
        onChange={(event) => setBody(event.target.value)}
        value={body}
      />
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
}) => (
  <section className={styles.panel} aria-labelledby="approvals-title">
    <div className={styles.panelHeader}>
      <div>
        <p className={styles.eyebrow}>Human review queue</p>
        <h2 id="approvals-title">Pending approvals</h2>
      </div>
      <span className={styles.count}>
        {drafts.filter((draft) => draft.status === "pending_approval").length}{" "}
        waiting
      </span>
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
            <DraftControls draft={draft} />
          </article>
        ))}
      </div>
    )}
  </section>
);
