import type { Database } from "@/lib/db/database.types";
import type { ApprovalRecord } from "@/lib/domain";

export const toApprovalRecordRow = (
  record: ApprovalRecord,
): Database["public"]["Tables"]["approval_records"]["Insert"] => ({
  id: record.id,
  draft_id: record.draftId,
  decision: record.decision,
  approver: record.approver,
  ...(record.editedBody === undefined
    ? {}
    : { edited_body: record.editedBody }),
  decided_at: record.decidedAt,
});
