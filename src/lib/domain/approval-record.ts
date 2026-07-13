import { z } from "zod";

import { isoTimestampSchema, uuidStringSchema } from "@/lib/domain/common";
import { approvalDecisionSchema } from "@/lib/domain/enums";

export const approvalRecordSchema = z
  .object({
    id: uuidStringSchema,
    draftId: uuidStringSchema,
    decision: approvalDecisionSchema,
    approver: z.string(),
    editedBody: z.string().optional(),
    decidedAt: isoTimestampSchema,
  })
  .strict();
export type ApprovalRecord = z.infer<typeof approvalRecordSchema>;
export const approvalRecordInsertSchema = approvalRecordSchema.omit({
  id: true,
});
