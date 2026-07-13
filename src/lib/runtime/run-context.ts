import { randomUUID } from "node:crypto";

import type { Clock } from "@/lib/runtime/clock";
import { systemClock } from "@/lib/runtime/clock";
import type { Logger } from "@/lib/runtime/logger";
import { systemLogger } from "@/lib/runtime/logger";

export interface RunContext {
  clock: Clock;
  logger: Logger;
  mode: "live" | "replay";
  tickId: string;
}

export interface CreateRunContextOptions {
  clock?: Clock;
  logger?: Logger;
  mode?: RunContext["mode"];
  tickId?: string;
}

export const createRunContext = (
  options: CreateRunContextOptions = {},
): RunContext => ({
  clock: options.clock ?? systemClock,
  logger: options.logger ?? systemLogger,
  mode: options.mode ?? "live",
  tickId: options.tickId ?? randomUUID(),
});
