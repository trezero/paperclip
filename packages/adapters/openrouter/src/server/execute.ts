import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import type { AdapterExecutionContext, AdapterExecutionResult } from "@paperclipai/adapter-utils";
import {
  asNumber,
  asString,
  buildPaperclipEnv,
  joinPromptSections,
  parseObject,
  redactEnvForLogs,
  renderTemplate,
} from "@paperclipai/adapter-utils/server-utils";
import {
  OPENROUTER_CHAT_COMPLETIONS_URL,
  buildOpenRouterHeaders,
  readOpenRouterErrorDetail,
  resolveOpenRouterApiKey,
} from "./client.js";
import {
  normalizeStoredMessages,
  parseOpenRouterProvider,
  parseOpenRouterResponse,
  summarizeAssistantText,
  trimStoredMessages,
} from "./parse.js";

const DEFAULT_PROMPT_TEMPLATE =
  "You are agent {{agent.id}} ({{agent.name}}). Continue your Paperclip work. If this task requires tools, filesystem access, or command execution, say that this adapter is text-only and provide the best plan or next step you can.";
const DEFAULT_MAX_CONVERSATION_MESSAGES = 12;
const DEFAULT_TIMEOUT_SEC = 120;

function isAbortError(error: unknown): boolean {
  return (
    error instanceof Error &&
    (error.name === "AbortError" ||
      error.name === "TimeoutError" ||
      /aborted|timeout/i.test(error.message))
  );
}

function pickLogEnv(env: Record<string, string>): Record<string, string> {
  const picked: Record<string, string> = {};
  for (const key of [
    "OPENROUTER_API_KEY",
    "OPENAI_API_KEY",
    "PAPERCLIP_AGENT_ID",
    "PAPERCLIP_COMPANY_ID",
    "PAPERCLIP_API_URL",
  ]) {
    const value = env[key];
    if (typeof value === "string" && value.length > 0) picked[key] = value;
  }
  return picked;
}

async function readInstructionsPrefix(
  instructionsFilePath: string,
  onLog: AdapterExecutionContext["onLog"],
): Promise<string> {
  if (!instructionsFilePath.trim()) return "";

  const resolvedPath = path.resolve(instructionsFilePath.trim());
  const instructionsDir = `${path.dirname(resolvedPath)}/`;
  try {
    const instructionsContents = await fs.readFile(resolvedPath, "utf8");
    return (
      `${instructionsContents}\n\n` +
      `The above agent instructions were loaded from ${resolvedPath}. ` +
      `Resolve any relative file references from ${instructionsDir}.\n\n` +
      "You are operating through the Paperclip OpenRouter adapter. This adapter is text-only and does not provide filesystem, shell, browser, or tool access. Do not claim to have executed commands, edited files, or inspected local state.\n"
    );
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    await onLog(
      "stderr",
      `[paperclip] Warning: could not read agent instructions file "${resolvedPath}": ${reason}\n`,
    );
    return [
      "You are operating through the Paperclip OpenRouter adapter.",
      "This adapter is text-only and does not provide filesystem, shell, browser, or tool access.",
      "Do not claim to have executed commands, edited files, or inspected local state.",
    ].join(" ");
  }
}

async function emitJsonLog(
  onLog: AdapterExecutionContext["onLog"],
  stream: "stdout" | "stderr",
  payload: Record<string, unknown>,
) {
  await onLog(stream, `${JSON.stringify(payload)}\n`);
}

function mapStatusToErrorCode(status: number): string {
  switch (status) {
    case 400:
      return "openrouter_bad_request";
    case 401:
      return "openrouter_auth_required";
    case 402:
      return "openrouter_payment_required";
    case 404:
      return "openrouter_model_not_found";
    case 408:
      return "openrouter_timeout";
    case 429:
      return "openrouter_rate_limited";
    default:
      return "openrouter_request_failed";
  }
}

