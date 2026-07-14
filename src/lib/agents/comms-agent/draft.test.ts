import type OpenAI from "openai";
import { describe, expect, it, vi } from "vitest";

import type { LlmCompletionClient } from "@/lib/adapters/llm/client";
import {
  draftSupplierComms,
  supplierCommsDraftSchema,
} from "@/lib/agents/comms-agent/draft";

const input = {
  supplierName: "Acme Supply",
  supplierContactContext: "purchasing@acme.test",
  sku: "SKU-42",
  recommendedQty: 100,
  rop: 50,
  inventoryPosition: 20,
  leadTimeDelta: 4,
  rationaleTemplate: "IP 20 < ROP 50.",
};

const client = (content: string | null, throws = false): LlmCompletionClient =>
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

describe("draftSupplierComms", () => {
  it("parses a mocked valid draft", async () =>
    expect(
      await draftSupplierComms(input, {
        client: client(
          '{"subject":"Expedite SKU-42","body":"Please expedite 100 units.","tone":"professional"}',
        ),
      }),
    ).toEqual({
      subject: "Expedite SKU-42",
      body: "Please expedite 100 units.",
      tone: "professional",
    }));

  it.each([
    "not json",
    '{"subject":"x","body":"y","tone":"professional","recommendedQty":100}',
  ])("rejects malformed or extra-field output: %s", async (content) =>
    expect(
      await draftSupplierComms(input, { client: client(content) }),
    ).toBeNull(),
  );

  it("rejects fields beyond subject, body, and tone", () =>
    expect(
      supplierCommsDraftSchema.safeParse({
        subject: "x",
        body: "y",
        tone: "professional",
        recommendedQty: 100,
      }).success,
    ).toBe(false));

  it("returns null when the provider throws", async () =>
    expect(
      await draftSupplierComms(input, { client: client(null, true) }),
    ).toBeNull());
});
