"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import type { DataViewMode } from "@/lib/dashboard/demo-mode";

import { clearDemoAction, injectDisruptionAction } from "./actions";
import styles from "./page.module.css";

export const DemoBanner = ({
  dataViewMode,
}: {
  dataViewMode: DataViewMode;
}) => {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  if (dataViewMode !== "demo") return null;

  const clearDemo = (): void => {
    setMessage(null);
    startTransition(async () => {
      const result = await clearDemoAction();
      if (!result.ok) {
        setMessage(result.error);
        return;
      }
      router.refresh();
      setMessage("Returned to live data.");
    });
  };

  return (
    <div className={styles.demoBanner} role="status">
      <p>
        Viewing simulated demo data. Return to live data when you are finished.
      </p>
      <button
        className={styles.demoBannerButton}
        disabled={isPending}
        onClick={clearDemo}
        type="button"
      >
        {isPending ? "Clearing…" : "Return to live data"}
      </button>
      {message === null ? null : (
        <span className={styles.demoBannerMessage}>{message}</span>
      )}
    </div>
  );
};

export const InjectDisruption = ({
  dataViewMode,
}: {
  dataViewMode: DataViewMode;
}) => {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const demoActive = dataViewMode === "demo";

  const inject = (): void => {
    setMessage(null);
    startTransition(async () => {
      const result = await injectDisruptionAction();
      if (!result.ok) {
        setMessage(result.error);
        return;
      }
      router.refresh();
      setMessage(
        `Demo loaded: ${result.summary.flags} products flagged, ${result.summary.pendingDrafts} message ready for review.`,
      );
    });
  };

  const clearDemo = (): void => {
    setMessage(null);
    startTransition(async () => {
      const result = await clearDemoAction();
      if (!result.ok) {
        setMessage(result.error);
        return;
      }
      router.refresh();
      setMessage("Returned to live data.");
    });
  };

  return (
    <div className={styles.injectControl}>
      <div className={styles.injectButtonRow}>
        <button
          className={styles.injectButton}
          disabled={isPending}
          onClick={inject}
          type="button"
        >
          <span>{isPending ? "Running…" : "Run demo scenario"}</span>
          <small>
            {demoActive ? "Replace current demo" : "Inject labeled scenario"}
          </small>
        </button>
        {demoActive ? (
          <button
            className={styles.clearDemoButton}
            disabled={isPending}
            onClick={clearDemo}
            type="button"
          >
            {isPending ? "Clearing…" : "Clear demo"}
          </button>
        ) : null}
      </div>
      {message === null ? null : (
        <p className={styles.injectMessage}>{message}</p>
      )}
    </div>
  );
};
