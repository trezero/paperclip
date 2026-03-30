export const type = "openrouter";
export const label = "OpenRouter";

const OPENROUTER_FALLBACK_MODEL_IDS = [
  "anthropic/claude-sonnet-4-20250514",
  "google/gemini-2.5-flash",
  "google/gemini-2.5-pro",
  "openai/codex-5.4",
  "openai/gpt-4.1",
  "openai/gpt-5",
  "openai/gpt-5-mini",
  "x-ai/grok-4",
];

export const models = OPENROUTER_FALLBACK_MODEL_IDS.map((id) => ({ id, label: id }));

export const agentConfigurationDoc = `# openrouter agent configuration

Adapter: openrouter

Use when:
- You want a lightweight Paperclip agent backed directly by the OpenRouter chat-completions API
- You want inexpensive planning, writing, analysis, or coordination agents without installing a local CLI runtime
- You want OpenRouter billing and model routing while Paperclip persists conversation state between heartbeats

Don't use when:
- The agent needs local tools, filesystem access, terminal execution, or code edits (use claude_local, codex_local, gemini_local, opencode_local, pi_local, or cursor)
- You need webhook-style external invocation (use http or openclaw_gateway)

Core fields:
- instructionsFilePath (string, optional): absolute path to a markdown instructions file prepended to the system prompt
- promptTemplate (string, optional): heartbeat prompt template rendered for each run
- bootstrapPromptTemplate (string, optional): extra setup prompt only sent on the first Paperclip-managed session turn
- model (string, required): OpenRouter model id with provider prefix (for example openai/gpt-5 or anthropic/claude-sonnet-4-20250514)
- env (object, optional): environment variables; typically OPENROUTER_API_KEY or OPENAI_API_KEY
- maxConversationMessages (number, optional): number of prior user/assistant messages Paperclip should retain in session state (default 12)

Operational fields:
- timeoutSec (number, optional): HTTP request timeout in seconds (default 120)

Notes:
- This adapter is text-only. It does not grant filesystem, shell, browser, or tool access to the model.
- Paperclip stores prior user/assistant turns in sessionParams and replays that conversation state on later heartbeats.
- OpenRouter model discovery uses the public models API when possible and falls back to a small curated model list.
- Billing is reported as provider=<model prefix>, biller=openrouter, billingType=credits.
`;
