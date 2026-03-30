import { accessSync, constants } from "node:fs";
import os from "node:os";
import path from "node:path";
import { asString } from "@paperclipai/adapter-utils/server-utils";

function isExecutable(filePath: string): boolean {
  try {
    accessSync(filePath, constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

function uniqueNonEmpty(values: Array<string | undefined | null>): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const value of values) {
    const normalized = typeof value === "string" ? value.trim() : "";
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    out.push(normalized);
  }
  return out;
}

function discoverOpenCodeBinaryFromHomes(): string | null {
  let userInfoHome: string | undefined;
  try {
    userInfoHome = os.userInfo().homedir;
  } catch {
    // Ignore userInfo lookup failures (for example, minimal container users).
  }
  const candidateHomes = uniqueNonEmpty([process.env.HOME, os.homedir(), userInfoHome]);
  for (const home of candidateHomes) {
    const candidate = path.join(home, ".opencode", "bin", "opencode");
    if (isExecutable(candidate)) return candidate;
  }
  return null;
}

export function resolveOpenCodeCommand(input: unknown): string {
  const configuredCommand = asString(input, "").trim();
  if (configuredCommand) return configuredCommand;

  const envOverride =
    typeof process.env.PAPERCLIP_OPENCODE_COMMAND === "string"
      ? process.env.PAPERCLIP_OPENCODE_COMMAND.trim()
      : "";
  if (envOverride) return envOverride;

  const discoveredBinary = discoverOpenCodeBinaryFromHomes();
  if (discoveredBinary) return discoveredBinary;

  return "opencode";
}
