import type { ScenarioResult } from "@/evals/run-scenario";
import type {
  Scenario,
  ScenarioAssertionFailure,
  ScenarioAssertionReport,
} from "@/evals/types";
import type { AssessmentAlert } from "@/lib/agents/assessment-engine/assess";

const flagKey = (flag: {
  skuId: string;
  exposureType: string;
  shipmentId?: string;
}): string => `${flag.skuId}|${flag.exposureType}|${flag.shipmentId ?? ""}`;

const recommendationKey = (recommendation: { skuId: string }): string =>
  recommendation.skuId;

const alertKey = (alert: { riskFlagId?: string; level: string }): string =>
  `${alert.riskFlagId ?? ""}|${alert.level}`;

const alertsMatch = (
  expected: { riskFlagId?: string; level: string },
  actual: AssessmentAlert,
): boolean =>
  expected.level === actual.level &&
  (expected.riskFlagId === undefined || expected.riskFlagId === actual.flagId);

export const assertScenario = (
  scenario: Scenario,
  result: ScenarioResult,
): ScenarioAssertionReport => {
  const failures: ScenarioAssertionFailure[] = [];

  if (scenario.expected.flags !== undefined) {
    const expectedKeys = scenario.expected.flags.map(flagKey).sort();
    const actualKeys = result.flags.map(flagKey).sort();
    if (expectedKeys.join("\n") !== actualKeys.join("\n")) {
      failures.push({
        assertion: "flags",
        message: `Expected flags [${expectedKeys.join(", ")}], received [${actualKeys.join(", ")}].`,
      });
    }
  }

  if (scenario.expected.recommendations !== undefined) {
    const actualBySku = new Map(
      result.recommendations.map((recommendation) => [
        recommendationKey(recommendation),
        recommendation,
      ]),
    );
    const expectedSkuIds = scenario.expected.recommendations
      .map(recommendationKey)
      .sort();
    const actualSkuIds = [...actualBySku.keys()].sort();
    if (expectedSkuIds.join("\n") !== actualSkuIds.join("\n")) {
      failures.push({
        assertion: "recommendations",
        message: `Expected recommendations for [${expectedSkuIds.join(", ")}], received [${actualSkuIds.join(", ")}].`,
      });
    }
    for (const expected of scenario.expected.recommendations) {
      const actual = actualBySku.get(recommendationKey(expected));
      if (actual === undefined) continue;
      const expectedInsufficientData = expected.isInsufficientData ?? false;
      if (
        actual.ss !== expected.ss ||
        actual.rop !== expected.rop ||
        actual.recommendedQty !== expected.recommendedQty ||
        actual.isInsufficientData !== expectedInsufficientData
      ) {
        failures.push({
          assertion: "recommendations",
          message: `Recommendation for ${expected.skuId} did not exactly match SS/ROP/quantity/insufficient-data expectation.`,
        });
      }
    }
  }

  if (scenario.expected.alerts !== undefined) {
    const expectedAlerts = scenario.expected.alerts;
    const unmatchedActual = [...result.alerts];
    for (const expected of expectedAlerts) {
      const matchIndex = unmatchedActual.findIndex((actual) =>
        alertsMatch(expected, actual),
      );
      if (matchIndex === -1) {
        failures.push({
          assertion: "alerts",
          message: `Missing alert ${alertKey(expected)}.`,
        });
        continue;
      }
      unmatchedActual.splice(matchIndex, 1);
    }
    if (unmatchedActual.length > 0) {
      failures.push({
        assertion: "alerts",
        message: `Unexpected alerts [${unmatchedActual.map((alert) => `${alert.flagId}|${alert.level}`).join(", ")}].`,
      });
    }
  }

  if (result.sentDrafts.length > 0) {
    failures.push({
      assertion: "noUnapprovedSend",
      message: "Replay harness produced a sent draft without an approval path.",
    });
  }

  return {
    scenarioName: scenario.name,
    passed: failures.length === 0,
    failures,
  };
};
