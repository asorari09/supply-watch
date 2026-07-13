import type { ReorderEngineInput } from "@/lib/inventory/types";

export const ceilToMoq = (value: number, moq: number): number =>
  value <= 0 ? 0 : Math.max(moq, moq * Math.ceil(value / moq));

export interface SafetyStockRawResult {
  value: number;
  formulaBranch: "lead_time_std_known" | "lead_time_std_unknown";
}

export const safetyStockRaw = (
  input: ReorderEngineInput,
): SafetyStockRawResult => {
  if (input.sigmaLT !== undefined) {
    return {
      value:
        input.z *
        Math.sqrt(
          input.ltPrime * input.sigmaD ** 2 + input.d ** 2 * input.sigmaLT ** 2,
        ),
      formulaBranch: "lead_time_std_known",
    };
  }

  return {
    value: input.z * input.sigmaD * Math.sqrt(input.ltPrime),
    formulaBranch: "lead_time_std_unknown",
  };
};
