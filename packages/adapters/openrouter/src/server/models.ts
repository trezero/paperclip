import type { AdapterModel } from "@paperclipai/adapter-utils";
import { models as fallbackModels } from "../index.js";
import {
  OPENROUTER_MODELS_URL,
  buildOpenRouterHeaders,
  readOpenRouterErrorDetail,
  resolveOpenRouterApiKey,
} from "./client.js";

const MODELS_CACHE_TTL_MS = 60_000;

const discoveryCache = new Map<string, { expiresAt: number; models: AdapterModel[] }>();

function dedupeModels(models: AdapterModel[]): AdapterModel[] {
  const seen = new Set<string>();
  const deduped: AdapterModel[] = [];
  for (const model of models) {
    const id = model.id.trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    deduped.push({ id, label: model.label.trim() || id });
  }
  return deduped;
}

function sortModels(models: AdapterModel[]): AdapterModel[] {
  return [...models].sort((a, b) =>
    a.id.localeCompare(b.id, "en", { numeric: true, sensitivity: "base" }),
  );
}

function cacheKey(apiKey: string | null): string {
  return apiKey ? "auth" : "anon";
}

function pruneExpiredDiscoveryCache(now: number) {
  for (const [key, value] of discoveryCache.entries()) {
    if (value.expiresAt <= now) discoveryCache.delete(key);
  }
}

function parseModelsPayload(payload: unknown): AdapterModel[] {
  if (typeof payload !== "object" || payload === null) return [];
  const data = (payload as Record<string, unknown>).data;
  if (!Array.isArray(data)) return [];

  const parsed: AdapterModel[] = [];
  for (const entry of data) {
    if (typeof entry !== "object" || entry === null || Array.isArray(entry)) continue;
    const record = entry as Record<string, unknown>;
    const id = typeof record.id === "string" ? record.id.trim() : "";
    const label =
      typeof record.name === "string" && record.name.trim().length > 0
        ? `${record.name.trim()} (${id})`
        : id;
    if (!id) continue;
    parsed.push({ id, label });
  }

  return sortModels(dedupeModels([...parsed, ...fallbackModels]));
}

export async function discoverOpenRouterModels(input: {
  apiKey?: string | null;
} = {}): Promise<AdapterModel[]> {
  const apiKey = input.apiKey ?? resolveOpenRouterApiKey(process.env);
  const headers = apiKey ? buildOpenRouterHeaders(apiKey) : { "Content-Type": "application/json" };
  const response = await fetch(OPENROUTER_MODELS_URL, { headers });

  if (!response.ok) {
    const detail = await readOpenRouterErrorDetail(response);
    throw new Error(
      detail
        ? `OpenRouter model discovery failed: ${detail}`
        : `OpenRouter model discovery failed with status ${response.status}.`,
    );
  }

  return parseModelsPayload(await response.json());
}

export async function discoverOpenRouterModelsCached(input: {
  apiKey?: string | null;
} = {}): Promise<AdapterModel[]> {
  const apiKey = input.apiKey ?? resolveOpenRouterApiKey(process.env);
  const now = Date.now();
  pruneExpiredDiscoveryCache(now);
  const key = cacheKey(apiKey);
  const cached = discoveryCache.get(key);
  if (cached && cached.expiresAt > now) return cached.models;

  const models = await discoverOpenRouterModels({ apiKey });
  discoveryCache.set(key, { expiresAt: now + MODELS_CACHE_TTL_MS, models });
  return models;
}

export async function listOpenRouterModels(): Promise<AdapterModel[]> {
  try {
    return await discoverOpenRouterModelsCached();
  } catch {
    return fallbackModels;
  }
}

export function resetOpenRouterModelsCacheForTests() {
  discoveryCache.clear();
}
