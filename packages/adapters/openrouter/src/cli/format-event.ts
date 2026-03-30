import pc from "picocolors";

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

export function printOpenRouterStreamEvent(raw: string, _debug: boolean): void {
  const line = raw.trim();
  if (!line) return;

  const parsed = asRecord(safeJsonParse(line));
  if (!parsed) {
    console.log(line);
    return;
  }

  const type = asString(parsed.type);
  if (type === "session") {
    const sessionId = asString(parsed.sessionId);
    const model = asString(parsed.model);
    console.log(pc.blue(`OpenRouter session ${sessionId}${model ? ` (${model})` : ""}`));
    return;
  }
  if (type === "assistant") {
    const content = asString(parsed.content);
    if (content) console.log(pc.green(content));
    return;
  }
  if (type === "result") {
    const usage = asRecord(parsed.usage);
    console.log(
      pc.blue(
        `OpenRouter result: in=${asNumber(usage?.input_tokens)} out=${asNumber(usage?.output_tokens)} cached=${asNumber(usage?.cached_input_tokens)} cost=$${asNumber(parsed.total_cost_usd).toFixed(6)}`,
      ),
    );
    return;
  }
  if (type === "error") {
    const message = asString(parsed.message);
    if (message) console.error(pc.red(message));
    return;
  }

  console.log(line);
}
