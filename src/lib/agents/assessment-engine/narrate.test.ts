import { describe, expect, it, vi } from "vitest";

import type { LlmCompletionClient } from "@/lib/adapters/llm/client";
import type { AssessmentResult } from "@/lib/agents/assessment-engine/assess";
import { narrateAssessment } from "@/lib/agents/assessment-engine/narrate";
import { signalSchema } from "@/lib/domain";
import { fixedClock, systemClock } from "@/lib/runtime/clock";
import type { RunContext } from "@/lib/runtime/run-context";

const id = (index: number): string =>
  `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`;

const assessment = (count = 1): AssessmentResult => ({
  flags: Array.from({ length: count }, (_, index) => ({
    id: id(index + 100),
    signal: signalSchema.parse({
      id: id(index + 200),
      source: "weather" as const,
      disruptionType: "storm",
      affectedRegions: ["US-TX"],
      geo: { kind: "regions", regionCodes: ["US-TX"] },
      severity: "high" as const,
      delayDaysEstimate: 4,
      confidence: "high" as const,
      detectedAt: "2026-01-01T00:00:00.000Z",
      rawRef: `signal-${index}`,
      dedupeHash: `signal-${index}`,
      status: "active",
    }),
    skuId: id(index + 300),
    exposureType: "supplier_region" as const,
    computedLeadTimeDelta: 4,
  })),
  recommendations: Array.from({ length: count }, (_, index) => ({
    skuId: id(index + 300),
    riskFlagId: id(index + 100),
    ss: 10,
    rop: 50,
    inventoryPosition: 20,
    recommendedQty: 100,
    formulaBranch: "eoq",
    rationaleTemplate: "Deterministic rationale.",
    isInsufficientData: false,
    inputsHash: `hash-${index}`,
  })),
  alerts: Array.from({ length: count }, (_, index) => ({
    flagId: id(index + 100),
    level: "warning" as const,
  })),
  pendingDraftRefs: [],
});

const client = (
  implementation: () => Promise<string | null>,
): LlmCompletionClient =>
  ({
    chat: {
      completions: {
        create: vi.fn(async () => ({
          choices: [{ message: { content: await implementation() } }],
        })),
      },
    },
  }) as unknown as LlmCompletionClient;

describe("narrateAssessment", () => {
  it("returns mocked narration text", async () => {
    await expect(
      narrateAssessment(assessment(), {
        client: client(async () => "Summary."),
      }),
    ).resolves.toBe("Summary.");
  });

  it("returns null for provider failures and empty responses", async () => {
    const failing = {
      chat: {
        completions: {
          create: vi.fn(async () => Promise.reject(new Error("boom"))),
        },
      },
    } as unknown as LlmCompletionClient;
    await expect(
      narrateAssessment(assessment(), { client: failing }),
    ).resolves.toBeNull();
    await expect(
      narrateAssessment(assessment(), { client: client(async () => "   ") }),
    ).resolves.toBeNull();
  });
});

const mocked = vi.hoisted(() => ({
  assess: vi.fn(),
  correlate: vi.fn(() => ({ shipmentExposures: [] })),
}));

vi.mock("@/lib/agents/assessment-engine/assess", async (importOriginal) => ({
  ...(await importOriginal<
    typeof import("@/lib/agents/assessment-engine/assess")
  >()),
  assess: mocked.assess,
}));
vi.mock("@/lib/agents/assessment-engine/correlate", () => ({
  correlate: mocked.correlate,
}));
vi.mock("@/lib/db/repositories/alerts.repo", () => ({ upsertAlerts: vi.fn() }));
vi.mock("@/lib/db/repositories/reorder-recommendations.repo", () => ({
  upsertReorderRecommendations: vi.fn(),
}));
vi.mock("@/lib/db/repositories/risk-flags.repo", () => ({
  upsertRiskFlags: vi.fn(),
}));

const context = {
  tickId: "tick",
  clock: fixedClock(systemClock.now()),
} as unknown as RunContext;

const databaseClient = {
  from: vi.fn(() => ({
    select: vi.fn(() =>
      Object.assign(Promise.resolve({ data: [], error: null }), {
        eq: vi.fn(async () => ({ data: [], error: null })),
      }),
    ),
    update: vi.fn(() => ({ eq: vi.fn(async () => ({ error: null })) })),
  })),
};

describe("runAssessment narration", () => {
  it("does not call the injected LLM when narration is off and preserves decisions", async () => {
    const { runAssessment } = await import("@/lib/agents/assessment-engine");
    const llm = client(async () => "Should not be used.");
    mocked.assess.mockReturnValue(assessment());
    const withoutNarration = await runAssessment(context, {
      client: databaseClient as never,
      enableNarration: false,
    });
    const disabled = await runAssessment(context, {
      client: databaseClient as never,
      llmClient: llm,
    });

    expect(llm.chat.completions.create).not.toHaveBeenCalled();
    const baseline = withoutNarration.result;
    const disabledResult = disabled.result;
    if (!withoutNarration.ok || !disabled.ok || !baseline || !disabledResult)
      throw new Error("Expected success");
    expect(disabledResult).toMatchObject({
      flags: baseline.flags,
      recommendations: baseline.recommendations,
      alerts: baseline.alerts,
      narration: [null],
    });
  });

  it("caps narration calls for more assessments than the configured maximum", async () => {
    const { runAssessment } = await import("@/lib/agents/assessment-engine");
    const llm = client(async () => "Summary.");
    mocked.assess.mockReturnValue(assessment(4));
    await runAssessment(context, {
      client: databaseClient as never,
      llmClient: llm,
      enableNarration: true,
      maxNarration: 2,
    });
    expect(llm.chat.completions.create).toHaveBeenCalledTimes(2);
  });

  it("keeps decisions unchanged when narration returns null", async () => {
    const { runAssessment } = await import("@/lib/agents/assessment-engine");
    mocked.assess.mockReturnValue(assessment());
    const result = await runAssessment(context, {
      client: databaseClient as never,
      llmClient: client(async () => null),
      enableNarration: true,
      maxNarration: 1,
    });
    expect(result.ok && result.result).toMatchObject({
      flags: assessment().flags,
      recommendations: assessment().recommendations,
      alerts: assessment().alerts,
      narration: [null],
    });
  });
});
