import { z } from "zod";

const optionalNonEmptyString = z.preprocess(
  (value: unknown) => (value === "" ? undefined : value),
  z.string().trim().min(1).optional(),
);

const envSchema = z.object({
  SUPABASE_URL: z.string().url(),
  SUPABASE_ANON_KEY: z.string().trim().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().trim().min(1),
  TICK_SECRET: z.string().trim().min(32),
  OPENAI_API_KEY: optionalNonEmptyString,
  ENABLE_LLM_NEWS: z
    .preprocess((value) => value === "true", z.boolean())
    .default(false),
  MAX_NEWS_LLM_PER_TICK: z.coerce.number().int().positive().default(3),
  ENABLE_LLM_NARRATION: z
    .preprocess((value) => value === "true", z.boolean())
    .default(false),
  MAX_NARRATION_PER_TICK: z.coerce.number().int().positive().default(5),
  ENABLE_LLM_COMMS: z
    .preprocess((value) => value === "true", z.boolean())
    .default(false),
  MAX_DRAFTS_PER_TICK: z.coerce.number().int().positive().default(5),
  ENABLE_REAL_SEND: z
    .preprocess((value) => value === "true", z.boolean())
    .default(false),
  APPROVER_NAME: optionalNonEmptyString,
  LANGFUSE_PUBLIC_KEY: optionalNonEmptyString,
  LANGFUSE_SECRET_KEY: optionalNonEmptyString,
  LANGFUSE_BASE_URL: optionalNonEmptyString,
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

let parsedEnv: Env | undefined;

export const getEnv = (): Env => {
  if (parsedEnv === undefined) parsedEnv = envSchema.parse(process.env);
  return parsedEnv;
};

// Keep existing consumers lazy while preserving the `env.FIELD` call surface.
export const env: Env = new Proxy({} as Env, {
  get: (_target, property, receiver) =>
    Reflect.get(getEnv(), property, receiver),
  getOwnPropertyDescriptor: (_target, property) =>
    Object.getOwnPropertyDescriptor(getEnv(), property),
  has: (_target, property) => Reflect.has(getEnv(), property),
  ownKeys: () => Reflect.ownKeys(getEnv()),
});
