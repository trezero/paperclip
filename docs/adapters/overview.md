---
title: Adapters Overview
summary: What adapters are and how they connect agents to Paperclip
---

Adapters are the bridge between Paperclip's orchestration layer and agent runtimes. Each adapter knows how to invoke a specific kind of agent, capture its results, and translate runtime-specific details into Paperclip's execution model.

## How Adapters Work

When a heartbeat fires, Paperclip:

1. Looks up the agent's `adapterType` and `adapterConfig`
2. Calls the adapter's `execute()` function with the execution context
3. The adapter either spawns a local runtime or calls a remote API
4. The adapter captures output, parses usage/cost data, and returns a structured result

## Built-in Adapters

| Adapter | Type Key | Description |
|---------|----------|-------------|
| [Claude Local](/adapters/claude-local) | `claude_local` | Runs Claude Code CLI locally |
| [Codex Local](/adapters/codex-local) | `codex_local` | Runs OpenAI Codex CLI locally |
| [Gemini Local](/adapters/gemini-local) | `gemini_local` | Runs Gemini CLI locally |
| [OpenRouter](/adapters/openrouter) | `openrouter` | Calls OpenRouter directly as a text-only API-backed adapter |
| Cursor Local | `cursor` | Runs Cursor Agent locally |
| OpenCode Local | `opencode_local` | Runs OpenCode CLI locally (multi-provider `provider/model`) |
| PI Local | `pi_local` | Runs PI locally |
| OpenClaw Gateway | `openclaw_gateway` | Sends wake payloads to an OpenClaw gateway |
| [Process](/adapters/process) | `process` | Executes arbitrary shell commands |
| [HTTP](/adapters/http) | `http` | Sends webhooks to external agents |

## Adapter Architecture

Each adapter is a package with three modules:

```
packages/adapters/<name>/
  src/
    index.ts            # Shared metadata (type, label, models)
    server/
      execute.ts        # Core execution logic
      parse.ts          # Output parsing
      test.ts           # Environment diagnostics
    ui/
      parse-stdout.ts   # Stdout -> transcript entries for run viewer
      build-config.ts   # Form values -> adapterConfig JSON
    cli/
      format-event.ts   # Terminal output for `paperclipai run --watch`
```

Most adapters also provide a React config-fields component under `ui/src/adapters/<name>/config-fields.tsx` so the board can render adapter-specific configuration controls.

Three registries consume these modules:

| Registry | What it does |
|----------|-------------|
| **Server** | Executes agents, captures results |
| **UI** | Renders run transcripts, provides config forms |
| **CLI** | Formats terminal output for live watching |

## Choosing an Adapter

- **Need a coding agent with local tools and workspace access?** Use `claude_local`, `codex_local`, `gemini_local`, `opencode_local`, `pi_local`, or `cursor`
- **Need a lightweight text-only agent over a hosted model API?** Use `openrouter`
- **Need to run a script or command?** Use `process`
- **Need to call an external service?** Use `http`
- **Need to wake an OpenClaw deployment?** Use `openclaw_gateway`
- **Need something custom?** [Create your own adapter](/adapters/creating-an-adapter)
