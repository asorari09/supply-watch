import { randomUUID } from "node:crypto";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/db/database.types";
import { toApprovalRecordRow } from "@/lib/db/mappers/approval-record.mapper";
import { insertApprovalRecord } from "@/lib/db/repositories/approval-records.repo";
import {
  findCommsDraftById,
  transitionCommsDraftStatus,
} from "@/lib/db/repositories/comms-drafts.repo";
import type { ApprovalRecord } from "@/lib/domain";
import { systemClock, type Clock } from "@/lib/runtime/clock";

type CommsDraftRow = Database["public"]["Tables"]["comms_drafts"]["Row"];

export interface ApprovalDependencies {
  clock?: Clock | undefined;
  findDraft?: (
    client: SupabaseClient<Database>,
    draftId: string,
  ) => Promise<CommsDraftRow | null>;
  transitionDraft?: typeof transitionCommsDraftStatus | undefined;
  insertRecord?: typeof insertApprovalRecord | undefined;
}

export type ApprovalResult =
  | { ok: true; record: ApprovalRecord }
  | { ok: false; refused: true; reason: "not pending" | "error" };

const decideDraft = async (
  client: SupabaseClient<Database>,
  draftId: string,
  approver: string,
  decision: "approved" | "rejected",
  editedBody: string | undefined,
  deps: ApprovalDependencies,
): Promise<ApprovalResult> => {
  try {
    const findDraft = deps.findDraft ?? findCommsDraftById;
    const transitionDraft = deps.transitionDraft ?? transitionCommsDraftStatus;
    const insertRecord = deps.insertRecord ?? insertApprovalRecord;
    const draft = await findDraft(client, draftId);
    if (draft?.status !== "pending_approval") {
      return { ok: false, refused: true, reason: "not pending" };
    }
    const transitioned = await transitionDraft(
      client,
      draftId,
      "pending_approval",
      decision === "approved" ? "approved" : "rejected",
    );
    if (transitioned === null) {
      return { ok: false, refused: true, reason: "not pending" };
    }
    const record: ApprovalRecord = {
      id: randomUUID(),
      draftId,
      decision,
      approver,
      ...(editedBody === undefined ? {} : { editedBody }),
      decidedAt: (deps.clock ?? systemClock).now().toISOString(),
    };
    await insertRecord(client, toApprovalRecordRow(record));
    return { ok: true, record };
  } catch {
    return { ok: false, refused: true, reason: "error" };
  }
};

export const approveDraft = async (
  client: SupabaseClient<Database>,
  draftId: string,
  approver: string,
  editedBody?: string,
  deps: ApprovalDependencies = {},
): Promise<ApprovalResult> =>
  decideDraft(client, draftId, approver, "approved", editedBody, deps);

export const rejectDraft = async (
  client: SupabaseClient<Database>,
  draftId: string,
  approver: string,
  deps: ApprovalDependencies = {},
): Promise<ApprovalResult> =>
  decideDraft(client, draftId, approver, "rejected", undefined, deps);
