import { describe, expect, it } from "vitest";

import { fixedClock, systemClock } from "@/lib/runtime/clock";

describe("fixedClock", () => {
  it("returns the fixed instant", () => {
    const instant = systemClock.now();

    expect(fixedClock(instant).now().toISOString()).toBe(instant.toISOString());
  });
});
