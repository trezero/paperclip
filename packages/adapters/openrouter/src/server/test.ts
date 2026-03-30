import fs from "node:fs/promises";
import path from "node:path";
import type {
  AdapterEnvironmentCheck,
  AdapterEnvironmentTestContext,
  AdapterEnvironmentTestResult,
} from "@paperclipai/adapter-utils";
import { asNumber, asString, parseObject } from "@paperclipai/adapter-utils/server-utils";
import {
  OPENROUTER_CHAT_COMPLETIONS_URL,
  buildOpenRouterHeaders,
  readOpenRouterErrorDetail,
  resolveOpenRouterApiKey,
} from "./client.js";
import { discoverOpenRouterModelsCached } from "./models.js";
import { parseOpenRouterResponse } from "./parse.js";

function summarizeStatus(checks: AdapterEnvironmentCheck[]): AdapterEnvironmentTestResult["status"] {
  if (checks.some((check) => check.level === "error")) return "fail";
  if (checks.some((check) => check.level === "warn")) return "warn";
  return "pass";
}

async function verifyInstructionsFile(
  checks: AdapterEnvironmentCheck[],
  instructionsFilePath: string,
) {
  if (!instructionsFilePath.trim()) return;

  const resolvedPath = path.resolve(instructionsFilePath.trim());
  try {
    const stats = await fs.stat(resolvedPath);
    if (!stats.isFile()) {
      checks.push({
        code: "openrouter_instructions_invalid",
        level: "error",
        message: "Configured instructionsFilePath is not a file.",
        detail: resolvedPath,
      });
      return;
    }
    checks.push({
      code: "openrouter_instructions_valid",
      level: "info",
      message: `Instructions file is readable: ${resolvedPath}`,
    });
  } catch (error) {
    checks.push({
      code: "openrouter_instructions_missing",
      level: "error",
      message: error instanceof Error ? error.message : "Instructions file is not readable.",
      detail: resolvedPath,
    });
  }
}

export async function testEnvironment(
  ctx: AdapterEnvironmentTestContext,
): Promise<AdapterEnvironmentTestResult> {
  const checks: AdapterEnvironmentCheck[] = [];
  const config = parseObject(ctx.config);
  const model = asString(config.model, "").trim();
  const timeoutSec = Math.max(0, asNumber(config.timeoutSec, 30));
  const env = Object.fromEntries(
    Object.entries(parseObject(config.env)).filter(
      (entry): entry is [string, string] => typeof entry[1] === "string",
    ),
  );
  const mergedEnv = Object.fromEntries(
    Object.entries({ ...process.env, ...env }).filter(
      (entry): entry is [string, string] => typeof entry[1] === "string",
    ),
  );
  const apiKey = resolveOpenRouterApiKey(mergedEnv);

  checks.push({
    code: "openrouter_text_only",
    level: "info",
    message: "OpenRouter adapter is text-only and does not expose local tools or filesystem access.",
  });

  await verifyInstructionsFile(checks, asString(config.instructionsFilePath, ""));

  if (!model) {
    checks.push({
      code: "openrouter_model_required",
      level: "error",
      message: "OpenRouter requires a configured model.",
      hint: "Set adapterConfig.model to a provider-prefixed model ID such as openai/gpt-5.",
    });
  } else {
    checks.push({
      code: "openrouter_model_configured",
      level: "info",
      message: `Configured model: ${model}`,
    });
  }

  if (!apiKey) {
    checks.push({
      code: "openrouter_api_key_missing",
      level: "error",
      message: "Missing OpenRouter API key.",
      hint: "Set OPENROUTER_API_KEY in adapter env bindings or host environment.",
    });
  } else {
    checks.push({
      code: "openrouter_api_key_present",
      level: "info",
      message: "OpenRouter API key detected.",
    });
  }

  const canRunProbe =
    checks.every((check) => check.level !== "error") &&
    model.length > 0 &&
    apiKey !== null;

  if (apiKey) {
    try {
      const discovered = await discoverOpenRouterModelsCached({ apiKey });
      checks.push({
        code: "openrouter_models_discovered",
        level: "info",
        message: `Discovered ${discovered.length} OpenRouter model(s).`,
      });
      if (model && !discovered.some((entry) => entry.id === model)) {
        checks.push({
          code: "openrouter_model_not_in_discovery",
          level: "warn",
          message: `Configured model "${model}" was not present in the discovered model list.`,
          hint: "Verify the model ID or try the adapter hello probe below.",
        });
      }
    } catch (error) {
      checks.push({
        code: "openrouter_models_discovery_failed",
        level: "warn",
        message: error instanceof Error ? error.message : "OpenRouter model discovery failed.",
        hint: "Model discovery is best-effort. A successful hello probe still confirms runtime readiness.",
      });
    }
  }

  if (canRunProbe) {
    try {
      const response = await fetch(OPENROUTER_CHAT_COMPLETIONS_URL, {
        method: "POST",
        headers: buildOpenRouterHeaders(apiKey!),
        body: JSON.stringify({
          model,
          messages: [{ role: "user", content: "Respond with hello." }],
          stream: false,
        }),
        ...(timeoutSec > 0 ? { signal: AbortSignal.timeout(timeoutSec * 1000) } : {}),
      });

      if (!response.ok) {
        const detail = await readOpenRouterErrorDetail(response);
        checks.push({
          code: "openrouter_hello_probe_failed",
          level: "error",
          message:
            detail ?? `OpenRouter hello probe failed with status ${response.status}.`,
          hint: "Verify the API key, model ID, and account credits for this OpenRouter account.",
        });
      } else {
        const parsed = parseOpenRouterResponse(await response.json());
        checks.push({
          code: "openrouter_hello_probe_passed",
          level: "info",
          message:
            parsed.assistantText.length > 0
              ? `Hello probe succeeded: ${parsed.assistantText}`
              : "Hello probe succeeded.",
        });
      }
    } catch (error) {
      checks.push({
        code: "openrouter_hello_probe_failed",
        level: "error",
        message: error instanceof Error ? error.message : "OpenRouter hello probe failed.",
      });
    }
  }

  return {
    adapterType: "openrouter",
    status: summarizeStatus(checks),
    checks,
    testedAt: new Date().toISOString(),
  };
}
