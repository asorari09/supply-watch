"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { injectDisruptionAction } from "./actions";
import styles from "./page.module.css";

export const InjectDisruption = () => {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

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

  return (
    <div className={styles.injectControl}>
      <button
        className={styles.injectButton}
        disabled={isPending}
        onClick={inject}
        type="button"
      >
        <span>{isPending ? "Running demo…" : "Run demo scenario"}</span>
        <small>Demo · not live data</small>
      </button>
      {message === null ? null : (
        <p className={styles.injectMessage}>{message}</p>
      )}
    </div>
  );
};
