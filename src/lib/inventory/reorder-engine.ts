import { ceilToMoq, safetyStockRaw } from "@/lib/inventory/math";
import type { ReorderEngineInput, ReorderResult } from "@/lib/inventory/types";

const insufficient = (
  inputs: ReorderEngineInput,
  reason: string,
): ReorderResult => ({
  isInsufficientData: true,
  reason,
  inputs,
});

const requiredNumbers: Array<keyof Omit<ReorderEngineInput, "sigmaLT">> = [
  "d",
  "sigmaD",
  "ltPrime",
  "z",
  "orderCost",
  "holdingCost",
  "moq",
  "onHand",
  "onOrder",
  "backorders",
];

const invalidNumericField = (input: ReorderEngineInput): string | undefined => {
  for (const field of requiredNumbers) {
    if (!Number.isFinite(input[field])) {
      return field;
    }
  }

  if (input.sigmaLT !== undefined && !Number.isFinite(input.sigmaLT)) {
    return "sigmaLT";
  }

  return undefined;
};

export const computeReorder = (input: ReorderEngineInput): ReorderResult => {
  const invalidField = invalidNumericField(input);
  if (invalidField !== undefined) {
    return insufficient(input, `${invalidField} must be a finite number.`);
  }

  if (input.d <= 0) {
    return insufficient(input, "d must be greater than zero.");
  }

  if (input.ltPrime <= 0) {
    return insufficient(input, "ltPrime must be greater than zero.");
  }

  if (input.sigmaD < 0) {
    return insufficient(input, "sigmaD must be nonnegative.");
  }

  if (input.sigmaLT !== undefined && input.sigmaLT < 0) {
    return insufficient(input, "sigmaLT must be nonnegative when provided.");
  }

  if (input.holdingCost <= 0) {
    return insufficient(
      input,
      "holdingCost must be greater than zero (EOQ divide-by-zero guard).",
    );
  }

  if (input.orderCost < 0) {
    return insufficient(input, "orderCost must be nonnegative.");
  }

  if (input.moq <= 0) {
    return insufficient(input, "moq must be greater than zero.");
  }

  const meanLeadTimeDemand = input.d * input.ltPrime;
  const safetyStock = safetyStockRaw(input);
  const ss = Math.ceil(safetyStock.value);
  const rop = Math.ceil(meanLeadTimeDemand + safetyStock.value);
  const annualDemand = input.d * 365;
  const eoq = Math.ceil(
    Math.sqrt((2 * annualDemand * input.orderCost) / input.holdingCost),
  );
  const inventoryPosition = input.onHand + input.onOrder - input.backorders;
  const shouldReorder = inventoryPosition < rop;

  if (!shouldReorder) {
    return {
      isInsufficientData: false,
      ss,
      rop,
      eoq,
      inventoryPosition,
      shouldReorder,
      recommendedQty: 0,
      formulaBranch: safetyStock.formulaBranch,
      rationaleTemplate: `IP ${inventoryPosition} ≥ ROP ${rop}; no reorder.`,
      inputs: input,
    };
  }

  const shortfall = rop - inventoryPosition;
  const maxOrderBasis = Math.max(eoq, shortfall);
  const recommendedQty = ceilToMoq(maxOrderBasis, input.moq);

  return {
    isInsufficientData: false,
    ss,
    rop,
    eoq,
    inventoryPosition,
    shouldReorder,
    recommendedQty,
    formulaBranch: safetyStock.formulaBranch,
    rationaleTemplate: `IP ${inventoryPosition} < ROP ${rop}. SS ${ss}. Order ${recommendedQty} (EOQ ${eoq}, shortfall ${shortfall} → max ${maxOrderBasis} → MOQ ${recommendedQty}).`,
    inputs: input,
  };
};
