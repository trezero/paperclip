import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  resetOpenRouterModelsCacheForTests,
  testEnvironment,
} from "@paperclipai/adapter-openrouter/server";

describe("openrouter environment diagnostics", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    resetOpenRouterModelsCacheForTests();
  });

  it("passes when model discovery and hello probe succeed", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes("/models")) {
        return new Response(
          JSON.stringify({
            data: [{ id: "openai/gpt-5-mini", name: "GPT-5 Mini" }],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
      if (url.includes("/chat/completions")) {
        return new Response(
          JSON.stringify({
            id: "gen-1",
            choices: [{ message: { content: "hello" }, finish_reason: "stop" }],
            usage: { prompt_tokens: 1, completion_tokens: 1, cost: 0 },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
      throw new Error(`Unexpected URL: ${url}`);
    });

    const result = await testEnvironment({
      companyId: "company-1",
      adapterType: "openrouter",
      config: {
        model: "openai/gpt-5-mini",
        env: {
          OPENROUTER_API_KEY: "sk-or-test",
        },
      },
    });

    expect(result.status).toBe("pass");
    expect(result.checks.some((check) => check.code === "openrouter_models_discovered")).toBe(true);
    expect(result.checks.some((check) => check.code === "openrouter_hello_probe_passed")).toBe(true);
  });

  it("fails when the API key is missing", async () => {
    const result = await testEnvironment({
      companyId: "company-1",
      adapterType: "openrouter",
      config: {
        model: "openai/gpt-5-mini",
      },
    });

    expect(result.status).toBe("fail");
    expect(result.checks.some((check) => check.code === "openrouter_api_key_missing")).toBe(true);
  });
});
