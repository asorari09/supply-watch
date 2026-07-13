import type { Signal } from "@/lib/domain";
import type { RunContext } from "@/lib/runtime/run-context";

export type SignalAdapterResult =
  | { ok: true; degraded?: boolean; signals: Signal[] }
  | { ok: false; degraded: true; reason: string };

export interface SignalAdapter {
  name: string;
  fetch(ctx: RunContext): Promise<SignalAdapterResult>;
}
