import { randomUUID } from "node:crypto";

import type { SupabaseClient } from "@supabase/supabase-js";

import {
  createCommsLlmClient,
  type LlmCompletionClient,
} from "@/lib/adapters/llm/client";
import {
  draftSupplierComms,
  type SupplierCommsDraftInput,
} from "@/lib/agents/comms-agent/draft";
import { env } from "@/lib/config/env";
import type { Database } from "@/lib/db/database.types";
import { toCommsDraftRow } from "@/lib/db/mappers/comms-draft.mapper";
import {
  findCommsDrafts,
  upsertCommsDrafts,
} from "@/lib/db/repositories/comms-drafts.repo";
import type { CommsDraft } from "@/lib/domain";
import type { RunContext } from "@/lib/runtime/run-context";

const ESTIMATED_COMMS_DRAFT_COST_USD = 0.0003;

export interface PendingDraftRef extends SupplierCommsDraftInput {
  readonly riskFlagId: string;
  readonly recommendationId: string;
}

interface ExistingDraft {
  generation: number;
  status: Database["public"]["Enums"]["comms_draft_status"];
}

export interface CommsAgentDependencies {
  client: SupabaseClient<Database>;
  llmClient?: LlmCompletionClient | undefined;
  enableComms?: boolean | undefined;
  maxDrafts?: number | undefined;
  draftSupplierComms?: typeof draftSupplierComms | undefined;
  findCommsDrafts?: (
    client: SupabaseClient<Database>,
    riskFlagId: string,
    recommendationId: string,
  ) => Promise<ExistingDraft[] | null>;
  upsertCommsDrafts?: typeof upsertCommsDrafts | undefined;
}

export interface CommsAgentResult {
  drafted: number;
  skipped: number;
  estCostUsd: number;
}

const generationFor = (drafts: readonly ExistingDraft[]): number | null => {
  if (drafts.some((draft) => draft.status !== "rejected")) return null;
  return drafts.length === 0
    ? 1
    : Math.max(...drafts.map((draft) => draft.generation)) + 1;
};

export const runCommsAgent = async (
  ctx: RunContext,
  pendingDraftRefs: readonly PendingDraftRef[],
  deps: CommsAgentDependencies,
): Promise<CommsAgentResult> => {
  const enableComms = deps.enableComms ?? env.ENABLE_LLM_COMMS;
  if (!enableComms)
    return { drafted: 0, skipped: pendingDraftRefs.length, estCostUsd: 0 };

  const maxDrafts = deps.maxDrafts ?? env.MAX_DRAFTS_PER_TICK;
  const llmClient = deps.llmClient ?? createCommsLlmClient();
  const draft = deps.draftSupplierComms ?? draftSupplierComms;
  const findExisting = deps.findCommsDrafts ?? findCommsDrafts;
  const persist = deps.upsertCommsDrafts ?? upsertCommsDrafts;
  let drafted = 0;
  let skipped = Math.max(0, pendingDraftRefs.length - maxDrafts);

  for (const pending of pendingDraftRefs.slice(0, maxDrafts)) {
    try {
      const existing =
        (await findExisting(
          deps.client,
          pending.riskFlagId,
          pending.recommendationId,
        )) ?? [];
      const generation = generationFor(existing);
      if (generation === null) {
        skipped += 1;
        continue;
      }
      const result = await draft(pending, { client: llmClient });
      if (result === null) {
        skipped += 1;
        continue;
      }
      const createdAt = ctx.clock.now().toISOString();
      const commsDraft: CommsDraft = {
        id: randomUUID(),
        riskFlagId: pending.riskFlagId,
        recommendationId: pending.recommendationId,
        generation,
        ...result,
        modelUsed: env.LLM_MODEL_COMMS ?? "gpt-4o-mini",
        status: "pending_approval",
        tickId: ctx.tickId,
        createdAt,
      };
      await persist(deps.client, [toCommsDraftRow(commsDraft)]);
      drafted += 1;
    } catch {
      skipped += 1;
      ctx.logger.warn("Comms draft skipped.", {
        riskFlagId: pending.riskFlagId,
        recommendationId: pending.recommendationId,
      });
    }
  }

  return {
    drafted,
    skipped,
    estCostUsd: drafted * ESTIMATED_COMMS_DRAFT_COST_USD,
  };
};
