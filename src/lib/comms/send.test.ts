import { describe, expect, it, vi } from "vitest";

import { sendDraft } from "@/lib/comms/send";
import type { Database } from "@/lib/db/database.types";
import { fixedClock, systemClock } from "@/lib/runtime/clock";

const draftId = "00000000-0000-4000-8000-000000000010";
const draft = (status: Database["public"]["Enums"]["comms_draft_status"]) =>
  ({
    id: draftId,
    status,
    subject: "Supplier outreach",
    body: "Original body",
  }) as unknown as Database["public"]["Tables"]["comms_drafts"]["Row"];
const approvedRecord = (editedBody: string | null = null) =>
  ({
    draft_id: draftId,
    decision: "approved",
    edited_body: editedBody,
  }) as unknown as Database["public"]["Tables"]["approval_records"]["Row"];
const clock = fixedClock(systemClock.now());

const send = async (
  status: Database["public"]["Enums"]["comms_draft_status"],
  approvals: Database["public"]["Tables"]["approval_records"]["Row"][],
  transport = { send: vi.fn(async () => undefined) },
) => {
  const transition = vi.fn(async () => draft("sent"));
  const result = await sendDraft({} as never, draftId, {
    clock,
    transport,
    findDraft: async () => draft(status),
    findApprovalRecords: async () => approvals,
    transitionDraft: transition,
  });
  return { result, transport, transition };
};

describe("sendDraft fail-closed workflow", () => {
  it("refuses a pending draft with no approval record", async () => {
    const { result, transport, transition } = await send(
      "pending_approval",
      [],
    );
    expect(result).toEqual({
      ok: false,
      refused: true,
      reason: "not approved",
    });
    expect(transport.send).not.toHaveBeenCalled();
    expect(transition).not.toHaveBeenCalled();
  });

  it("refuses a rejected draft", async () => {
    const { result, transport, transition } = await send("rejected", []);
    expect(result).toEqual({
      ok: false,
      refused: true,
      reason: "not approved",
    });
    expect(transport.send).not.toHaveBeenCalled();
    expect(transition).not.toHaveBeenCalled();
  });

  it("refuses an approved draft with no matching approval record", async () => {
    const { result, transport, transition } = await send("approved", []);
    expect(result).toEqual({
      ok: false,
      refused: true,
      reason: "not approved",
    });
    expect(transport.send).not.toHaveBeenCalled();
    expect(transition).not.toHaveBeenCalled();
  });

  it("sends only an approved draft with an approved record and marks it sent", async () => {
    const { result, transport, transition } = await send("approved", [
      approvedRecord(),
    ]);
    expect(result).toEqual({ ok: true, alreadySent: false });
    expect(transport.send).toHaveBeenCalledWith({
      draftId,
      subject: "Supplier outreach",
      body: "Original body",
    });
    expect(transition).toHaveBeenCalledWith(
      expect.anything(),
      draftId,
      "approved",
      "sent",
      expect.any(String),
    );
  });

  it("sends the approved edited body instead of the original", async () => {
    const { transport } = await send("approved", [
      approvedRecord("Edited body"),
    ]);
    expect(transport.send).toHaveBeenCalledWith(
      expect.objectContaining({ body: "Edited body" }),
    );
  });

  it("does not resend a draft that is already sent", async () => {
    const { result, transport, transition } = await send("sent", [
      approvedRecord(),
    ]);
    expect(result).toEqual({ ok: true, alreadySent: true });
    expect(transport.send).not.toHaveBeenCalled();
    expect(transition).not.toHaveBeenCalled();
  });
});
