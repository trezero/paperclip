const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";

export const OPENROUTER_CHAT_COMPLETIONS_URL = `${OPENROUTER_BASE_URL}/chat/completions`;
export const OPENROUTER_MODELS_URL = `${OPENROUTER_BASE_URL}/models?output_modalities=text`;

function readNonEmptyString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

export function resolveOpenRouterApiKey(env: NodeJS.ProcessEnv | Record<string, string>): string | null {
  return readNonEmptyString(env.OPENROUTER_API_KEY) ?? readNonEmptyString(env.OPENAI_API_KEY);
}

export function buildOpenRouterHeaders(apiKey: string): Record<string, string> {
  return {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  };
}

function truncate(value: string, maxChars = 280): string {
  const trimmed = value.trim();
  if (trimmed.length <= maxChars) return trimmed;
  return `${trimmed.slice(0, maxChars - 1)}...`;
}

export async function readOpenRouterErrorDetail(response: Response): Promise<string | null> {
  const body = await response.text().catch(() => "");
  if (!body.trim()) return null;

  try {
    const parsed = JSON.parse(body) as Record<string, unknown>;
    const error =
      typeof parsed.error === "object" && parsed.error !== null
        ? (parsed.error as Record<string, unknown>)
        : null;
    const message =
      readNonEmptyString(error?.message) ??
      readNonEmptyString(parsed.message) ??
      readNonEmptyString(parsed.error) ??
      body;
    return message ? truncate(message) : null;
  } catch {
    return truncate(body);
  }
}
