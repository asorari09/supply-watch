import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createDefaultTickDependencies: vi.fn(() => ({})),
  runTick: vi.fn(),
  verifyTickAuth: vi.fn(),
}));

vi.mock("@/lib/tick/auth", () => ({
  verifyTickAuth: mocks.verifyTickAuth,
}));

vi.mock("@/lib/tick/run-tick", () => ({
  createDefaultTickDependencies: mocks.createDefaultTickDependencies,
  runTick: mocks.runTick,
}));

import { POST } from "./route";

describe("POST /api/tick/run", () => {
  it.each([undefined, "Bearer invalid-token"])(
    "returns 401 before running the pipeline for invalid authorization",
    async (authorization) => {
      mocks.verifyTickAuth.mockReturnValue(false);

      const request = new Request(
        "https://example.test/api/tick/run",
        authorization === undefined
          ? { method: "POST" }
          : { method: "POST", headers: { authorization } },
      );
      const response = await POST(request);

      expect(response.status).toBe(401);
      await expect(response.json()).resolves.toEqual({ error: "unauthorized" });
      expect(mocks.runTick).not.toHaveBeenCalled();
    },
  );

  it("returns tick counts for valid bearer authorization", async () => {
    mocks.verifyTickAuth.mockReturnValue(true);
    mocks.createDefaultTickDependencies.mockReturnValue({});
    mocks.runTick.mockResolvedValue({
      ok: true,
      skipped: false,
      tickId: "00000000-0000-4000-8000-000000000020",
      estCostUsd: 0,
      signalCounts: { upserted: 2 },
      assessmentCounts: { flags: 1, recommendations: 1, alerts: 1 },
    });

    const response = await POST(
      new Request("https://example.test/api/tick/run", {
        method: "POST",
        headers: { authorization: "Bearer test-tick-secret" },
        body: JSON.stringify({ triggerSource: "manual" }),
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      signalCounts: { upserted: 2 },
      assessmentCounts: { flags: 1, recommendations: 1, alerts: 1 },
    });
    expect(mocks.runTick).toHaveBeenCalledOnce();
  });
});
