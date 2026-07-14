import { afterEach, describe, expect, it, vi } from "vitest";

const requiredEnv = {
  SUPABASE_URL: "https://example.supabase.co",
  SUPABASE_ANON_KEY: "anon-key",
  SUPABASE_SERVICE_ROLE_KEY: "service-role-key",
  TICK_SECRET:
    "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
};

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("env", () => {
  it("parses valid required configuration", async () => {
    vi.stubEnv("SUPABASE_URL", requiredEnv.SUPABASE_URL);
    vi.stubEnv("SUPABASE_ANON_KEY", requiredEnv.SUPABASE_ANON_KEY);
    vi.stubEnv(
      "SUPABASE_SERVICE_ROLE_KEY",
      requiredEnv.SUPABASE_SERVICE_ROLE_KEY,
    );
    vi.stubEnv("TICK_SECRET", requiredEnv.TICK_SECRET);

    const { env } = await import("@/lib/config/env");

    expect(env).toMatchObject(requiredEnv);
  });

  it("throws when a required value is missing", async () => {
    vi.stubEnv("SUPABASE_URL", "");
    vi.stubEnv("SUPABASE_ANON_KEY", requiredEnv.SUPABASE_ANON_KEY);
    vi.stubEnv(
      "SUPABASE_SERVICE_ROLE_KEY",
      requiredEnv.SUPABASE_SERVICE_ROLE_KEY,
    );
    vi.stubEnv("TICK_SECRET", requiredEnv.TICK_SECRET);

    await expect(import("@/lib/config/env")).rejects.toThrow();
  });
});
