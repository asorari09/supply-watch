import { assertScenario } from "@/evals/assert-scenario";
import { runScenario } from "@/evals/run-scenario";
import { scenarios } from "@/evals/scenarios";
import { ceilToMoq } from "@/lib/inventory";
import type { ReorderEngineInput, ReorderResult } from "@/lib/inventory";

// Deliberately wrong: the numeric contract requires ceil(mu_LT + SS_raw), not ceil(mu_LT) + ceil(SS_raw).
export const computeReorderWithPerturbedRop = (
  input: ReorderEngineInput,
): ReorderResult => {
  if (
    input.holdingCost <= 0 ||
    input.moq <= 0 ||
    input.ltPrime <= 0 ||
    input.d <= 0
  )
    return {
      isInsufficientData: true,
      reason: "Canary input is invalid.",
      inputs: input,
    };

  const safetyStockRaw =
    input.sigmaLT === undefined
      ? input.z * input.sigmaD * Math.sqrt(input.ltPrime)
      : input.z *
        Math.sqrt(
          input.ltPrime * input.sigmaD ** 2 + input.d ** 2 * input.sigmaLT ** 2,
        );
  const ss = Math.ceil(safetyStockRaw);
  const rop = Math.ceil(input.d * input.ltPrime) + ss;
  const eoq = Math.ceil(
    Math.sqrt((2 * input.d * 365 * input.orderCost) / input.holdingCost),
  );
  const inventoryPosition = input.onHand + input.onOrder - input.backorders;
  const shouldReorder = inventoryPosition < rop;
  const recommendedQty = shouldReorder
    ? ceilToMoq(Math.max(eoq, rop - inventoryPosition), input.moq)
    : 0;

  return {
    isInsufficientData: false,
    ss,
    rop,
    eoq,
    inventoryPosition,
    shouldReorder,
    recommendedQty,
    formulaBranch:
      input.sigmaLT === undefined
        ? "lead_time_std_unknown"
        : "lead_time_std_known",
    rationaleTemplate: "Deliberately perturbed formula-canary result.",
    inputs: input,
  };
};

export const formulaCanaryCaught = (): boolean => {
  const goldenScenario = scenarios[0];
  if (goldenScenario === undefined)
    throw new Error("Formula canary requires the hurricane scenario.");

  return !assertScenario(
    goldenScenario,
    runScenario(goldenScenario, {
      computeReorder: computeReorderWithPerturbedRop,
    }),
  ).passed;
};
