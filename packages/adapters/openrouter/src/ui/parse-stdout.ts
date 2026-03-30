import type { TranscriptEntry } from "@paperclipai/adapter-utils";

function safeJsonParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function asNumber(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return 0;
}

export function parseOpenRouterStdoutLine(line: string, ts: string): TranscriptEntry[] {
  const parsed = asRecord(safeJsonParse(line));
  if (!parsed) {
    const trimmed = line.trim();
    if (!trimmed) return [];
    return [{ kind: "stdout", ts, text: trimmed }];
  }

  const type = asString(parsed.type);
  if (type === "session") {
    const sessionId = asString(parsed.sessionId);
    const model = asString(parsed.model);
    if (!sessionId) return [];
    return [{ kind: "init", ts, model, sessionId }];
  }
  if (type === "assistant") {
    const content = asString(parsed.content);
    if (!content) return [];
    return [{ kind: "assistant", ts, text: content }];
  }
  if (type === "result") {
    const usage = asRecord(parsed.usage);
    return [{
      kind: "result",
      ts,
      text: asString(parsed.model, "OpenRouter"),
      inputTokens: asNumber(usage?.input_tokens),
      outputTokens: asNumber(usage?.output_tokens),
      cachedTokens: asNumber(usage?.cached_input_tokens),
      costUsd: asNumber(parsed.total_cost_usd),
      subtype: asString(parsed.subtype, "success"),
      isError: false,
      errors: [],
    }];
  }
  if (type === "error") {
    const message = asString(parsed.message);
    if (!message) return [];
    return [{ kind: "stderr", ts, text: message }];
  }

  return [{ kind: "stdout", ts, text: line.trim() }];
}
