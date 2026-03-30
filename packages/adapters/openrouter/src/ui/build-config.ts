import type { CreateConfigValues } from "@paperclipai/adapter-utils";

function parseEnvVars(text: string): Record<string, string> {
  const env: Record<string, string> = {};
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1);
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) continue;
    env[key] = value;
  }
  return env;
}

function parseEnvBindings(bindings: unknown): Record<string, unknown> {
  if (typeof bindings !== "object" || bindings === null || Array.isArray(bindings)) return {};
  const env: Record<string, unknown> = {};
  for (const [key, raw] of Object.entries(bindings)) {
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) continue;
    if (typeof raw === "string") {
      env[key] = { type: "plain", value: raw };
      continue;
    }
    if (typeof raw !== "object" || raw === null || Array.isArray(raw)) continue;
    const record = raw as Record<string, unknown>;
    if (record.type === "plain" && typeof record.value === "string") {
      env[key] = { type: "plain", value: record.value };
      continue;
    }
    if (record.type === "secret_ref" && typeof record.secretId === "string") {
      env[key] = {
        type: "secret_ref",
        secretId: record.secretId,
        ...(typeof record.version === "number" || record.version === "latest"
          ? { version: record.version }
          : {}),
      };
    }
  }
  return env;
}

export function buildOpenRouterConfig(v: CreateConfigValues): Record<string, unknown> {
  const config: Record<string, unknown> = {};
  if (v.instructionsFilePath) config.instructionsFilePath = v.instructionsFilePath;
  if (v.promptTemplate) config.promptTemplate = v.promptTemplate;
  if (v.bootstrapPrompt) config.bootstrapPromptTemplate = v.bootstrapPrompt;
  if (v.model) config.model = v.model;
  config.timeoutSec = 120;

  const env = parseEnvBindings(v.envBindings);
  const legacy = parseEnvVars(v.envVars);
  for (const [key, value] of Object.entries(legacy)) {
    if (!Object.prototype.hasOwnProperty.call(env, key)) {
      env[key] = { type: "plain", value };
    }
  }
  if (Object.keys(env).length > 0) config.env = env;

  return config;
}
