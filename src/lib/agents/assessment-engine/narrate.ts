import type { LlmCompletionClient } from "@/lib/adapters/llm/client";
import type {
  AssessmentAlert,
  AssessmentFlag,
  AssessmentRecommendation,
  AssessmentResult,
} from "@/lib/agents/assessment-engine/assess";
import { env } from "@/lib/config/env";

export type ReadonlyAssessmentResult = Readonly<
  Pick<AssessmentResult, "flags" | "recommendations" | "alerts">
> & {
  readonly flags: ReadonlyArray<Readonly<AssessmentFlag>>;
  readonly recommendations: ReadonlyArray<Readonly<AssessmentRecommendation>>;
  readonly alerts: ReadonlyArray<Readonly<AssessmentAlert>>;
};

export const narrateAssessment = async (
  input: ReadonlyAssessmentResult,
  deps: { client?: LlmCompletionClient | undefined },
): Promise<string | null> => {
  if (deps.client === undefined) return null;
  try {
    const response = await deps.client.chat.completions.create({
      model: env.LLM_MODEL_NARRATION ?? "gpt-4o-mini",
      messages: [
        {
          role: "user",
          content: `Write a concise plain-English summary from these deterministic facts only. Do not add, infer, or change any values.\n${JSON.stringify(input)}`,
        },
      ],
      max_tokens: 250,
      temperature: 0,
    });
    const content = response.choices[0]?.message.content?.trim();
    return content === undefined || content.length === 0 ? null : content;
  } catch {
    return null;
  }
};
