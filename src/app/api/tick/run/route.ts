import { randomUUID } from "node:crypto";

import type { TickTriggerSource } from "@/lib/domain";
import { systemClock } from "@/lib/runtime/clock";
import { createRunContext } from "@/lib/runtime/run-context";
import { verifyTickAuth } from "@/lib/tick/auth";
import { createDefaultTickDependencies, runTick } from "@/lib/tick/run-tick";

export const runtime = "nodejs";

const isTickTriggerSource = (value: unknown): value is TickTriggerSource =>
  value === "cron" ||
  value === "manual" ||
  value === "inject" ||
  value === "replay";

const requestTriggerSource = async (
  request: Request,
): Promise<TickTriggerSource> => {
  let bodyTriggerSource: unknown;
  try {
    const body: unknown = await request.json();
    if (typeof body === "object" && body !== null) {
      bodyTriggerSource = (body as Record<string, unknown>).triggerSource;
    }
  } catch {
    // An empty or malformed body is equivalent to not specifying a source.
  }

  if (isTickTriggerSource(bodyTriggerSource)) {
    return bodyTriggerSource;
  }

  const headerTriggerSource = request.headers.get("x-tick-trigger-source");
  return isTickTriggerSource(headerTriggerSource)
    ? headerTriggerSource
    : "cron";
};

export async function POST(request: Request): Promise<Response> {
  if (!verifyTickAuth(request)) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const triggerSource = await requestTriggerSource(request);
  const ctx = createRunContext({
    clock: systemClock,
    mode: "live",
    tickId: randomUUID(),
  });
  const dependencies = createDefaultTickDependencies();
  const result = await runTick(ctx, { ...dependencies, triggerSource });

  ctx.logger.info("Tick request completed.", {
    ok: result.ok,
    skipped: result.skipped,
    tickId: ctx.tickId,
    triggerSource,
  });

  if (!result.ok) {
    return Response.json({ error: "tick failed" }, { status: 500 });
  }

  return Response.json(result);
}