export async function execute(ctx: AdapterExecutionContext): Promise<AdapterExecutionResult> {
  const { runId, agent, runtime, config, context, onLog, onMeta, authToken } = ctx;

  const promptTemplate = asString(config.promptTemplate, DEFAULT_PROMPT_TEMPLATE);
  const bootstrapPromptTemplate = asString(config.bootstrapPromptTemplate, "").trim();
  const model = asString(config.model, "").trim();
  const timeoutSec = Math.max(0, asNumber(config.timeoutSec, DEFAULT_TIMEOUT_SEC));
  const maxConversationMessages = Math.max(
    0,
    asNumber(config.maxConversationMessages, DEFAULT_MAX_CONVERSATION_MESSAGES),
  );

  if (!model) {
    return {
      exitCode: 1,
      signal: null,
      timedOut: false,
      errorCode: "openrouter_model_required",
      errorMessage: "OpenRouter requires `adapterConfig.model`.",
      provider: null,
      biller: "openrouter",
      model: null,
      billingType: "credits",
    };
  }

  const envConfig = parseObject(config.env);
  const env: Record<string, string> = { ...buildPaperclipEnv(agent) };
  for (const [key, value] of Object.entries(envConfig)) {
    if (typeof value === "string") env[key] = value;
  }
  if (authToken && (!env.PAPERCLIP_API_KEY || !env.PAPERCLIP_API_KEY.trim())) {
    env.PAPERCLIP_API_KEY = authToken;
  }
  const mergedEnv = Object.fromEntries(
    Object.entries({ ...process.env, ...env }).filter(
      (entry): entry is [string, string] => typeof entry[1] === "string",
    ),
  );
  const apiKey = resolveOpenRouterApiKey(mergedEnv);
  if (!apiKey) {
    return {
      exitCode: 1,
      signal: null,
      timedOut: false,
      errorCode: "openrouter_auth_required",
      errorMessage: "OpenRouter requires OPENROUTER_API_KEY or OPENAI_API_KEY.",
      provider: parseOpenRouterProvider(model),
      biller: "openrouter",
      model,
      billingType: "credits",
    };
  }

  const runtimeSessionParams = parseObject(runtime.sessionParams);
  const sessionId = asString(runtimeSessionParams.sessionId, runtime.sessionId ?? "").trim() || randomUUID();
  const storedMessages = trimStoredMessages(
    normalizeStoredMessages(runtimeSessionParams.messages),
    maxConversationMessages,
  );

  const instructionsPrefix = await readInstructionsPrefix(
    asString(config.instructionsFilePath, ""),
    onLog,
  );
  const templateData = {
    agentId: agent.id,
    companyId: agent.companyId,
    runId,
    company: { id: agent.companyId },
    agent,
    run: { id: runId, source: "on_demand" },
    context,
  };
  const renderedPrompt = renderTemplate(promptTemplate, templateData);
  const renderedBootstrapPrompt =
    storedMessages.length === 0 && bootstrapPromptTemplate.length > 0
      ? renderTemplate(bootstrapPromptTemplate, templateData).trim()
      : "";
  const sessionHandoffNote = asString(context.paperclipSessionHandoffMarkdown, "").trim();
  const userPrompt = joinPromptSections([
    renderedBootstrapPrompt,
    sessionHandoffNote,
    renderedPrompt,
  ]);

  const messages = [
    ...(instructionsPrefix
      ? [{ role: "system" as const, content: instructionsPrefix }]
      : [{
          role: "system" as const,
          content:
            "You are operating through the Paperclip OpenRouter adapter. This adapter is text-only and does not provide filesystem, shell, browser, or tool access. Do not claim to have executed commands, edited files, or inspected local state.",
        }]),
    ...storedMessages,
    { role: "user" as const, content: userPrompt },
  ];

  if (onMeta) {
    await onMeta({
      adapterType: "openrouter",
      command: `POST ${OPENROUTER_CHAT_COMPLETIONS_URL}`,
      commandNotes: [
        "Direct OpenRouter chat-completions request",
        "Conversation state is persisted in Paperclip sessionParams",
      ],
      env: redactEnvForLogs(pickLogEnv(mergedEnv)),
      prompt: userPrompt,
      promptMetrics: {
        promptChars: userPrompt.length,
        instructionsChars: instructionsPrefix.length,
        bootstrapPromptChars: renderedBootstrapPrompt.length,
        sessionHandoffChars: sessionHandoffNote.length,
        heartbeatPromptChars: renderedPrompt.length,
        replayedMessages: storedMessages.length,
      },
      context,
    });
  }

  await emitJsonLog(onLog, "stdout", {
    type: "session",
    sessionId,
    model,
  });

  try {
    const response = await fetch(OPENROUTER_CHAT_COMPLETIONS_URL, {
      method: "POST",
      headers: buildOpenRouterHeaders(apiKey),
      body: JSON.stringify({
        model,
        messages,
        stream: false,
        user: sessionId,
        metadata: {
          paperclip_run_id: runId,
          paperclip_agent_id: agent.id,
          paperclip_company_id: agent.companyId,
        },
      }),
      ...(timeoutSec > 0 ? { signal: AbortSignal.timeout(timeoutSec * 1000) } : {}),
    });

    if (!response.ok) {
      const detail = await readOpenRouterErrorDetail(response);
      const message =
        detail ?? `OpenRouter request failed with status ${response.status}.`;
      await emitJsonLog(onLog, "stderr", {
        type: "error",
        message,
        status: response.status,
      });
      return {
        exitCode: 1,
        signal: null,
        timedOut: false,
        errorCode: mapStatusToErrorCode(response.status),
        errorMessage: message,
        sessionParams: {
          sessionId,
          messages: storedMessages,
        },
        sessionDisplayId: sessionId,
        provider: parseOpenRouterProvider(model),
        biller: "openrouter",
        model,
        billingType: "credits",
      };
    }

    const parsed = parseOpenRouterResponse(await response.json());
    const resolvedModel = parsed.model ?? model;
    const provider = parseOpenRouterProvider(resolvedModel);
    const assistantText =
      parsed.assistantText ||
      "OpenRouter returned an empty assistant message.";

    await emitJsonLog(onLog, "stdout", {
      type: "assistant",
      content: assistantText,
    });
    await emitJsonLog(onLog, "stdout", {
      type: "result",
      subtype: "success",
      model: resolvedModel,
      provider,
      biller: "openrouter",
      usage: {
        input_tokens: parsed.usage.inputTokens,
        output_tokens: parsed.usage.outputTokens,
        cached_input_tokens: parsed.usage.cachedInputTokens,
      },
      total_cost_usd: parsed.usage.costUsd,
    });

    const updatedMessages = trimStoredMessages(
      [
        ...storedMessages,
        { role: "user", content: userPrompt },
        { role: "assistant", content: assistantText },
      ],
      maxConversationMessages,
    );

    return {
      exitCode: 0,
      signal: null,
      timedOut: false,
      usage: {
        inputTokens: parsed.usage.inputTokens,
        outputTokens: parsed.usage.outputTokens,
        cachedInputTokens: parsed.usage.cachedInputTokens,
      },
      sessionParams: {
        sessionId,
        messages: updatedMessages,
      },
      sessionDisplayId: sessionId,
      provider,
      biller: "openrouter",
      model: resolvedModel,
      billingType: "credits",
      costUsd: parsed.usage.costUsd,
      resultJson: {
        id: parsed.id,
        finishReason: parsed.finishReason,
      },
      summary: summarizeAssistantText(assistantText),
    };
  } catch (error) {
    const timedOut = isAbortError(error);
    const message = timedOut
      ? `OpenRouter request timed out after ${timeoutSec}s.`
      : error instanceof Error
        ? error.message
        : String(error);
    await emitJsonLog(onLog, "stderr", {
      type: "error",
      message,
      timedOut,
    });
    return {
      exitCode: 1,
      signal: null,
      timedOut,
      errorCode: timedOut ? "openrouter_timeout" : "openrouter_request_failed",
      errorMessage: message,
      sessionParams: {
        sessionId,
        messages: storedMessages,
      },
      sessionDisplayId: sessionId,
      provider: parseOpenRouterProvider(model),
      biller: "openrouter",
      model,
      billingType: "credits",
    };
  }
}
