import { z } from "zod";

import type { LlmCompletionClient } from "@/lib/adapters/llm/client";
import { env } from "@/lib/config/env";

export const supplierCommsDraftSchema = z
  .object({
    subject: z.string().trim().min(1),
    body: z.string().trim().min(1),
    tone: z.string().trim().min(1),
  })
  .strict();

export type SupplierCommsDraft = z.infer<typeof supplierCommsDraftSchema>;

export interface SupplierCommsDraftInput {
  readonly supplierName: string;
  readonly supplierContactContext: string;
  readonly sku: string;
  readonly recommendedQty: number;
  readonly rop: number;
  readonly inventoryPosition: number;
  readonly leadTimeDelta: number;
  readonly rationaleTemplate: string;
}

export const draftSupplierComms = async (
  input: Readonly<SupplierCommsDraftInput>,
  deps: { client?: LlmCompletionClient | undefined },
): Promise<SupplierCommsDraft | null> => {
  if (deps.client === undefined) return null;
  try {
    const response = await deps.client.chat.completions.create({
      model: env.LLM_MODEL_COMMS ?? "gpt-4o-mini",
      messages: [
        {
          role: "user",
          content: `Draft a professional supplier outreach email. Return JSON only with exactly subject, body, and tone. State the supplied numbers verbatim; do not recompute, infer, add, or alter numbers. Ask about expediting or reordering.\nDeterministic facts: ${JSON.stringify(input)}`,
        },
      ],
      max_tokens: 500,
      temperature: 0.2,
    });
    const content = response.choices[0]?.message.content;
    if (content === null || content === undefined) return null;
    return supplierCommsDraftSchema.parse(JSON.parse(content));
  } catch {
    return null;
  }
};
