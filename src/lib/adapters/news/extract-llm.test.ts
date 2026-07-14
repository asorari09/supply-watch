import type OpenAI from "openai";
import { describe, expect, it, vi } from "vitest";

import type { LlmCompletionClient } from "@/lib/adapters/llm/client";
import { extractWithLlm } from "@/lib/adapters/news/extract-llm";
import { mapItemsToSignalsWithOptionalLlm } from "@/lib/adapters/news/map";
import { fixedClock, systemClock } from "@/lib/runtime/clock";
import type { Logger } from "@/lib/runtime/logger";
import { createRunContext } from "@/lib/runtime/run-context";

const logger: Logger = {
  info: () => undefined,
  warn: () => undefined,
  error: () => undefined,
};
const context = createRunContext({
  clock: fixedClock(systemClock.now()),
  logger,
  mode: "replay",
  tickId: "00000000-0000-4000-8000-000000000099",
});
const item = (index: number, title = `Shanghai port closure ${index}`) => ({
  title,
  description: "China disruption",
  link: `https://example.test/${index}`,
});
const client = (content: string | undefined, throws = false) =>
  ({
    chat: {
      completions: {
        create: vi.fn(async () => {
          if (throws) throw new Error("timeout");
          return {
            choices: [{ message: { content } }],
          } as OpenAI.Chat.Completions.ChatCompletion;
        }),
      },
    },
  }) as LlmCompletionClient;

describe("extractWithLlm", () => {
  it("parses valid extracted fields", async () =>
    expect(
      await extractWithLlm(item(1), {
        client: client(
          '{"disruptionType":"port_closure","affectedRegions":["CN"],"severityHint":"high"}',
        ),
      }),
    ).toEqual({
      disruptionType: "port_closure",
      affectedRegions: ["CN"],
      severityHint: "high",
    }));
  it.each([
    "not json",
    '{"disruptionType":"x","affectedRegions":["bad"],"severityHint":"urgent"}',
  ])("returns null for invalid output", async (content) =>
    expect(
      await extractWithLlm(item(1), { client: client(content) }),
    ).toBeNull(),
  );
  it("returns null without throwing on provider failure", async () =>
    expect(
      await extractWithLlm(item(1), { client: client(undefined, true) }),
    ).toBeNull());
});

describe("optional LLM news mapping", () => {
  it("does not call the LLM when disabled", async () => {
    const stub = client(
      '{"disruptionType":"x","affectedRegions":["CN"],"severityHint":"high"}',
    );
    const result = await mapItemsToSignalsWithOptionalLlm(
      [item(1), item(2)],
      context,
      { enableLlm: false, llmClient: stub },
    );
    expect(stub.chat.completions.create).not.toHaveBeenCalled();
    expect(result.signals).toHaveLength(2);
  });
  it("caps filtered LLM calls", async () => {
    const stub = client(
      '{"disruptionType":"port_closure","affectedRegions":["CN"],"severityHint":"high"}',
    );
    await mapItemsToSignalsWithOptionalLlm(
      [item(1), item(2), item(3), item(4)],
      context,
      { enableLlm: true, maxLlm: 2, llmClient: stub },
    );
    expect(stub.chat.completions.create).toHaveBeenCalledTimes(2);
  });
  it("never calls the LLM for filtered-out news and falls back after null extraction", async () => {
    const stub = client("not json");
    const result = await mapItemsToSignalsWithOptionalLlm(
      [item(1), item(2, "Company earnings update")],
      context,
      { enableLlm: true, maxLlm: 2, llmClient: stub },
    );
    expect(stub.chat.completions.create).toHaveBeenCalledTimes(1);
    expect(result.signals[0]?.disruptionType).toBe("port_closure");
  });
});
