import { assertScenario } from "@/evals/assert-scenario";
import { formulaCanaryCaught } from "@/evals/canary";
import { runScenario } from "@/evals/run-scenario";
import { scenarios } from "@/evals/scenarios";

export interface EvalMetricsSummary {
  scenariosTotal: number;
  scenariosPassed: number;
  numericExactnessAssertions: number;
  falsePositiveGuardPassed: boolean;
  degradeNotCrashPassed: boolean;
  insufficientDataPassed: boolean;
  noUnapprovedSendsPassed: boolean;
  canaryCaught: boolean;
}

export const summarizeEvals = (): EvalMetricsSummary => {
  const reports = scenarios.map((scenario) =>
    assertScenario(scenario, runScenario(scenario)),
  );
  const reportFor = (name: string) =>
    reports.find((report) => report.scenarioName === name)?.passed === true;

  return {
    scenariosTotal: scenarios.length,
    scenariosPassed: reports.filter((report) => report.passed).length,
    // Each fixture recommendation binds SS, ROP, recommended quantity, and insufficient-data status exactly.
    numericExactnessAssertions:
      scenarios.reduce(
        (total, scenario) =>
          total + (scenario.expected.recommendations?.length ?? 0),
        0,
      ) * 4,
    falsePositiveGuardPassed: reportFor(
      "false-positive guard for unrelated region",
    ),
    degradeNotCrashPassed: reportFor(
      "degraded signal is excluded without fabrication",
    ),
    insufficientDataPassed: reportFor(
      "insufficient holding-cost data is not actionable",
    ),
    noUnapprovedSendsPassed: reports.every((report) =>
      report.failures.every(
        (failure) => failure.assertion !== "noUnapprovedSend",
      ),
    ),
    canaryCaught: formulaCanaryCaught(),
  };
};

const summary = summarizeEvals();
console.log(JSON.stringify(summary, null, 2));
