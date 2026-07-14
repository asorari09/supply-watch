import type { AlertLevel, Shipment, Signal, Sku, Supplier } from "@/lib/domain";

export interface Scenario {
  name: string;
  initialInventory: {
    suppliers: Supplier[];
    skus: Sku[];
    shipments: Shipment[];
  };
  timeline: Array<{
    at: string;
    signals: Signal[];
  }>;
  horizonBase: string;
  expected: {
    flags?: Array<{
      skuId: string;
      exposureType: string;
      shipmentId?: string;
    }>;
    recommendations?: Array<{
      skuId: string;
      ss: number;
      rop: number;
      recommendedQty: number;
      isInsufficientData?: boolean;
    }>;
    alerts?: Array<{
      riskFlagId?: string;
      level: AlertLevel;
    }>;
    noUnapprovedSend?: boolean;
  };
}

export interface ScenarioAssertionFailure {
  assertion: "flags" | "recommendations" | "alerts" | "noUnapprovedSend";
  message: string;
}

export interface ScenarioAssertionReport {
  scenarioName: string;
  passed: boolean;
  failures: ScenarioAssertionFailure[];
}
