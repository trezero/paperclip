import type { UIAdapterModule } from "../types";
import { parseOpenRouterStdoutLine } from "@paperclipai/adapter-openrouter/ui";
import { OpenRouterConfigFields } from "./config-fields";
import { buildOpenRouterConfig } from "@paperclipai/adapter-openrouter/ui";

export const openRouterUIAdapter: UIAdapterModule = {
  type: "openrouter",
  label: "OpenRouter",
  parseStdoutLine: parseOpenRouterStdoutLine,
  ConfigFields: OpenRouterConfigFields,
  buildAdapterConfig: buildOpenRouterConfig,
};
