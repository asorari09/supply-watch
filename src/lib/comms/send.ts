import type { SupabaseClient } from "@supabase/supabase-js";

import { env } from "@/lib/config/env";
import type { Database } from "@/lib/db/database.types";
import { findApprovalRecordsForDraft } from "@/lib/db/repositories/approval-records.repo";
import {
  findCommsDraftById,
  transitionCommsDraftStatus,
} from "@/lib/db/repositories/comms-drafts.repo";
import { systemClock, type Clock } from "@/lib/runtime/clock";

type CommsDraftRow = Database["public"]["Tables"]["comms_drafts"]["Row"];
type ApprovalRecordRow =
  Database["public"]["Tables"]["approval_records"]["Row"];

export interface SendTransport {
  send(input: {
    draftId: string;
    subject: string;
    body: string;
  }): Promise<void>;
}

const loggedTransport: SendTransport = {
  send: async ({ draftId, subject }) => {
    console.info(
      JSON.stringify({ event: "mock_comms_send", draftId, subject }),
    );
  },
};

export interface SendDependencies {
  transport?: SendTransport | undefined;
  realTransport?: SendTransport | undefined;
  clock?: Clock | undefined;
  findDraft?: (
    client: SupabaseClient<Database>,
    draftId: string,
  ) => Promise<CommsDraftRow | null>;
  findApprovalRecords?: (
    client: SupabaseClient<Database>,
    draftId: string,
  ) => Promise<ApprovalRecordRow[] | null>;
  transitionDraft?: typeof transitionCommsDraftStatus | undefined;
}

export type SendResult =
  | { ok: true; alreadySent: boolean }
  | { ok: false; refused: true; reason: "not approved" | "error" };

export const sendDraft = async (
  client: SupabaseClient<Database>,
  draftId: string,
  deps: SendDependencies = {},
): Promise<SendResult> => {
  try {
    const findDraft = deps.findDraft ?? findCommsDraftById;
    const findApprovalRecords =
      deps.findApprovalRecords ?? findApprovalRecordsForDraft;
    const transitionDraft = deps.transitionDraft ?? transitionCommsDraftStatus;
    const draft = await findDraft(client, draftId);
    if (draft?.status === "sent") return { ok: true, alreadySent: true };
    if (draft?.status !== "approved") {
      return { ok: false, refused: true, reason: "not approved" };
    }
    const approvals = (await findApprovalRecords(client, draftId)) ?? [];
    const approval = approvals.find((record) => record.decision === "approved");
    if (approval === undefined) {
      return { ok: false, refused: true, reason: "not approved" };
    }
    const body = approval.edited_body ?? draft.body;
    const transport = env.ENABLE_REAL_SEND
      ? (deps.realTransport ?? loggedTransport)
      : (deps.transport ?? loggedTransport);
    await transport.send({
      draftId,
      subject: draft.subject,
      body,
    });
    const sent = await transitionDraft(
      client,
      draftId,
      "approved",
      "sent",
      (deps.clock ?? systemClock).now().toISOString(),
    );
    if (sent === null)
      return { ok: false, refused: true, reason: "not approved" };
    return { ok: true, alreadySent: false };
  } catch {
    return { ok: false, refused: true, reason: "error" };
  }
};
