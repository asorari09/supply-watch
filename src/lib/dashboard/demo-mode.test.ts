import { describe, expect, it } from "vitest";

import {
  detectDataViewMode,
  isSyntheticDedupeHash,
} from "@/lib/dashboard/demo-mode";

describe("demo mode detection", () => {
  it("recognizes synthetic and legacy demo dedupe hashes", () => {
    expect(isSyntheticDedupeHash("synthetic-demo:abc:route-storm")).toBe(true);
    expect(isSyntheticDedupeHash("demo-seed-1")).toBe(true);
    expect(isSyntheticDedupeHash("weather:open-meteo:hash")).toBe(false);
  });

  it("returns demo when an active synthetic signal is present", () => {
    expect(
      detectDataViewMode({
        activeSignals: [
          { dedupeHash: "synthetic-demo:x:route-storm" },
          { dedupeHash: "weather:live:abc" },
        ],
        openFlags: [],
        signalById: new Map(),
      }),
    ).toBe("demo");
  });

  it("returns demo when an open flag still points at a synthetic signal", () => {
    expect(
      detectDataViewMode({
        activeSignals: [{ dedupeHash: "weather:live:abc" }],
        openFlags: [{ signalId: "sig-demo" }],
        signalById: new Map([["sig-demo", { dedupeHash: "demo-seed-storm" }]]),
      }),
    ).toBe("demo");
  });

  it("returns live when no synthetic markers remain", () => {
    expect(
      detectDataViewMode({
        activeSignals: [{ dedupeHash: "news:rss:xyz" }],
        openFlags: [{ signalId: "sig-live" }],
        signalById: new Map([["sig-live", { dedupeHash: "news:rss:xyz" }]]),
      }),
    ).toBe("live");
  });
});
