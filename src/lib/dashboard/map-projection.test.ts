import { geoNaturalEarth1 } from "d3-geo";
import { describe, expect, it } from "vitest";

describe("network map projection geography", () => {
  it("places Japan far east of Texas under geoNaturalEarth1", () => {
    const projection = geoNaturalEarth1()
      .scale(155)
      .translate([440, 170])
      .center([12, 18]);

    const texas = projection([-95.37, 29.76]);
    const california = projection([-118.19, 33.77]);
    const germany = projection([8.68, 50.11]);
    const japan = projection([139.65, 35.68]);
    const china = projection([114.06, 22.54]);

    expect(texas).not.toBeNull();
    expect(japan).not.toBeNull();
    if (
      texas === null ||
      japan === null ||
      california === null ||
      germany === null ||
      china === null
    )
      throw new Error("projection returned null");

    // West-to-east: California/Texas left, Germany mid-right of them, China/Japan far right.
    expect(california[0]).toBeLessThan(texas[0]);
    expect(texas[0]).toBeLessThan(germany[0]);
    expect(germany[0]).toBeLessThan(china[0]);
    expect(china[0]).toBeLessThan(japan[0]);
    // Japan must not sit near the USA cluster.
    expect(japan[0] - texas[0]).toBeGreaterThan(250);
  });
});
