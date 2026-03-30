import type { AdapterSessionCodec } from "@paperclipai/adapter-utils";
import { normalizeStoredMessages } from "./parse.js";

function readNonEmptyString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

export const sessionCodec: AdapterSessionCodec = {
  deserialize(raw: unknown) {
    if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return null;
    const record = raw as Record<string, unknown>;
    const sessionId =
      readNonEmptyString(record.sessionId) ??
      readNonEmptyString(record.session_id) ??
      readNonEmptyString(record.session);
    if (!sessionId) return null;
    const messages = normalizeStoredMessages(record.messages);
    return {
      sessionId,
      ...(messages.length > 0 ? { messages } : {}),
    };
  },
  serialize(params: Record<string, unknown> | null) {
    if (!params) return null;
    const sessionId =
      readNonEmptyString(params.sessionId) ??
      readNonEmptyString(params.session_id) ??
      readNonEmptyString(params.session);
    if (!sessionId) return null;
    const messages = normalizeStoredMessages(params.messages);
    return {
      sessionId,
      ...(messages.length > 0 ? { messages } : {}),
    };
  },
  getDisplayId(params: Record<string, unknown> | null) {
    if (!params) return null;
    return (
      readNonEmptyString(params.sessionId) ??
      readNonEmptyString(params.session_id) ??
      readNonEmptyString(params.session)
    );
  },
};

export { execute } from "./execute.js";
export { testEnvironment } from "./test.js";
export {
  discoverOpenRouterModels,
  discoverOpenRouterModelsCached,
  listOpenRouterModels,
  resetOpenRouterModelsCacheForTests,
} from "./models.js";
