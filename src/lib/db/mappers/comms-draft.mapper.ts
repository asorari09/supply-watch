import type { Database } from "@/lib/db/database.types";
import type { CommsDraft } from "@/lib/domain";

export const toCommsDraftRow = (
  draft: CommsDraft,
): Database["public"]["Tables"]["comms_drafts"]["Insert"] => ({
  id: draft.id,
  risk_flag_id: draft.riskFlagId,
  recommendation_id: draft.recommendationId,
  generation: draft.generation,
  subject: draft.subject,
  body: draft.body,
  tone: draft.tone,
  model_used: draft.modelUsed,
  status: draft.status,
  ...(draft.sentAt === undefined ? {} : { sent_at: draft.sentAt }),
  tick_id: draft.tickId,
  created_at: draft.createdAt,
});
