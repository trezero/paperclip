---
title: OpenRouter
summary: Direct OpenRouter adapter setup and configuration
---

The `openrouter` adapter calls OpenRouter's chat-completions API directly. Unlike the local CLI adapters, it does not launch a local coding runtime or grant filesystem, shell, browser, or tool access. Paperclip keeps the conversation state itself by storing prior user and assistant turns in `sessionParams` and replaying them on later heartbeats.

## When To Use It

Use `openrouter` when you want:

- A lightweight API-backed agent without installing a local CLI runtime
- Planning, writing, analysis, research, or coordination agents that only need text I/O
- OpenRouter billing and provider routing while keeping the agent inside Paperclip's normal heartbeat model

Do not use `openrouter` when the agent must edit code, inspect the repo, run commands, or use local tools. In those cases, use a local runtime adapter such as `claude_local`, `codex_local`, `gemini_local`, `opencode_local`, `pi_local`, or `cursor`.

## Prerequisites

- `OPENROUTER_API_KEY` set in the environment or agent config
- Or `OPENAI_API_KEY` set, if you intentionally reuse that key for OpenRouter auth
- A valid OpenRouter model ID such as `openai/gpt-5`, `openai/gpt-5-mini`, or `anthropic/claude-sonnet-4-20250514`

## Configuration Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `model` | string | Yes | OpenRouter model ID with provider prefix, for example `openai/gpt-5` |
| `promptTemplate` | string | No | Prompt template rendered on every heartbeat |
| `bootstrapPromptTemplate` | string | No | Extra setup prompt injected only on the first Paperclip-managed session turn |
| `instructionsFilePath` | string | No | Absolute path to a markdown file prepended to the system prompt |
| `env` | object | No | Environment variables; typically `OPENROUTER_API_KEY` or `OPENAI_API_KEY` |
| `timeoutSec` | number | No | Request timeout in seconds. Defaults to `120` |
| `maxConversationMessages` | number | No | Number of prior user/assistant messages Paperclip keeps in session state. Defaults to `12` |

## Session Model

This adapter does not rely on a provider-specific session token. Instead, Paperclip persists normalized user and assistant messages in `sessionParams.messages` and sends that rolling conversation window back to OpenRouter on subsequent heartbeats.

That means:

- Session continuity is portable and fully managed by Paperclip
- The adapter works even when the upstream provider does not expose a resumable CLI session concept
- Long-running conversations should keep `maxConversationMessages` bounded so prompts do not grow without limit

## Prompt Assembly

The OpenRouter adapter assembles the request in three layers:

1. A fixed Paperclip system preamble that states the adapter is text-only and must not claim local tool access
2. Optional instructions loaded from `instructionsFilePath`
3. The rendered heartbeat prompt, plus `bootstrapPromptTemplate` on the first turn only

This keeps the agent honest about its capabilities while still supporting the same prompt-template and managed-instructions model used by other adapters.

## Model Discovery

The UI model picker tries to discover live models from OpenRouter's models API. If discovery fails, Paperclip falls back to a small curated model list so agent creation is still usable.

Because OpenRouter models are provider-prefixed, billing is reported as:

- `provider`: derived from the model prefix such as `openai`, `anthropic`, or `google`
- `biller`: `openrouter`
- `billingType`: `credits`

## Environment Test

Use the "Test Environment" action in the UI to validate the adapter config. It checks:

- The adapter is being used in its supported text-only mode
- `model` is configured
- An OpenRouter API key is present
- Model discovery can reach OpenRouter
- A live hello probe against chat-completions succeeds

If the hello probe fails, verify the API key, the selected model ID, and that the OpenRouter account has available credits.
