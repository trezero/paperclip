/**
 * Resilient HTTP fetch with circuit breaker, timeout, and retry.
 *
 * Ported from MemeCoinInvestor2026/server/services/resilientHttp.ts
 * and adapted for the Paperclip plugin environment (no scaleMonitor dep).
 */

// ---------------------------------------------------------------------------
// Circuit breaker state
// ---------------------------------------------------------------------------

interface CircuitState {
  consecutiveFailures: number;
  openUntil: number;
}

const circuitByKey = new Map<string, CircuitState>();

export class CircuitOpenError extends Error {
  readonly retryAfterMs: number;

  constructor(serviceName: string, retryAfterMs: number) {
    super(`Circuit open for ${serviceName}. Retry after ${retryAfterMs}ms.`);
    this.name = "CircuitOpenError";
    this.retryAfterMs = retryAfterMs;
  }
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface ResilientFetchOptions {
  serviceName: string;
  endpointKey?: string;
  timeoutMs?: number;
  maxRetries?: number;
  baseRetryDelayMs?: number;
  retryStatuses?: number[];
  circuitFailureThreshold?: number;
  circuitOpenMs?: number;
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function circuitKey(serviceName: string, endpointKey?: string): string {
  return `${serviceName}:${endpointKey ?? "default"}`;
}

function defaultRetryStatuses(custom?: number[]): number[] {
  return custom ?? [408, 425, 429, 500, 502, 503, 504];
}

function toError(value: unknown): Error {
  return value instanceof Error ? value : new Error(String(value));
}

function markSuccess(key: string): void {
  circuitByKey.delete(key);
}

function markFailure(key: string, opts: ResilientFetchOptions): void {
  const threshold = opts.circuitFailureThreshold ?? 6;
  const openMs = opts.circuitOpenMs ?? 30_000;
  const current = circuitByKey.get(key) ?? { consecutiveFailures: 0, openUntil: 0 };
  const next = current.consecutiveFailures + 1;
  circuitByKey.set(key, {
    consecutiveFailures: next,
    openUntil: next >= threshold ? Date.now() + openMs : current.openUntil,
  });
}

function ensureClosed(key: string, opts: ResilientFetchOptions): void {
  const state = circuitByKey.get(key);
  if (!state || state.openUntil <= 0) return;
  if (state.openUntil <= Date.now()) {
    circuitByKey.delete(key);
    return;
  }
  throw new CircuitOpenError(opts.serviceName, Math.max(0, state.openUntil - Date.now()));
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function resilientFetch(
  url: string,
  init: RequestInit,
  opts: ResilientFetchOptions,
): Promise<Response> {
  const timeoutMs = opts.timeoutMs ?? 8_000;
  const maxRetries = opts.maxRetries ?? 2;
  const baseDelay = opts.baseRetryDelayMs ?? 250;
  const retryStatuses = defaultRetryStatuses(opts.retryStatuses);
  const key = circuitKey(opts.serviceName, opts.endpointKey);

  ensureClosed(key, opts);

  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(new Error(`Timeout after ${timeoutMs}ms`)),
      timeoutMs,
    );

    try {
      const response = await fetch(url, { ...init, signal: controller.signal });

      if (response.ok) {
        markSuccess(key);
        return response;
      }

      if (retryStatuses.includes(response.status) && attempt < maxRetries) {
        await sleep(baseDelay * 2 ** attempt);
        continue;
      }

      lastError = new Error(
        `${opts.serviceName} ${opts.endpointKey ?? url} returned ${response.status}`,
      );
      break;
    } catch (error) {
      lastError = toError(error);
      if (attempt < maxRetries) {
        await sleep(baseDelay * 2 ** attempt);
        continue;
      }
    } finally {
      clearTimeout(timeout);
    }
  }

  markFailure(key, opts);
  throw lastError ?? new Error(`${opts.serviceName} request failed`);
}
