import { z } from "zod";

const optionalNonEmptyString = z.preprocess(
  (value: unknown) => (value === "" ? undefined : value),
  z.string().trim().min(1).optional(),
);

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
  WEATHER_TIMEOUT_MS: z.coerce.number().int().positive().default(8000),
  WEATHER_RETRIES: z.coerce.number().int().nonnegative().default(2),
  NEWS_RSS_FEEDS: optionalNonEmptyString,
  NEWS_TIMEOUT_MS: z.coerce.number().int().positive().default(8000),
});

export type Env = z.infer<typeof envSchema>;

export const env: Env = envSchema.parse(process.env);
