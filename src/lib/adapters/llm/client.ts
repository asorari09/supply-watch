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

export const completeNewsExtraction = async (
  client: LlmCompletionClient | undefined,
  prompt: string,
): Promise<LlmCompletionResult> => {
  if (client === undefined) return { ok: false };
  try {
    const completion = await client.chat.completions.create({
      model: env.LLM_MODEL_NEWS ?? "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 200,
      temperature: 0,
    });
    const content = completion.choices[0]?.message.content;
    return content === null || content === undefined
      ? { ok: false }
      : { ok: true, content };
  } catch {
    return { ok: false };
  }
};
