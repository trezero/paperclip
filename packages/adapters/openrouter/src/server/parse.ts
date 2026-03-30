export type OpenRouterStoredMessage = {
  role: "user" | "assistant";
  content: string;
};

type ParsedOpenRouterUsage = {
  inputTokens: number;
  outputTokens: number;
  cachedInputTokens: number;
  costUsd: number;
};

type ParsedOpenRouterResponse = {
  id: string | null;
  model: string | null;
  finishReason: string | null;
  assistantText: string;
  usage: ParsedOpenRouterUsage;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function readNonEmptyString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function asFiniteNumber(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return 0;
}

export function extractOpenRouterTextContent(content: unknown): string {
  if (typeof content === "string") return content.trim();
  if (!Array.isArray(content)) return "";

  const chunks: string[] = [];
  for (const entry of content) {
    const part = asRecord(entry);
    if (!part) continue;
    if (part.type === "text" && typeof part.text === "string") {
      chunks.push(part.text);
    }
  }
  return chunks.join("").trim();
}

export function parseOpenRouterUsage(raw: unknown): ParsedOpenRouterUsage {
  const usage = asRecord(raw);
  const promptDetails = asRecord(usage?.prompt_tokens_details);
  const costRecord = asRecord(usage?.cost);

  return {
    inputTokens: asFiniteNumber(usage?.prompt_tokens),
    outputTokens: asFiniteNumber(usage?.completion_tokens),
    cachedInputTokens:
      asFiniteNumber(promptDetails?.cached_tokens) ||
      asFiniteNumber(promptDetails?.cache_read_tokens),
    costUsd:
      asFiniteNumber(usage?.cost) ||
      asFiniteNumber(usage?.total_cost) ||
      asFiniteNumber(costRecord?.total),
  };
}

export function parseOpenRouterResponse(raw: unknown): ParsedOpenRouterResponse {
  const parsed = asRecord(raw);
  const choices = Array.isArray(parsed?.choices) ? parsed?.choices : [];
  const firstChoice = asRecord(choices[0]);
  const message = asRecord(firstChoice?.message);

  return {
    id: readNonEmptyString(parsed?.id),
    model: readNonEmptyString(parsed?.model),
    finishReason: readNonEmptyString(firstChoice?.finish_reason),
    assistantText: extractOpenRouterTextContent(message?.content),
    usage: parseOpenRouterUsage(parsed?.usage),
  };
}

export function parseOpenRouterProvider(model: string | null): string | null {
  if (!model || !model.includes("/")) return null;
  const provider = model.slice(0, model.indexOf("/")).trim();
  return provider || null;
}

export function summarizeAssistantText(text: string): string | null {
  const firstLine = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find(Boolean);
  return firstLine ?? null;
}

export function normalizeStoredMessages(raw: unknown): OpenRouterStoredMessage[] {
  if (!Array.isArray(raw)) return [];

  const messages: OpenRouterStoredMessage[] = [];
  for (const entry of raw) {
    const record = asRecord(entry);
    if (!record) continue;
    const role = readNonEmptyString(record.role);
    const content = readNonEmptyString(record.content);
    if (!content) continue;
    if (role !== "user" && role !== "assistant") continue;
    messages.push({ role, content });
  }
  return messages;
}

export function trimStoredMessages(
  messages: OpenRouterStoredMessage[],
  maxMessages: number,
): OpenRouterStoredMessage[] {
  if (!Number.isFinite(maxMessages) || maxMessages <= 0) return [];
  if (messages.length <= maxMessages) return messages;
  return messages.slice(messages.length - maxMessages);
}
