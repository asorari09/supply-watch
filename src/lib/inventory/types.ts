export interface ReorderEngineInput {
  d: number;
  sigmaD: number;
  ltPrime: number;
  sigmaLT?: number;
  z: number;
  orderCost: number;
  holdingCost: number;
  moq: number;
  onHand: number;
  onOrder: number;
  backorders: number;
}

export interface SufficientReorderResult {
  isInsufficientData: false;
  ss: number;
  rop: number;
  eoq: number;
  inventoryPosition: number;
  shouldReorder: boolean;
  recommendedQty: number;
  formulaBranch: "lead_time_std_known" | "lead_time_std_unknown";
  rationaleTemplate: string;
  inputs: ReorderEngineInput;
}

export interface InsufficientReorderResult {
  isInsufficientData: true;
  reason: string;
  inputs: ReorderEngineInput;
}

export type ReorderResult = SufficientReorderResult | InsufficientReorderResult;
