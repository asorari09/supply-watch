import { Langfuse } from "langfuse";
import OpenAI from "openai";

import { env } from "@/lib/config/env";

export interface LlmCompletionClient {
  chat: {
    completions: {
      create: (
        input: OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming,
      ) => Promise<OpenAI.Chat.Completions.ChatCompletion>;
    };
  };
}

export interface LlmCompletionResult {
  ok: boolean;
  content?: string;
}

export const createNewsLlmClient = (): LlmCompletionClient | undefined =>
  env.OPENAI_API_KEY === undefined
    ? undefined
    : new OpenAI({ apiKey: env.OPENAI_API_KEY });

/**
 * Narration uses the same optional client construction as news extraction.
 * Keeping this factory separate makes the model surface explicit at call sites.
 */
export const createNarrationLlmClient = (): LlmCompletionClient | undefined =>
  env.OPENAI_API_KEY === undefined
    ? undefined
    : new OpenAI({ apiKey: env.OPENAI_API_KEY });

export const createCommsLlmClient = (): LlmCompletionClient | undefined =>
  env.OPENAI_API_KEY === undefined
    ? undefined
    : new OpenAI({ apiKey: env.OPENAI_API_KEY });

const createLangfuse = (): Langfuse | undefined => {
  // Only emit traces when the news LLM surface is explicitly enabled.
  // Keeps offline tests and default ticks at $0 with no network flush.
  if (!env.ENABLE_LLM_NEWS) return undefined;
  if (
    env.LANGFUSE_PUBLIC_KEY === undefined ||
    env.LANGFUSE_SECRET_KEY === undefined
  )
    return undefined;
  return new Langfuse({
    publicKey: env.LANGFUSE_PUBLIC_KEY,
    secretKey: env.LANGFUSE_SECRET_KEY,
    ...(env.LANGFUSE_BASE_URL === undefined
      ? {}
      : { baseUrl: env.LANGFUSE_BASE_URL }),
  });
};

export const completeNewsExtraction = async (
  client: LlmCompletionClient | undefined,
  prompt: string,
): Promise<LlmCompletionResult> => {
  if (client === undefined) return { ok: false };
  const model = env.LLM_MODEL_NEWS ?? "gpt-4o-mini";
  const langfuse = createLangfuse();
  const trace = langfuse?.trace({
    name: "news-extraction",
    metadata: { surface: "news", capped: true },
  });
  const generation = trace?.generation({
    name: "news-extraction",
    model,
    input: prompt,
    metadata: { surface: "news", capped: true },
  });
  try {
    const completion = await client.chat.completions.create({
      model,
      messages: [{ role: "user", content: prompt }],
      max_tokens: 200,
      temperature: 0,
    });
    const content = completion.choices[0]?.message.content;
    const ok = content !== null && content !== undefined;
    generation?.end({
      output: ok ? content : null,
      level: ok ? "DEFAULT" : "WARNING",
      ...(ok ? {} : { statusMessage: "empty_completion" }),
      ...(completion.usage === undefined
        ? {}
        : {
            usage: {
              input: completion.usage.prompt_tokens ?? null,
              output: completion.usage.completion_tokens ?? null,
              total: completion.usage.total_tokens ?? null,
            },
          }),
    });
    return ok ? { ok: true, content } : { ok: false };
  } catch (error: unknown) {
    generation?.end({
      level: "ERROR",
      statusMessage:
        error instanceof Error ? error.message : "news_extraction_failed",
    });
    return { ok: false };
  } finally {
    await langfuse?.flushAsync();
  }
};
