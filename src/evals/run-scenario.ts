import type { Scenario } from "@/evals/types";
import {
  assess,
  type AssessmentResult,
} from "@/lib/agents/assessment-engine/assess";
import { correlate } from "@/lib/agents/assessment-engine/correlate";
import { fixedClock } from "@/lib/runtime/clock";
import { createRunContext, type RunContext } from "@/lib/runtime/run-context";

export interface EvalLlmStub {
  complete(): Promise<null>;
}

export interface RunScenarioDependencies {
  llm?: EvalLlmStub;
}

export interface ScenarioResult extends AssessmentResult {
  context: RunContext;
  sentDrafts: readonly [];
}

const defaultLlmStub: EvalLlmStub = {
  complete: async () => null,
};

export const runScenario = (
  scenario: Scenario,
  deps: RunScenarioDependencies = {},
): ScenarioResult => {
  const llm = deps.llm ?? defaultLlmStub;
  const context = createRunContext({
    clock: fixedClock(scenario.horizonBase),
    mode: "replay",
    tickId: "00000000-0000-4000-8000-000000000000",
  });
  void llm;

  const correlation = correlate({
    signals: scenario.timeline.flatMap((step) => step.signals),
    suppliers: scenario.initialInventory.suppliers,
    skus: scenario.initialInventory.skus,
    shipments: scenario.initialInventory.shipments,
  });
  const assessment = assess({
    correlation,
    horizonBase: context.clock.now().toISOString(),
  });

  return { ...assessment, context, sentDrafts: [] };
};
