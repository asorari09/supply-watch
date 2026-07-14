export type DataViewMode = "live" | "demo";

/** Markers used by inject-demo for synthetic signals (and legacy seed demos). */
export const isSyntheticDedupeHash = (dedupeHash: string): boolean =>
  dedupeHash.startsWith("synthetic-demo:") ||
  dedupeHash.startsWith("demo-seed-");

/**
 * DEMO when any active synthetic signal exists, or any open flag is still linked
 * to a synthetic-marked signal. Otherwise LIVE.
 */
export const detectDataViewMode = (input: {
  activeSignals: ReadonlyArray<{ dedupeHash: string }>;
  openFlags: ReadonlyArray<{ signalId: string }>;
  signalById: ReadonlyMap<string, { dedupeHash: string }>;
}): DataViewMode => {
  if (
    input.activeSignals.some((signal) =>
      isSyntheticDedupeHash(signal.dedupeHash),
    )
  )
    return "demo";

  for (const flag of input.openFlags) {
    const signal = input.signalById.get(flag.signalId);
    if (signal !== undefined && isSyntheticDedupeHash(signal.dedupeHash))
      return "demo";
  }

  return "live";
};
