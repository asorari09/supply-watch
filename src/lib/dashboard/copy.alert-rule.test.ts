import { describe, expect, it } from "vitest";

import { formatAlertRuleReason } from "@/lib/dashboard/copy";

describe("formatAlertRuleReason", () => {
  it("explains the 50% shortfall critical branch with real numbers", () => {
    expect(
      formatAlertRuleReason({
        level: "critical",
        signalSeverity: "med",
        inventoryPosition: 105,
        rop: 1404,
      }),
    ).toBe(
      "Critical: projected stock (105) is 50% or more below reorder point (1404)",
    );
  });

  it("explains high signal severity when inventory gap is not the deep branch", () => {
    expect(
      formatAlertRuleReason({
        level: "critical",
        signalSeverity: "high",
        inventoryPosition: 1200,
        rop: 1404,
      }),
    ).toBe("Critical: linked disruption severity is high");
  });

  it("explains the 25% warning branch", () => {
    expect(
      formatAlertRuleReason({
        level: "warning",
        signalSeverity: "med",
        inventoryPosition: 1000,
        rop: 1404,
      }),
    ).toBe(
      "Warning: projected stock (1000) is 25% or more below reorder point (1404)",
    );
  });
});
