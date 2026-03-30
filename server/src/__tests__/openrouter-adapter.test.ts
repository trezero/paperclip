import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AdapterExecutionContext } from "@paperclipai/adapter-utils";
import { execute } from "@paperclipai/adapter-openrouter/server";

function buildContext(
  overrides: Partial<AdapterExecutionContext> = {},
): AdapterExecutionContext {
  const logs: Array<{ stream: "stdout" | "stderr"; chunk: string }> = [];
  return {
    runId: "run-1",
    agent: {
      id: "agent-1",
      companyId: "company-1",
      name: "Planner",
      adapterType: "openrouter",
      adapterConfig: {},
    },
    runtime: {
      sessionId: null,
      sessionParams: null,
      sessionDisplayId: null,
      taskKey: null,
    },
    config: {
      model: "openai/gpt-5-mini",
      promptTemplate: "Review {{ context.topic }}",
      env: {
        OPENROUTER_API_KEY: "sk-or-test",
      },
      maxConversationMessages: 4,
    },
    context: {
      topic: "launch plan",
    },
    onLog: async (stream, chunk) => {
      logs.push({ stream, chunk });
    },
    ...overrides,
  };
}

describe("openrouter adapter execute", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("returns usage, summary, provider data, and persisted session messages", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          id: "gen-1",
          model: "openai/gpt-5-mini",
          choices: [
            {
              message: { content: "First line\nSecond line" },
              finish_reason: "stop",
            },
          ],
          usage: {
            prompt_tokens: 12,
            completion_tokens: 8,
            prompt_tokens_details: { cached_tokens: 3 },
            cost: 0.00042,
          },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );

    const logChunks: string[] = [];
    const ctx = buildContext({
      onLog: async (_stream, chunk) => {
        logChunks.push(chunk);
      },
    });
    const result = await execute(ctx);

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const request = JSON.parse(String((fetchSpy.mock.calls[0]?.[1] as RequestInit).body));
    expect(request.model).toBe("openai/gpt-5-mini");
    expect(request.messages.at(-1)?.content).toContain("launch plan");

    expect(result.exitCode).toBe(0);
    expect(result.timedOut).toBe(false);
    expect(result.provider).toBe("openai");
    expect(result.biller).toBe("openrouter");
    expect(result.billingType).toBe("credits");
    expect(result.costUsd).toBeCloseTo(0.00042, 6);
    expect(result.summary).toBe("First line");
    expect(result.usage).toEqual({
      inputTokens: 12,
      outputTokens: 8,
      cachedInputTokens: 3,
    });
    expect(result.sessionDisplayId).toBeTypeOf("string");
    expect(result.sessionParams).toEqual({
      sessionId: expect.any(String),
      messages: [
        { role: "user", content: expect.stringContaining("launch plan") },
        { role: "assistant", content: "First line\nSecond line" },
      ],
    });
    expect(logChunks.join("")).toContain('"type":"assistant"');
    expect(logChunks.join("")).toContain('"type":"result"');
  });

  it("returns a configuration error when model is missing", async () => {
    const result = await execute(
      buildContext({
        config: {
          env: { OPENROUTER_API_KEY: "sk-or-test" },
        },
      }),
    );

    expect(result.exitCode).toBe(1);
    expect(result.errorCode).toBe("openrouter_model_required");
  });
});
