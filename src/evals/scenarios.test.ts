import { describe, expect, it } from "vitest";

import { assertScenario } from "@/evals/assert-scenario";
import { runScenario } from "@/evals/run-scenario";
import { deferredTo13c, scenarios } from "@/evals/scenarios";

describe("hand-computed disruption scenarios", () => {
  for (const scenario of scenarios) {
    it(scenario.name, () => {
      expect(assertScenario(scenario, runScenario(scenario))).toEqual({
        scenarioName: scenario.name,
        passed: true,
        failures: [],
      });
    });
  }

  it("defers persisted resolution lifecycle coverage to 13c", () => {
    expect(deferredTo13c).toEqual(["signal resolves -> flag clears"]);
  });
});
