import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";

import { runCommsAgent, type PendingDraftRef } from "@/lib/agents/comms-agent";
import type { Database } from "@/lib/db/database.types";
import { fixedClock, systemClock } from "@/lib/runtime/clock";
import type { Logger } from "@/lib/runtime/logger";
import { createRunContext } from "@/lib/runtime/run-context";

const logger: Logger = {
  info: () => undefined,
  warn: () => undefined,
  error: () => undefined,
};
const context = createRunContext({
  clock: fixedClock(systemClock.now()),
  logger,
  mode: "replay",
  tickId: "00000000-0000-4000-8000-000000000001",
});
const id = (index: number): string =>
  `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`;
const pending = (index: number): PendingDraftRef => ({
  riskFlagId: id(index + 10),
  recommendationId: id(index + 20),
  supplierName: "Acme Supply",
  supplierContactContext: "purchasing@acme.test",
  sku: `SKU-${index}`,
  recommendedQty: 100,
  rop: 50,
  inventoryPosition: 20,
  leadTimeDelta: 4,
  rationaleTemplate: "IP 20 < ROP 50.",
});
const draft = vi.fn(async () => ({
  subject: "Expedite",
  body: "Please expedite.",
  tone: "professional",
}));
const draftResult = () => ({
  subject: "Expedite",
  body: "Please expedite.",
  tone: "professional",
});
type CommsRows = Database["public"]["Tables"]["comms_drafts"]["Insert"][];
const persistenceStub = () =>
  vi.fn(async (_client: SupabaseClient<Database>, _rows: CommsRows) => {
    void _client;
    void _rows;
    return [];
  });

describe("runCommsAgent", () => {
  it("does not call the LLM or persist drafts when disabled", async () => {
    const persist = persistenceStub();
    await expect(
      runCommsAgent(context, [pending(1)], {
        client: {} as never,
        enableComms: false,
        draftSupplierComms: draft,
        upsertCommsDrafts: persist,
      }),
    ).resolves.toMatchObject({ drafted: 0, estCostUsd: 0 });
    expect(draft).not.toHaveBeenCalled();
    expect(persist).not.toHaveBeenCalled();
  });

  it("persists pending-approval drafts and caps calls", async () => {
    const cappedDraft = vi.fn(async () => draftResult());
    const persist = persistenceStub();
    const result = await runCommsAgent(
      context,
      [pending(1), pending(2), pending(3), pending(4)],
      {
        client: {} as never,
        enableComms: true,
        maxDrafts: 2,
        draftSupplierComms: cappedDraft,
        findCommsDrafts: async () => [],
        upsertCommsDrafts: persist,
      },
    );
    expect(cappedDraft).toHaveBeenCalledTimes(2);
    expect(persist).toHaveBeenCalledTimes(2);
    expect(persist.mock.calls[0]?.[1][0]).toMatchObject({
      status: "pending_approval",
      generation: 1,
      subject: "Expedite",
      body: "Please expedite.",
      tone: "professional",
    });
    expect(result).toMatchObject({ drafted: 2, skipped: 2 });
    expect(result.estCostUsd).toBeGreaterThan(0);
  });

  it("does not duplicate a draft when rerun", async () => {
    const persist = persistenceStub();
    const existing = new Map<
      string,
      { generation: number; status: "pending_approval" }[]
    >();
    const find = vi.fn(
      async (
        _client: SupabaseClient<Database>,
        riskFlagId: string,
        recommendationId: string,
      ) => existing.get(`${riskFlagId}|${recommendationId}`) ?? [],
    );
    const idempotentDraft = vi.fn(async () => draftResult());
    const deps = {
      client: {} as never,
      enableComms: true,
      maxDrafts: 1,
      draftSupplierComms: idempotentDraft,
      findCommsDrafts: find,
      upsertCommsDrafts: async (...args: Parameters<typeof persist>) => {
        await persist(...args);
        const row = args[1][0];
        if (row === undefined) return [];
        existing.set(`${row.risk_flag_id}|${row.recommendation_id}`, [
          { generation: row.generation, status: "pending_approval" },
        ]);
        return [];
      },
    };
    await runCommsAgent(context, [pending(1)], deps);
    await runCommsAgent(context, [pending(1)], deps);
    expect(idempotentDraft).toHaveBeenCalledTimes(1);
    expect(persist).toHaveBeenCalledTimes(1);
  });
});
