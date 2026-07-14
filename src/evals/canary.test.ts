import { describe, expect, it } from "vitest";

import { assertScenario } from "@/evals/assert-scenario";
import {
  computeReorderWithPerturbedRop,
  formulaCanaryCaught,
} from "@/evals/canary";
import { runScenario } from "@/evals/run-scenario";
import { scenarios } from "@/evals/scenarios";

describe("formula canary", () => {
  it("detects a perturbed ROP formula against hand-computed expectations", () => {
    const goldenScenario = scenarios[0];
    if (goldenScenario === undefined)
      throw new Error("Formula canary requires the hurricane scenario.");

    const report = assertScenario(
      goldenScenario,
      runScenario(goldenScenario, {
        computeReorder: computeReorderWithPerturbedRop,
      }),
    );

    expect(report.passed).toBe(false);
    expect(report.failures).toContainEqual(
      expect.objectContaining({ assertion: "recommendations" }),
    );
    expect(formulaCanaryCaught()).toBe(true);
    console.info("formula-canary: detected perturbed ROP formula");
  });
});
