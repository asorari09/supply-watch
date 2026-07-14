import { describe, expect, it, vi } from "vitest";

const { tickSecret } = vi.hoisted(() => ({
  tickSecret:
    "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
}));

vi.mock("@/lib/config/env", () => ({
  env: { TICK_SECRET: tickSecret },
}));

import { verifyTickAuth } from "./auth";

const requestWithAuthorization = (authorization?: string): Request =>
  new Request(
    "https://example.test/api/tick/run",
    authorization === undefined ? {} : { headers: { authorization } },
  );

describe("verifyTickAuth", () => {
  it("accepts the configured bearer token", () => {
    expect(
      verifyTickAuth(requestWithAuthorization(`Bearer ${tickSecret}`)),
    ).toBe(true);
  });

  it("rejects a missing authorization header", () => {
    expect(verifyTickAuth(requestWithAuthorization())).toBe(false);
  });

  it.each(["Basic token", "Token token"])(
    "rejects the %s scheme",
    (authorization) => {
      expect(verifyTickAuth(requestWithAuthorization(authorization))).toBe(
        false,
      );
    },
  );

  it("rejects a wrong token of the same length", () => {
    expect(
      verifyTickAuth(
        requestWithAuthorization(
          "Bearer fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210",
        ),
      ),
    ).toBe(false);
  });

  it("rejects a token of a different length without throwing", () => {
    expect(() =>
      verifyTickAuth(requestWithAuthorization("Bearer short")),
    ).not.toThrow();
    expect(verifyTickAuth(requestWithAuthorization("Bearer short"))).toBe(
      false,
    );
  });
});
