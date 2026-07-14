"use client";

import { useState, useTransition } from "react";

import { injectDisruptionAction } from "./actions";
import styles from "./page.module.css";

export const InjectDisruption = () => {
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
      setMessage(
        `Injected: ${result.summary.signals} signals → ${result.summary.flags} flags → ${result.summary.alerts} alerts`,
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
        <span>{isPending ? "Injecting scenario…" : "Demo · replay"}</span>
        <small>Inject synthetic disruption</small>
      </button>
      {message === null ? null : (
        <p className={styles.injectMessage}>{message}</p>
      )}
    </div>
  );
};
