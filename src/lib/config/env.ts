import { z } from "zod";

const optionalNonEmptyString = z.string().trim().min(1).optional();

const envSchema = z.object({
  SUPABASE_URL: z.string().url(),
  SUPABASE_ANON_KEY: z.string().trim().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().trim().min(1),
  TICK_SECRET: z.string().trim().min(1),
  OPENAI_API_KEY: optionalNonEmptyString,
  ANTHROPIC_API_KEY: optionalNonEmptyString,
  LLM_MODEL_NEWS: optionalNonEmptyString,
  LLM_MODEL_NARRATION: optionalNonEmptyString,
  LLM_MODEL_COMMS: optionalNonEmptyString,
  OPEN_METEO_BASE_URL: optionalNonEmptyString,
  NEWS_RSS_FEEDS: optionalNonEmptyString,
});

export type Env = z.infer<typeof envSchema>;

export const env: Env = envSchema.parse(process.env);
