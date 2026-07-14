import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";

import { approveDraft, rejectDraft } from "@/lib/comms/approval";
import type { Database } from "@/lib/db/database.types";
import { fixedClock, systemClock } from "@/lib/runtime/clock";

const draftId = "00000000-0000-4000-8000-000000000010";
const draft = (status: Database["public"]["Enums"]["comms_draft_status"]) =>
  ({
    id: draftId,
    status,
  }) as unknown as Database["public"]["Tables"]["comms_drafts"]["Row"];
const clock = fixedClock(systemClock.now());
type ApprovalInsert =
  Database["public"]["Tables"]["approval_records"]["Insert"];
const insertedRecord =
  {} as Database["public"]["Tables"]["approval_records"]["Row"];
const insertStub = () =>
  vi.fn(async (_client: SupabaseClient<Database>, _row: ApprovalInsert) => {
    void _client;
    void _row;
    return insertedRecord;
  });

describe("approval workflow", () => {
  it("approves a pending draft and creates an approval record", async () => {
    const transition = vi.fn(async () => draft("approved"));
    const insert = insertStub();
    const result = await approveDraft(
      {} as never,
      draftId,
      "Abhi",
      "Please expedite the revised quantity.",
      {
        clock,
        findDraft: async () => draft("pending_approval"),
        transitionDraft: transition,
        insertRecord: insert,
      },
    );
    expect(result).toMatchObject({
      ok: true,
      record: {
        decision: "approved",
        approver: "Abhi",
        editedBody: "Please expedite the revised quantity.",
      },
    });
    expect(transition).toHaveBeenCalledWith(
      expect.anything(),
      draftId,
      "pending_approval",
      "approved",
    );
    expect(insert.mock.calls[0]?.[1]).toMatchObject({
      draft_id: draftId,
      decision: "approved",
    });
  });

  it("refuses a non-pending approval without creating another record", async () => {
    const transition = vi.fn();
    const insert = vi.fn();
    await expect(
      approveDraft({} as never, draftId, "Abhi", undefined, {
        findDraft: async () => draft("approved"),
        transitionDraft: transition,
        insertRecord: insert,
      }),
    ).resolves.toEqual({ ok: false, refused: true, reason: "not pending" });
    expect(transition).not.toHaveBeenCalled();
    expect(insert).not.toHaveBeenCalled();
  });

  it("rejects a pending draft and records the rejection", async () => {
    const transition = vi.fn(async () => draft("rejected"));
    const insert = insertStub();
    await expect(
      rejectDraft({} as never, draftId, "Abhi", {
        clock,
        findDraft: async () => draft("pending_approval"),
        transitionDraft: transition,
        insertRecord: insert,
      }),
    ).resolves.toMatchObject({ ok: true, record: { decision: "rejected" } });
    expect(transition).toHaveBeenCalledWith(
      expect.anything(),
      draftId,
      "pending_approval",
      "rejected",
    );
    expect(insert.mock.calls[0]?.[1]).toMatchObject({
      decision: "rejected",
    });
  });
});
