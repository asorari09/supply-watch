import { z } from "zod";

import {
  completeNewsExtraction,
  type LlmCompletionClient,
} from "@/lib/adapters/llm/client";
import type { NewsItemWire } from "@/lib/adapters/news/rss.wire";

const extractionSchema = z
  .object({
    disruptionType: z.string().min(1),
    affectedRegions: z.array(z.string().regex(/^[A-Z]{2}(-[A-Z0-9]{1,3})?$/)),
    severityHint: z.enum(["low", "med", "high", "unknown"]),
  })
  .strict();

export type LlmNewsExtraction = z.infer<typeof extractionSchema>;

export const extractWithLlm = async (
  item: NewsItemWire,
  deps: { client?: LlmCompletionClient | undefined },
): Promise<LlmNewsExtraction | null> => {
  const prompt = `Extract disruptionType, affectedRegions, severityHint from this news item. Return strict JSON only. Regions must be ISO-3166 codes; severityHint is low, med, high, or unknown.\nTitle: ${item.title ?? ""}\nDescription: ${item.description ?? ""}`;
  const result = await completeNewsExtraction(deps.client, prompt);
  if (!result.ok || result.content === undefined) return null;
  try {
    const trimmed = result.content.trim();
    const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
    const jsonText = fenced?.[1] ?? trimmed;
    return extractionSchema.parse(JSON.parse(jsonText));
  } catch {
    return null;
  }
};
