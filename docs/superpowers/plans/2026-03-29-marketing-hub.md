# Marketing Hub Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a unified Marketing Hub as a BrandAmbassador plugin page with one host bridge extension (`navigateToEntity`), consolidating content pipeline management, tool execution, trend discovery, and engagement monitoring into a single workspace.

**Architecture:** The hub UI lives entirely in the BrandAmbassador plugin bundle as a `page` slot with `routePath: "marketing"`. The Paperclip host receives one small bridge addition (`navigateToEntity`) — the other two capabilities (`executeTool`, `getToolSchemas`) are implemented as plugin-side data/action handlers using the existing bridge infrastructure. Plugin UI is built with esbuild as an ESM bundle, sharing React and the SDK via the host's bare-specifier shim system.

**Tech Stack:** React 19, TypeScript, esbuild (ESM bundler), Paperclip Plugin SDK (`@paperclipai/plugin-sdk/ui`), inline CSS-in-JS styles (matching existing plugin UI patterns)

---

## File Structure

### Paperclip Host (3 files modified)

| File | Action | Purpose |
|------|--------|---------|
| `packages/plugins/sdk/src/ui/types.ts` | Modify | Add `NavigateToEntityParams` type |
| `packages/plugins/sdk/src/ui/hooks.ts` | Modify | Add `useNavigateToEntity` hook shim |
| `packages/plugins/sdk/src/ui/index.ts` | Modify | Export new hook + type |
| `ui/src/plugins/bridge.ts` | Modify | Implement concrete `useNavigateToEntity` |
| `ui/src/plugins/bridge-init.ts` | Modify | Register `useNavigateToEntity` in global bridge |
| `ui/src/plugins/slots.tsx` | Modify | Add `useNavigateToEntity` to sdk-ui shim exports |

### BrandAmbassador Plugin (backend — 4 files modified)

| File | Action | Purpose |
|------|--------|---------|
| `src/constants.ts` | Modify | Add `marketingHub` slot/export IDs, new handler keys |
| `src/manifest.ts` | Modify | Add Marketing Hub page slot with `routePath` |
| `src/handlers/data.ts` | Modify | Add `tool-schemas`, `pipeline` data handlers |
| `src/handlers/actions.ts` | Modify | Add `execute-tool`, `create-pipeline-card`, `update-card-status` action handlers |

### BrandAmbassador Plugin (UI — 10 files created, 1 modified)

| File | Action | Purpose |
|------|--------|---------|
| `ui/index.tsx` | Modify | Add `MarketingHubPage` export |
| `ui/pages/MarketingHub.tsx` | Create | Root hub layout: sidebar + canvas + detail panel |
| `ui/pages/marketing/types.ts` | Create | Shared types: ContentCard, HubSection, etc. |
| `ui/pages/marketing/styles.ts` | Create | Shared style constants |
| `ui/pages/marketing/Sidebar.tsx` | Create | Nav sections + brand context footer |
| `ui/pages/marketing/Pipeline.tsx` | Create | Kanban board: Draft → Review → Approved → Published |
| `ui/pages/marketing/DetailPanel.tsx` | Create | Right panel: card detail, media preview, actions |
| `ui/pages/marketing/Create.tsx` | Create | Tool palette, parameter forms, chained execution |
| `ui/pages/marketing/Discover.tsx` | Create | Trend list with filters |
| `ui/pages/marketing/Monitor.tsx` | Create | Published post engagement overview |
| `ui/pages/marketing/BrandContext.tsx` | Create | Inline brand settings editor |

---

## Phase 1: Host Bridge Extension (`navigateToEntity`)

### Task 1: Add SDK Types for `navigateToEntity`

**Files:**
- Modify: `packages/plugins/sdk/src/ui/types.ts` (after line 382)

- [ ] **Step 1: Add `NavigateToEntityParams` type and `NavigateToEntityFn` type**

Add at the end of `packages/plugins/sdk/src/ui/types.ts` (after the `PluginActionFn` type on line 381):

```typescript
// ---------------------------------------------------------------------------
// useNavigateToEntity hook types
// ---------------------------------------------------------------------------

/**
 * Parameters for navigating to a Paperclip entity from plugin UI.
 *
 * The host translates the entity type + ID into the correct host route.
 * Plugin components never need to know host routing details.
 *
 * @see PLUGIN_SPEC.md §19 — UI Extension Model
 */
export interface NavigateToEntityParams {
  /** The entity type to navigate to. */
  type: "issue" | "agent" | "project" | "company";
  /** The entity identifier — issue ref (e.g. "MF-147") or UUID. */
  id: string;
  /** Company ID for scoping the navigation. */
  companyId: string;
}

/**
 * Function returned by `useNavigateToEntity()`.
 * Navigates the host app to the given entity's detail page.
 */
export type NavigateToEntityFn = (params: NavigateToEntityParams) => void;
```

- [ ] **Step 2: Verify types compile**

Run: `cd /home/winadmin/projects/paperclip && npx tsc --noEmit -p packages/plugins/sdk/tsconfig.json 2>&1 | head -20`
Expected: No errors related to the new types.

- [ ] **Step 3: Commit**

```bash
cd /home/winadmin/projects/paperclip
git add packages/plugins/sdk/src/ui/types.ts
git commit -m "feat(sdk): add NavigateToEntityParams and NavigateToEntityFn types"
```

---

### Task 2: Add `useNavigateToEntity` Hook Shim to SDK

**Files:**
- Modify: `packages/plugins/sdk/src/ui/hooks.ts` (after line 174)
- Modify: `packages/plugins/sdk/src/ui/index.ts` (export additions)

- [ ] **Step 1: Add import for new type**

In `packages/plugins/sdk/src/ui/hooks.ts`, add `NavigateToEntityFn` to the import on line 1-7:

```typescript
import type {
  PluginDataResult,
  PluginActionFn,
  PluginHostContext,
  PluginStreamResult,
  PluginToastFn,
  NavigateToEntityFn,
} from "./types.js";
```

- [ ] **Step 2: Add `useNavigateToEntity` hook shim**

Add after `usePluginToast` (after line 174) in `packages/plugins/sdk/src/ui/hooks.ts`:

```typescript

// ---------------------------------------------------------------------------
// useNavigateToEntity
// ---------------------------------------------------------------------------

/**
 * Get a function that navigates the host app to a Paperclip entity.
 *
 * Lets plugin UI navigate to issues, agents, projects, or companies
 * without knowing host routing internals.
 *
 * @returns A function that navigates to the specified entity
 *
 * @example
 * ```tsx
 * function IssueLink({ issueRef, companyId }: { issueRef: string; companyId: string }) {
 *   const navigateToEntity = useNavigateToEntity();
 *   return (
 *     <button onClick={() => navigateToEntity({ type: "issue", id: issueRef, companyId })}>
 *       {issueRef}
 *     </button>
 *   );
 * }
 * ```
 */
export function useNavigateToEntity(): NavigateToEntityFn {
  const impl = getSdkUiRuntimeValue<() => NavigateToEntityFn>("useNavigateToEntity");
  return impl();
}
```

- [ ] **Step 3: Export from SDK UI index**

In `packages/plugins/sdk/src/ui/index.ts`, add the hook export on line 53 (inside the hooks re-export block):

Change the hooks export block (lines 48-54) to:

```typescript
export {
  usePluginData,
  usePluginAction,
  useHostContext,
  usePluginStream,
  usePluginToast,
  useNavigateToEntity,
} from "./hooks.js";
```

And add `NavigateToEntityParams` and `NavigateToEntityFn` to the types re-export block (after line 75, inside the first `export type` block from `./types.js`):

```typescript
// Bridge error and host context types
export type {
  PluginBridgeError,
  PluginBridgeErrorCode,
  PluginHostContext,
  PluginModalBoundsRequest,
  PluginRenderCloseEvent,
  PluginRenderCloseHandler,
  PluginRenderCloseLifecycle,
  PluginRenderEnvironmentContext,
  PluginLauncherBounds,
  PluginLauncherRenderEnvironment,
  PluginDataResult,
  PluginActionFn,
  PluginStreamResult,
  PluginToastTone,
  PluginToastAction,
  PluginToastInput,
  PluginToastFn,
  NavigateToEntityParams,
  NavigateToEntityFn,
} from "./types.js";
```

- [ ] **Step 4: Verify types compile**

Run: `cd /home/winadmin/projects/paperclip && npx tsc --noEmit -p packages/plugins/sdk/tsconfig.json 2>&1 | head -20`
Expected: No errors.

- [ ] **Step 5: Commit**

```bash
cd /home/winadmin/projects/paperclip
git add packages/plugins/sdk/src/ui/hooks.ts packages/plugins/sdk/src/ui/index.ts
git commit -m "feat(sdk): add useNavigateToEntity hook shim"
```

---

### Task 3: Implement Concrete `useNavigateToEntity` in Host Bridge

**Files:**
- Modify: `ui/src/plugins/bridge.ts` (after line 365)

- [ ] **Step 1: Add import for `useNavigate`**

At the top of `ui/src/plugins/bridge.ts`, find the router import (if not present, add it):

```typescript
import { useNavigate } from "@/lib/router";
```

Also add the type import:

```typescript
import type { NavigateToEntityParams, NavigateToEntityFn } from "@paperclipai/plugin-sdk/ui";
```

- [ ] **Step 2: Add `useNavigateToEntity` implementation**

Add after `useHostContext` (after line 365) in `ui/src/plugins/bridge.ts`:

```typescript

// ---------------------------------------------------------------------------
// useNavigateToEntity — concrete implementation
// ---------------------------------------------------------------------------

/**
 * Concrete implementation of `useNavigateToEntity()`.
 *
 * Translates entity type + ID into the correct host route and navigates.
 */
export function useNavigateToEntity(): NavigateToEntityFn {
  const navigate = useNavigate();
  const { hostContext } = usePluginBridgeContext();

  return useCallback(
    (params: NavigateToEntityParams) => {
      const { type, id, companyId } = params;
      const prefix = hostContext.companyPrefix;
      if (!prefix) return;

      switch (type) {
        case "issue":
          // Issue IDs are refs like "MF-147" — navigate to /:prefix/issues/:ref
          navigate(`/${prefix}/issues/${id}`);
          break;
        case "agent":
          navigate(`/${prefix}/agents/${id}`);
          break;
        case "project":
          navigate(`/${prefix}/projects/${id}`);
          break;
        case "company":
          navigate(`/${prefix}/dashboard`);
          break;
      }
    },
    [navigate, hostContext.companyPrefix],
  );
}
```

- [ ] **Step 3: Verify the host UI compiles**

Run: `cd /home/winadmin/projects/paperclip && npx tsc --noEmit -p ui/tsconfig.json 2>&1 | head -20`
Expected: No errors (or only pre-existing ones).

- [ ] **Step 4: Commit**

```bash
cd /home/winadmin/projects/paperclip
git add ui/src/plugins/bridge.ts
git commit -m "feat(bridge): implement useNavigateToEntity for plugin entity navigation"
```

---

### Task 4: Register `useNavigateToEntity` in Bridge Init and Slots Shim

**Files:**
- Modify: `ui/src/plugins/bridge-init.ts` (lines 15-21, 61-67)
- Modify: `ui/src/plugins/slots.tsx` (lines 258-262)

- [ ] **Step 1: Add import in bridge-init.ts**

In `ui/src/plugins/bridge-init.ts`, change the import block (lines 15-21) to:

```typescript
import {
  usePluginData,
  usePluginAction,
  useHostContext,
  usePluginStream,
  usePluginToast,
  useNavigateToEntity,
} from "./bridge.js";
```

- [ ] **Step 2: Register in sdkUi object**

In `ui/src/plugins/bridge-init.ts`, change the sdkUi object (lines 61-67) to:

```typescript
    sdkUi: {
      usePluginData,
      usePluginAction,
      useHostContext,
      usePluginStream,
      usePluginToast,
      useNavigateToEntity,
    },
```

- [ ] **Step 3: Update sdk-ui shim in slots.tsx**

In `ui/src/plugins/slots.tsx`, change the sdk-ui case (lines 257-262) to:

```typescript
    case "sdk-ui":
      source = `
        const SDK = globalThis.__paperclipPluginBridge__?.sdkUi ?? {};
        const { usePluginData, usePluginAction, useHostContext, usePluginStream, usePluginToast, useNavigateToEntity } = SDK;
        export { usePluginData, usePluginAction, useHostContext, usePluginStream, usePluginToast, useNavigateToEntity };
      `;
      break;
```

- [ ] **Step 4: Verify the host UI compiles**

Run: `cd /home/winadmin/projects/paperclip && npx tsc --noEmit -p ui/tsconfig.json 2>&1 | head -20`
Expected: No errors.

- [ ] **Step 5: Commit**

```bash
cd /home/winadmin/projects/paperclip
git add ui/src/plugins/bridge-init.ts ui/src/plugins/slots.tsx
git commit -m "feat(bridge): register useNavigateToEntity in bridge init and ESM shim"
```

---

## Phase 2: BrandAmbassador Plugin Backend

### Task 5: Update Constants

**Files:**
- Modify: `/home/winadmin/projects/BrandAmbassador/src/constants.ts`

- [ ] **Step 1: Add Marketing Hub slot ID and export name**

In `src/constants.ts`, add to the `SLOT_IDS` object (after `agentMarketingTab` on line 12):

```typescript
export const SLOT_IDS = {
  trendRadar: "trend-radar",
  contentPipeline: "content-pipeline",
  brandSettings: "brand-settings",
  knowledgeBase: "knowledge-base",
  engagement: "engagement",
  contentQueueWidget: "content-queue-status",
  comfyuiStatusWidget: "comfyui-status",
  agentMarketingTab: "agent-marketing-tools",
  marketingHub: "marketing-hub",
} as const;
```

Add to `EXPORT_NAMES` (after `agentMarketingTab` on line 23):

```typescript
export const EXPORT_NAMES = {
  trendRadar: "TrendRadarPage",
  contentPipeline: "ContentPipelinePage",
  brandSettings: "BrandSettingsPage",
  knowledgeBase: "KnowledgeBasePage",
  engagement: "EngagementPage",
  contentQueueWidget: "ContentQueueWidget",
  comfyuiStatusWidget: "ComfyUIStatusWidget",
  agentMarketingTab: "AgentMarketingToolsTab",
  marketingHub: "MarketingHubPage",
} as const;
```

- [ ] **Step 2: Add data and action handler keys**

Add after `STREAM_CHANNELS` (after line 52):

```typescript
export const DATA_KEYS = {
  trends: "trends",
  brandSettings: "brand-settings",
  knowledgeDocs: "knowledge-docs",
  conversations: "conversations",
  contentQueueStatus: "content-queue-status",
  comfyuiStatus: "comfyui-status",
  pluginConfig: "plugin-config",
  toolSchemas: "tool-schemas",
  pipeline: "pipeline",
  engagement: "engagement",
} as const;

export const ACTION_KEYS = {
  saveBrandSettings: "save-brand-settings",
  uploadDocument: "upload-document",
  searchKnowledge: "search-knowledge",
  dismissTrend: "dismiss-trend",
  executeTool: "execute-tool",
  createPipelineCard: "create-pipeline-card",
  updateCardStatus: "update-card-status",
} as const;
```

- [ ] **Step 3: Verify types compile**

Run: `cd /home/winadmin/projects/BrandAmbassador && npx tsc --noEmit 2>&1 | head -20`
Expected: No errors.

- [ ] **Step 4: Commit**

```bash
cd /home/winadmin/projects/BrandAmbassador
git add src/constants.ts
git commit -m "feat: add Marketing Hub constants (slot IDs, data/action keys)"
```

---

### Task 6: Add Marketing Hub Page Slot to Manifest

**Files:**
- Modify: `/home/winadmin/projects/BrandAmbassador/src/manifest.ts` (lines 249-259)

- [ ] **Step 1: Add Marketing Hub page slot**

In `src/manifest.ts`, update the `ui.slots` array (lines 250-258) to add the Marketing Hub page as the first slot with `routePath: "marketing"`:

```typescript
  ui: {
    slots: [
      { type: "page", id: SLOT_IDS.marketingHub, displayName: "Marketing Hub", exportName: EXPORT_NAMES.marketingHub, routePath: "marketing", order: 0 },
      { type: "page", id: SLOT_IDS.trendRadar, displayName: "Trend Radar", exportName: EXPORT_NAMES.trendRadar, order: 1 },
      { type: "page", id: SLOT_IDS.contentPipeline, displayName: "Content Pipeline", exportName: EXPORT_NAMES.contentPipeline, order: 2 },
      { type: "page", id: SLOT_IDS.brandSettings, displayName: "Brand Settings", exportName: EXPORT_NAMES.brandSettings, order: 3 },
      { type: "page", id: SLOT_IDS.knowledgeBase, displayName: "Knowledge Base", exportName: EXPORT_NAMES.knowledgeBase, order: 4 },
      { type: "page", id: SLOT_IDS.engagement, displayName: "Engagement", exportName: EXPORT_NAMES.engagement, order: 5 },
      { type: "dashboardWidget", id: SLOT_IDS.contentQueueWidget, displayName: "Content Queue", exportName: EXPORT_NAMES.contentQueueWidget, order: 1 },
      { type: "dashboardWidget", id: SLOT_IDS.comfyuiStatusWidget, displayName: "ComfyUI Status", exportName: EXPORT_NAMES.comfyuiStatusWidget, order: 2 },
      { type: "detailTab", id: SLOT_IDS.agentMarketingTab, displayName: "Marketing Tools", exportName: EXPORT_NAMES.agentMarketingTab, entityTypes: ["agent"], order: 10 },
    ],
  },
```

The `routePath: "marketing"` means the hub is accessible at `/:companyPrefix/marketing` — a first-class route in the host app.

- [ ] **Step 2: Verify types compile**

Run: `cd /home/winadmin/projects/BrandAmbassador && npx tsc --noEmit 2>&1 | head -20`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
cd /home/winadmin/projects/BrandAmbassador
git add src/manifest.ts
git commit -m "feat: add Marketing Hub page slot with routePath 'marketing'"
```

---

### Task 7: Add `tool-schemas` and `pipeline` Data Handlers

**Files:**
- Modify: `/home/winadmin/projects/BrandAmbassador/src/handlers/data.ts`

- [ ] **Step 1: Add import for manifest**

At the top of `src/handlers/data.ts`, add:

```typescript
import manifest from "../manifest.js";
```

- [ ] **Step 2: Add `tool-schemas` data handler**

Add after the existing `plugin-config` handler (after line 101 in `src/handlers/data.ts`):

```typescript

  // ── tool-schemas ──────────────────────────────────────────────────────────
  ctx.data.register("tool-schemas", async (_params) => {
    const tools = manifest.tools ?? [];
    return {
      tools: tools.map((t) => ({
        name: t.name,
        displayName: t.displayName,
        description: t.description,
        parametersSchema: t.parametersSchema ?? null,
      })),
    };
  });

  // ── pipeline ──────────────────────────────────────────────────────────────
  ctx.data.register("pipeline", async (params) => {
    const companyId = (params as { companyId?: string }).companyId;
    if (!companyId) return { cards: [] };

    const cards = await ctx.state.get({
      scopeKind: "company",
      scopeId: companyId,
      namespace: "pipeline",
      stateKey: "cards",
    }) as ContentCard[] | null;

    return { cards: cards ?? [] };
  });

  // ── engagement ────────────────────────────────────────────────────────────
  ctx.data.register("engagement", async (params) => {
    const companyId = (params as { companyId?: string }).companyId;
    if (!companyId) return { posts: [] };

    const posts = await ctx.state.get({
      scopeKind: "company",
      scopeId: companyId,
      namespace: "engagement",
      stateKey: "conversations",
    }) as EngagementPost[] | null;

    return { posts: posts ?? [] };
  });
```

- [ ] **Step 3: Add types at the top of the file**

Add after the existing imports in `src/handlers/data.ts`:

```typescript
interface ContentCard {
  id: string;
  topic: string;
  platform: string;
  caption: string;
  mediaRef?: string;
  mediaType?: "image" | "video";
  moderationScore?: number;
  status: "draft" | "review" | "approved" | "published";
  source: "human" | "agent";
  sourceAgentId?: string;
  linkedIssueId?: string;
  createdAt: string;
  updatedAt: string;
}

interface EngagementPost {
  id: string;
  cardId?: string;
  platform?: string;
  topic?: string;
  likes?: number;
  retweets?: number;
  comments?: number;
  upvotes?: number;
  impressions?: number;
  publishedAt?: string;
}
```

- [ ] **Step 4: Verify types compile**

Run: `cd /home/winadmin/projects/BrandAmbassador && npx tsc --noEmit 2>&1 | head -20`
Expected: No errors.

- [ ] **Step 5: Commit**

```bash
cd /home/winadmin/projects/BrandAmbassador
git add src/handlers/data.ts
git commit -m "feat: add tool-schemas, pipeline, and engagement data handlers"
```

---

### Task 8: Add `execute-tool`, `create-pipeline-card`, and `update-card-status` Action Handlers

**Files:**
- Modify: `/home/winadmin/projects/BrandAmbassador/src/handlers/actions.ts`

- [ ] **Step 1: Add `execute-tool` action handler**

This handler calls the plugin's own tool implementations directly within the worker process. It does NOT go through the host's HTTP tool execution endpoint (which requires an `agentId` and `runId`).

Add after the `dismiss-trend` handler (after line 116) in `src/handlers/actions.ts`:

```typescript

  // ── execute-tool ──────────────────────────────────────────────────────────
  ctx.actions.register("execute-tool", async (params) => {
    const p = params as {
      companyId: string;
      toolName: string;
      parameters: Record<string, unknown>;
    };
    if (!p.companyId) return { error: "companyId is required" };
    if (!p.toolName) return { error: "toolName is required" };

    // Use the SDK's tool execution within the worker process.
    // ctx.tools.execute() calls the registered tool handler directly.
    const result = await ctx.tools.execute(p.toolName, p.parameters ?? {}, {
      companyId: p.companyId,
    });

    return { result };
  });
```

**Important:** This uses `ctx.tools.execute()` which is the SDK's in-process tool invocation — it calls the registered handler directly without going through the host HTTP endpoint. This avoids the `agentId`/`runId` requirement.

- [ ] **Step 2: Add `create-pipeline-card` action handler**

Add after the `execute-tool` handler:

```typescript

  // ── create-pipeline-card ──────────────────────────────────────────────────
  ctx.actions.register("create-pipeline-card", async (params) => {
    const p = params as {
      companyId: string;
      topic: string;
      platform: string;
      caption?: string;
      mediaRef?: string;
      mediaType?: "image" | "video";
      moderationScore?: number;
      source?: "human" | "agent";
      sourceAgentId?: string;
    };
    if (!p.companyId) return { error: "companyId is required" };
    if (!p.topic) return { error: "topic is required" };
    if (!p.platform) return { error: "platform is required" };

    const now = new Date().toISOString();
    const card = {
      id: crypto.randomUUID(),
      topic: p.topic,
      platform: p.platform,
      caption: p.caption ?? "",
      mediaRef: p.mediaRef,
      mediaType: p.mediaType,
      moderationScore: p.moderationScore,
      status: "draft" as const,
      source: p.source ?? "human",
      sourceAgentId: p.sourceAgentId,
      linkedIssueId: undefined,
      createdAt: now,
      updatedAt: now,
    };

    // Read existing cards
    const existing = await ctx.state.get({
      scopeKind: "company",
      scopeId: p.companyId,
      namespace: "pipeline",
      stateKey: "cards",
    }) as Array<typeof card> | null;

    const cards = [...(existing ?? []), card];

    await ctx.state.set(
      {
        scopeKind: "company",
        scopeId: p.companyId,
        namespace: "pipeline",
        stateKey: "cards",
      },
      cards,
    );

    return { ok: true, card };
  });
```

- [ ] **Step 3: Add `update-card-status` action handler**

Add after the `create-pipeline-card` handler:

```typescript

  // ── update-card-status ────────────────────────────────────────────────────
  ctx.actions.register("update-card-status", async (params) => {
    const p = params as {
      companyId: string;
      cardId: string;
      status: "draft" | "review" | "approved" | "published";
    };
    if (!p.companyId) return { error: "companyId is required" };
    if (!p.cardId) return { error: "cardId is required" };
    if (!p.status) return { error: "status is required" };

    const existing = await ctx.state.get({
      scopeKind: "company",
      scopeId: p.companyId,
      namespace: "pipeline",
      stateKey: "cards",
    }) as Array<Record<string, unknown>> | null;

    if (!existing) return { error: "No pipeline cards found" };

    const cardIndex = existing.findIndex((c) => c.id === p.cardId);
    if (cardIndex === -1) return { error: `Card ${p.cardId} not found` };

    const card = existing[cardIndex]!;
    const now = new Date().toISOString();

    // If moving to review, create a Paperclip issue
    let linkedIssueId = card.linkedIssueId as string | undefined;
    if (p.status === "review" && !linkedIssueId) {
      try {
        const issue = await ctx.issues.create({
          companyId: p.companyId,
          title: `[${(card.platform as string ?? "").toUpperCase()}] ${card.topic as string}`,
          description: `Auto-generated review for marketing content.\n\nCaption: ${card.caption as string ?? "(none)"}\nPlatform: ${card.platform as string}\nSource: ${card.source as string}`,
        });
        linkedIssueId = issue.id;

        // Mark issue as created by plugin
        await ctx.state.set(
          {
            scopeKind: "issue",
            scopeId: issue.id,
            stateKey: "created-by-plugin",
          },
          true,
        );
      } catch (err) {
        ctx.log.warn("Failed to create Paperclip issue for card", { cardId: p.cardId, error: String(err) });
      }
    }

    const updatedCard = {
      ...card,
      status: p.status,
      linkedIssueId,
      updatedAt: now,
    };
    existing[cardIndex] = updatedCard;

    await ctx.state.set(
      {
        scopeKind: "company",
        scopeId: p.companyId,
        namespace: "pipeline",
        stateKey: "cards",
      },
      existing,
    );

    return { ok: true, card: updatedCard };
  });
```

- [ ] **Step 4: Verify types compile**

Run: `cd /home/winadmin/projects/BrandAmbassador && npx tsc --noEmit 2>&1 | head -20`
Expected: No errors.

- [ ] **Step 5: Commit**

```bash
cd /home/winadmin/projects/BrandAmbassador
git add src/handlers/actions.ts
git commit -m "feat: add execute-tool, create-pipeline-card, and update-card-status action handlers"
```

---

## Phase 3: Marketing Hub UI — Shared Code

### Task 9: Create Shared Types

**Files:**
- Create: `/home/winadmin/projects/BrandAmbassador/ui/pages/marketing/types.ts`

- [ ] **Step 1: Create the types file**

Create `ui/pages/marketing/types.ts`:

```typescript
export type Platform = "twitter" | "telegram" | "reddit" | "instagram" | "tiktok" | "youtube";

export type ContentStatus = "draft" | "review" | "approved" | "published";

export type ContentSource = "human" | "agent";

export type HubSection = "pipeline" | "create" | "discover" | "monitor";

export interface ContentCard {
  id: string;
  topic: string;
  platform: Platform;
  caption: string;
  mediaRef?: string;
  mediaType?: "image" | "video";
  moderationScore?: number;
  status: ContentStatus;
  source: ContentSource;
  sourceAgentId?: string;
  linkedIssueId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ToolSchema {
  name: string;
  displayName: string;
  description: string;
  parametersSchema: {
    type: "object";
    properties: Record<string, { type: string; description?: string; default?: unknown; enum?: string[] }>;
    required?: string[];
  } | null;
}

export interface ToolSchemasData {
  tools: ToolSchema[];
}

export interface PipelineData {
  cards: ContentCard[];
}

export interface Trend {
  title: string;
  platform?: string;
  score?: number;
  sentiment?: string;
  growth?: string;
  discoveredAt?: string;
}

export interface TrendsData {
  trends: Trend[];
}

export interface EngagementPost {
  id: string;
  cardId?: string;
  platform?: string;
  topic?: string;
  likes?: number;
  retweets?: number;
  comments?: number;
  upvotes?: number;
  impressions?: number;
  publishedAt?: string;
}

export interface EngagementData {
  posts: EngagementPost[];
}

export interface BrandSettings {
  name?: string;
  tone?: string;
  targetAudience?: string;
  platforms?: Platform[];
  description?: string;
}

export interface BrandSettingsData {
  settings: BrandSettings | null;
  bannedKeywords: string[];
}

export interface ChainContext {
  topic?: string;
  caption?: string;
  mediaRef?: string;
  mediaType?: "image" | "video";
  moderationScore?: number;
  moderationApproved?: boolean;
  knowledgeContext?: string;
}
```

- [ ] **Step 2: Commit**

```bash
cd /home/winadmin/projects/BrandAmbassador
git add ui/pages/marketing/types.ts
git commit -m "feat(ui): add shared Marketing Hub types"
```

---

### Task 10: Create Shared Styles

**Files:**
- Create: `/home/winadmin/projects/BrandAmbassador/ui/pages/marketing/styles.ts`

- [ ] **Step 1: Create the styles file**

Create `ui/pages/marketing/styles.ts`:

```typescript
import type { CSSProperties } from "react";

// ── Layout ─────────────────────────────────────────────────────────────────

export const hubContainerStyle: CSSProperties = {
  display: "flex",
  height: "100%",
  minHeight: "calc(100vh - 80px)",
  fontFamily: "system-ui, sans-serif",
  color: "#e2e8f0",
  background: "#0a0a0a",
  fontSize: 13,
};

export const sidebarStyle: CSSProperties = {
  width: 200,
  background: "#111",
  borderRight: "1px solid #222",
  display: "flex",
  flexDirection: "column",
  padding: "12px 0",
  flexShrink: 0,
};

export const canvasStyle: CSSProperties = {
  flex: 1,
  padding: 16,
  overflow: "auto",
};

export const detailPanelStyle: CSSProperties = {
  width: 300,
  background: "#111",
  borderLeft: "1px solid #222",
  padding: 16,
  display: "flex",
  flexDirection: "column",
  flexShrink: 0,
  overflow: "auto",
};

// ── Sidebar ────────────────────────────────────────────────────────────────

export const sidebarHeaderStyle: CSSProperties = {
  padding: "8px 16px",
  marginBottom: 8,
};

export const sidebarTitleStyle: CSSProperties = {
  fontSize: 14,
  fontWeight: 600,
  color: "#e0e0e0",
};

export const sidebarSubtitleStyle: CSSProperties = {
  fontSize: 11,
  color: "#666",
  marginTop: 2,
};

export const navItemStyle = (active: boolean): CSSProperties => ({
  padding: "8px 12px",
  borderRadius: 6,
  cursor: "pointer",
  color: active ? "#7c8aff" : "#888",
  background: active ? "#1a1a2e" : "transparent",
  fontWeight: active ? 500 : 400,
  marginBottom: 2,
});

// ── Cards ──────────────────────────────────────────────────────────────────

export const cardStyle: CSSProperties = {
  background: "#1a1a1a",
  border: "1px solid #252525",
  borderRadius: 6,
  padding: 10,
  marginBottom: 8,
  cursor: "pointer",
};

export const cardTitleStyle: CSSProperties = {
  fontSize: 11,
  color: "#e0e0e0",
  fontWeight: 500,
};

export const cardMetaStyle: CSSProperties = {
  fontSize: 10,
  color: "#666",
  marginTop: 4,
};

export const cardSourceStyle: CSSProperties = {
  fontSize: 10,
  color: "#555",
  marginTop: 6,
};

// ── Kanban ─────────────────────────────────────────────────────────────────

export const kanbanContainerStyle: CSSProperties = {
  display: "flex",
  gap: 12,
  height: "calc(100% - 60px)",
};

export const kanbanColumnStyle: CSSProperties = {
  flex: 1,
  background: "#111",
  borderRadius: 8,
  padding: 10,
  border: "1px solid #222",
  overflow: "auto",
};

export const columnHeaderStyle: CSSProperties = {
  fontSize: 12,
  fontWeight: 500,
  color: "#888",
  marginBottom: 10,
  display: "flex",
  justifyContent: "space-between",
};

// ── Buttons ────────────────────────────────────────────────────────────────

export const primaryButtonStyle: CSSProperties = {
  padding: "6px 12px",
  background: "#1a1a2e",
  border: "1px solid #333",
  borderRadius: 6,
  fontSize: 12,
  color: "#7c8aff",
  cursor: "pointer",
  fontWeight: 500,
};

export const ghostButtonStyle: CSSProperties = {
  padding: "6px 12px",
  background: "#111",
  border: "1px solid #333",
  borderRadius: 6,
  fontSize: 12,
  color: "#888",
  cursor: "pointer",
};

export const approveButtonStyle: CSSProperties = {
  padding: "8px",
  background: "#1a2e1a",
  border: "1px solid rgba(76, 175, 80, 0.27)",
  borderRadius: 6,
  textAlign: "center",
  fontSize: 12,
  color: "#4caf50",
  cursor: "pointer",
  fontWeight: 500,
};

export const rejectButtonStyle: CSSProperties = {
  padding: "8px",
  background: "#111",
  border: "1px solid #333",
  borderRadius: 6,
  textAlign: "center",
  fontSize: 12,
  color: "#e74c3c",
  cursor: "pointer",
};

// ── Badges ─────────────────────────────────────────────────────────────────

export const badgeStyle = (bg: string, color: string): CSSProperties => ({
  fontSize: 10,
  padding: "2px 6px",
  borderRadius: 4,
  background: bg,
  color,
  display: "inline-block",
});

export const countBadgeStyle = (bg: string, color: string): CSSProperties => ({
  background: bg,
  padding: "1px 6px",
  borderRadius: 10,
  color,
  fontSize: 10,
});

// ── Form ───────────────────────────────────────────────────────────────────

export const inputStyle: CSSProperties = {
  width: "100%",
  padding: "6px 10px",
  background: "#0a0a0a",
  border: "1px solid #333",
  borderRadius: 6,
  color: "#e0e0e0",
  fontSize: 12,
  outline: "none",
};

export const selectStyle: CSSProperties = {
  ...inputStyle,
  appearance: "none" as const,
};

export const labelStyle: CSSProperties = {
  fontSize: 10,
  textTransform: "uppercase",
  color: "#555",
  letterSpacing: 0.5,
  marginBottom: 4,
  display: "block",
};

// ── Misc ───────────────────────────────────────────────────────────────────

export const headerRowStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  marginBottom: 16,
};

export const pageTitleStyle: CSSProperties = {
  fontSize: 16,
  fontWeight: 600,
  color: "#e0e0e0",
};

export const pageSubtitleStyle: CSSProperties = {
  fontSize: 12,
  color: "#666",
};

export const emptyStateStyle: CSSProperties = {
  textAlign: "center",
  padding: "40px 20px",
  color: "#555",
  fontSize: 13,
};

export const PLATFORM_EMOJI: Record<string, string> = {
  twitter: "\ud83d\udc26",
  telegram: "\u2708\ufe0f",
  reddit: "\ud83d\udcf1",
  instagram: "\ud83d\udcf7",
  tiktok: "\ud83c\udfb5",
  youtube: "\ud83c\udfac",
};

export const STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  draft: { bg: "#1a1a2e", color: "#7c8aff" },
  review: { bg: "#2a2a1e", color: "#c9a227" },
  approved: { bg: "#1a2e1a", color: "#4caf50" },
  published: { bg: "#1a1a2e", color: "#7c8aff" },
};
```

- [ ] **Step 2: Commit**

```bash
cd /home/winadmin/projects/BrandAmbassador
git add ui/pages/marketing/styles.ts
git commit -m "feat(ui): add shared Marketing Hub styles"
```

---

## Phase 4: Marketing Hub UI — Components

### Task 11: Create Sidebar Component

**Files:**
- Create: `/home/winadmin/projects/BrandAmbassador/ui/pages/marketing/Sidebar.tsx`

- [ ] **Step 1: Create the Sidebar component**

Create `ui/pages/marketing/Sidebar.tsx`:

```tsx
import { useState } from "react";
import { usePluginData, usePluginAction, usePluginToast } from "@paperclipai/plugin-sdk/ui";
import type { HubSection, BrandSettingsData, BrandSettings } from "./types.js";
import {
  sidebarStyle,
  sidebarHeaderStyle,
  sidebarTitleStyle,
  sidebarSubtitleStyle,
  navItemStyle,
  inputStyle,
  labelStyle,
  primaryButtonStyle,
} from "./styles.js";

interface SidebarProps {
  activeSection: HubSection;
  onSectionChange: (section: HubSection) => void;
  companyId: string | null;
  companyPrefix: string | null;
}

const NAV_ITEMS: { key: HubSection; label: string; icon: string }[] = [
  { key: "pipeline", label: "Pipeline", icon: "\ud83d\udccb" },
  { key: "create", label: "Create", icon: "\u2728" },
  { key: "discover", label: "Discover", icon: "\ud83d\udce1" },
  { key: "monitor", label: "Monitor", icon: "\ud83d\udcca" },
];

export function Sidebar({ activeSection, onSectionChange, companyId, companyPrefix }: SidebarProps) {
  const [editingBrand, setEditingBrand] = useState(false);
  const { data: brandData } = usePluginData<BrandSettingsData>("brand-settings", {
    companyId: companyId ?? undefined,
  });
  const saveBrand = usePluginAction("save-brand-settings");
  const toast = usePluginToast();

  const settings = brandData?.settings;

  return (
    <div style={sidebarStyle}>
      <div style={sidebarHeaderStyle}>
        <div style={sidebarTitleStyle}>{"\ud83c\udfaf"} Marketing Hub</div>
        <div style={sidebarSubtitleStyle}>{companyPrefix ?? "No company"}</div>
      </div>

      <div style={{ padding: "4px 8px" }}>
        {NAV_ITEMS.map((item) => (
          <div
            key={item.key}
            style={navItemStyle(activeSection === item.key)}
            onClick={() => onSectionChange(item.key)}
          >
            {item.icon} {item.label}
          </div>
        ))}
      </div>

      {/* Brand Context Footer */}
      <div style={{ marginTop: "auto", borderTop: "1px solid #222", padding: "12px 16px" }}>
        <div style={{ fontSize: 10, textTransform: "uppercase", color: "#555", letterSpacing: 0.5, marginBottom: 6 }}>
          Brand Voice
        </div>
        <div style={{ fontSize: 11, color: "#aaa", marginBottom: 4 }}>
          Tone: <span style={{ color: "#7c8aff" }}>{settings?.tone ?? "Not set"}</span>
        </div>
        <div style={{ fontSize: 11, color: "#aaa", marginBottom: 4 }}>
          Audience: <span style={{ color: "#7c8aff" }}>{settings?.targetAudience ?? "Not set"}</span>
        </div>
        <div style={{ fontSize: 11, color: "#aaa" }}>
          Platforms: <span style={{ color: "#7c8aff" }}>{settings?.platforms?.join(", ") ?? "None"}</span>
        </div>
        <div
          style={{ fontSize: 10, color: "#444", marginTop: 6, cursor: "pointer" }}
          onClick={() => setEditingBrand(!editingBrand)}
        >
          {editingBrand ? "\u2716 Close" : "\u270f\ufe0f Edit brand settings"}
        </div>

        {editingBrand && (
          <BrandEditor
            settings={settings ?? null}
            companyId={companyId}
            onSave={async (updated) => {
              try {
                await saveBrand({ companyId, settings: updated });
                toast({ title: "Brand settings saved", tone: "success" });
                setEditingBrand(false);
              } catch {
                toast({ title: "Failed to save brand settings", tone: "error" });
              }
            }}
          />
        )}
      </div>
    </div>
  );
}

function BrandEditor({
  settings,
  companyId,
  onSave,
}: {
  settings: BrandSettings | null;
  companyId: string | null;
  onSave: (settings: BrandSettings) => Promise<void>;
}) {
  const [tone, setTone] = useState(settings?.tone ?? "");
  const [audience, setAudience] = useState(settings?.targetAudience ?? "");
  const [platforms, setPlatforms] = useState(settings?.platforms?.join(", ") ?? "");
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    await onSave({
      ...settings,
      tone,
      targetAudience: audience,
      platforms: platforms.split(",").map((p) => p.trim()).filter(Boolean) as BrandSettings["platforms"],
    });
    setSaving(false);
  }

  return (
    <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 6 }}>
      <div>
        <label style={labelStyle}>Tone</label>
        <input style={inputStyle} value={tone} onChange={(e) => setTone(e.target.value)} placeholder="e.g. Witty & Sharp" />
      </div>
      <div>
        <label style={labelStyle}>Target Audience</label>
        <input style={inputStyle} value={audience} onChange={(e) => setAudience(e.target.value)} placeholder="e.g. Crypto/DeFi" />
      </div>
      <div>
        <label style={labelStyle}>Platforms (comma-separated)</label>
        <input style={inputStyle} value={platforms} onChange={(e) => setPlatforms(e.target.value)} placeholder="twitter, telegram, reddit" />
      </div>
      <button style={primaryButtonStyle} onClick={handleSave} disabled={saving}>
        {saving ? "Saving..." : "Save"}
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
cd /home/winadmin/projects/BrandAmbassador
git add ui/pages/marketing/Sidebar.tsx
git commit -m "feat(ui): add Marketing Hub sidebar with brand context editor"
```

---

### Task 12: Create Pipeline (Kanban) View

**Files:**
- Create: `/home/winadmin/projects/BrandAmbassador/ui/pages/marketing/Pipeline.tsx`

- [ ] **Step 1: Create the Pipeline component**

Create `ui/pages/marketing/Pipeline.tsx`:

```tsx
import { useMemo } from "react";
import type { ContentCard, ContentStatus } from "./types.js";
import {
  kanbanContainerStyle,
  kanbanColumnStyle,
  columnHeaderStyle,
  cardStyle,
  cardTitleStyle,
  cardMetaStyle,
  cardSourceStyle,
  headerRowStyle,
  pageTitleStyle,
  pageSubtitleStyle,
  primaryButtonStyle,
  ghostButtonStyle,
  countBadgeStyle,
  STATUS_COLORS,
  PLATFORM_EMOJI,
} from "./styles.js";

interface PipelineProps {
  cards: ContentCard[];
  onCardClick: (card: ContentCard) => void;
  onNewPost: () => void;
  onAutoGenerate: () => void;
}

const COLUMNS: { status: ContentStatus; label: string }[] = [
  { status: "draft", label: "Draft" },
  { status: "review", label: "Review" },
  { status: "approved", label: "Approved" },
  { status: "published", label: "Published" },
];

export function Pipeline({ cards, onCardClick, onNewPost, onAutoGenerate }: PipelineProps) {
  const grouped = useMemo(() => {
    const groups: Record<ContentStatus, ContentCard[]> = {
      draft: [],
      review: [],
      approved: [],
      published: [],
    };
    for (const card of cards) {
      if (groups[card.status]) {
        groups[card.status].push(card);
      }
    }
    return groups;
  }, [cards]);

  return (
    <div style={{ height: "100%" }}>
      <div style={headerRowStyle}>
        <div>
          <div style={pageTitleStyle}>Content Pipeline</div>
          <div style={pageSubtitleStyle}>{cards.length} total items</div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button style={primaryButtonStyle} onClick={onNewPost}>+ New Post</button>
          <button style={ghostButtonStyle} onClick={onAutoGenerate}>{"\u26a1"} Auto-Generate</button>
        </div>
      </div>

      <div style={kanbanContainerStyle}>
        {COLUMNS.map(({ status, label }) => {
          const columnCards = grouped[status];
          const colors = STATUS_COLORS[status]!;
          return (
            <div key={status} style={kanbanColumnStyle}>
              <div style={columnHeaderStyle}>
                <span>{label}</span>
                <span style={countBadgeStyle(colors.bg, colors.color)}>{columnCards.length}</span>
              </div>
              {columnCards.map((card) => (
                <div
                  key={card.id}
                  style={{
                    ...cardStyle,
                    borderColor: status === "review" ? "rgba(201, 162, 39, 0.2)"
                      : status === "approved" ? "rgba(76, 175, 80, 0.2)"
                      : "#252525",
                  }}
                  onClick={() => onCardClick(card)}
                >
                  <div style={cardTitleStyle}>{card.topic}</div>
                  <div style={cardMetaStyle}>
                    {PLATFORM_EMOJI[card.platform] ?? ""} {card.platform}
                    {card.mediaType ? ` \u00b7 ${card.mediaType === "image" ? "Image" : "Video"}` : " \u00b7 Text"}
                  </div>
                  {card.moderationScore != null && (
                    <div style={{ ...cardMetaStyle, marginTop: 6, display: "flex", gap: 4 }}>
                      <span style={{
                        fontSize: 10,
                        padding: "2px 6px",
                        borderRadius: 4,
                        background: card.moderationScore >= 70 ? "#1a2e1a" : "#2e1a1a",
                        color: card.moderationScore >= 70 ? "#4caf50" : "#e74c3c",
                      }}>
                        Score: {card.moderationScore}
                      </span>
                    </div>
                  )}
                  <div style={cardSourceStyle}>
                    {card.source === "agent" ? "\ud83e\udd16 Agent-generated" : "\u270b Human-created"}
                  </div>
                </div>
              ))}
              {columnCards.length === 0 && (
                <div style={{ fontSize: 11, color: "#444", textAlign: "center", padding: 20 }}>
                  No items
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
cd /home/winadmin/projects/BrandAmbassador
git add ui/pages/marketing/Pipeline.tsx
git commit -m "feat(ui): add Pipeline kanban view with 4-column layout"
```

---

### Task 13: Create Detail Panel

**Files:**
- Create: `/home/winadmin/projects/BrandAmbassador/ui/pages/marketing/DetailPanel.tsx`

- [ ] **Step 1: Create the DetailPanel component**

Create `ui/pages/marketing/DetailPanel.tsx`:

```tsx
import type { ContentCard } from "./types.js";
import {
  detailPanelStyle,
  approveButtonStyle,
  rejectButtonStyle,
  ghostButtonStyle,
  labelStyle,
  badgeStyle,
  PLATFORM_EMOJI,
} from "./styles.js";

interface DetailPanelProps {
  card: ContentCard;
  onClose: () => void;
  onStatusChange: (cardId: string, status: ContentCard["status"]) => void;
  onNavigateToIssue?: (issueId: string) => void;
}

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(ms / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export function DetailPanel({ card, onClose, onStatusChange, onNavigateToIssue }: DetailPanelProps) {
  const nextStatuses = getNextStatuses(card.status);

  return (
    <div style={detailPanelStyle}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: "#e0e0e0" }}>Card Detail</div>
        <div style={{ fontSize: 18, color: "#444", cursor: "pointer" }} onClick={onClose}>{"\u00d7"}</div>
      </div>

      <div style={{ fontSize: 14, fontWeight: 500, color: "#e0e0e0", marginBottom: 4 }}>{card.topic}</div>
      <div style={{ fontSize: 11, color: "#666", marginBottom: 12 }}>
        {card.source === "agent" ? "Created by agent" : "Created by human"} {"\u00b7"} {timeAgo(card.createdAt)}
      </div>

      {/* Media Preview */}
      {card.mediaRef && (
        <div style={{
          background: "#0a0a0a",
          border: "1px solid #222",
          borderRadius: 6,
          height: 140,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          marginBottom: 12,
        }}>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 28, marginBottom: 4 }}>{"\ud83d\uddbc\ufe0f"}</div>
            <div style={{ fontSize: 10, color: "#555" }}>{card.mediaRef}</div>
          </div>
        </div>
      )}

      {/* Caption */}
      {card.caption && (
        <>
          <div style={labelStyle}>Caption</div>
          <div style={{
            fontSize: 12,
            color: "#ccc",
            background: "#0a0a0a",
            border: "1px solid #222",
            borderRadius: 6,
            padding: 10,
            marginBottom: 12,
            lineHeight: 1.5,
            whiteSpace: "pre-wrap",
          }}>
            {card.caption}
          </div>
        </>
      )}

      {/* Platform */}
      <div style={labelStyle}>Platform</div>
      <div style={{ fontSize: 12, color: "#ccc", marginBottom: 12 }}>
        {PLATFORM_EMOJI[card.platform] ?? ""} {card.platform}
        {card.mediaType ? ` \u00b7 ${card.mediaType}` : ""}
      </div>

      {/* Moderation */}
      {card.moderationScore != null && (
        <>
          <div style={labelStyle}>Moderation</div>
          <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
            <span style={badgeStyle(
              card.moderationScore >= 70 ? "#1a2e1a" : "#2e1a1a",
              card.moderationScore >= 70 ? "#4caf50" : "#e74c3c",
            )}>
              Safety: {card.moderationScore}/100
            </span>
          </div>
        </>
      )}

      {/* Paperclip Issue Link */}
      {card.linkedIssueId && (
        <>
          <div style={labelStyle}>Paperclip Issue</div>
          <div
            style={{ fontSize: 11, color: "#7c8aff", marginBottom: 16, cursor: "pointer", textDecoration: "underline" }}
            onClick={() => onNavigateToIssue?.(card.linkedIssueId!)}
          >
            {card.linkedIssueId} {"\u2192"}
          </div>
        </>
      )}

      {/* Actions */}
      <div style={{ marginTop: "auto", display: "flex", flexDirection: "column", gap: 6 }}>
        {nextStatuses.includes("approved") && (
          <button style={approveButtonStyle} onClick={() => onStatusChange(card.id, "approved")}>
            {"\u2713"} Approve
          </button>
        )}
        <div style={{ display: "flex", gap: 6 }}>
          {nextStatuses.includes("review") && (
            <button style={{ ...ghostButtonStyle, flex: 1 }} onClick={() => onStatusChange(card.id, "review")}>
              Send to Review
            </button>
          )}
          {nextStatuses.includes("draft") && (
            <button style={{ ...rejectButtonStyle, flex: 1 }} onClick={() => onStatusChange(card.id, "draft")}>
              {"\u2717"} Reject
            </button>
          )}
        </div>
        {nextStatuses.includes("published") && (
          <button style={ghostButtonStyle} onClick={() => onStatusChange(card.id, "published")}>
            Publish
          </button>
        )}
      </div>
    </div>
  );
}

function getNextStatuses(current: ContentCard["status"]): ContentCard["status"][] {
  switch (current) {
    case "draft": return ["review"];
    case "review": return ["approved", "draft"];
    case "approved": return ["published"];
    case "published": return [];
  }
}
```

- [ ] **Step 2: Commit**

```bash
cd /home/winadmin/projects/BrandAmbassador
git add ui/pages/marketing/DetailPanel.tsx
git commit -m "feat(ui): add DetailPanel with media preview and status actions"
```

---

### Task 14: Create Workshop (Create View)

**Files:**
- Create: `/home/winadmin/projects/BrandAmbassador/ui/pages/marketing/Create.tsx`

- [ ] **Step 1: Create the Create workshop component**

Create `ui/pages/marketing/Create.tsx`:

```tsx
import { useState, useCallback } from "react";
import { usePluginData, usePluginAction, usePluginStream, usePluginToast } from "@paperclipai/plugin-sdk/ui";
import type { ToolSchema, ToolSchemasData, ChainContext, BrandSettingsData } from "./types.js";
import {
  headerRowStyle,
  pageTitleStyle,
  pageSubtitleStyle,
  cardStyle,
  cardTitleStyle,
  cardMetaStyle,
  primaryButtonStyle,
  ghostButtonStyle,
  inputStyle,
  selectStyle,
  labelStyle,
  badgeStyle,
  emptyStateStyle,
} from "./styles.js";

interface CreateProps {
  companyId: string | null;
  onCardCreated: () => void;
}

export function Create({ companyId, onCardCreated }: CreateProps) {
  const { data: schemasData } = usePluginData<ToolSchemasData>("tool-schemas");
  const { data: brandData } = usePluginData<BrandSettingsData>("brand-settings", {
    companyId: companyId ?? undefined,
  });
  const executeTool = usePluginAction("execute-tool");
  const createCard = usePluginAction("create-pipeline-card");
  const toast = usePluginToast();
  const { lastEvent: progressEvent } = usePluginStream<{ stage: string; progress: number }>("generation-progress", {
    companyId: companyId ?? undefined,
  });

  const [activeTool, setActiveTool] = useState<ToolSchema | null>(null);
  const [formValues, setFormValues] = useState<Record<string, string>>({});
  const [toolResult, setToolResult] = useState<unknown>(null);
  const [running, setRunning] = useState(false);
  const [chain, setChain] = useState<ChainContext>({});

  const tools = schemasData?.tools ?? [];
  const brandSettings = brandData?.settings;

  const handleRunTool = useCallback(async () => {
    if (!activeTool || !companyId) return;
    setRunning(true);
    setToolResult(null);
    try {
      const result = await executeTool({
        companyId,
        toolName: activeTool.name,
        parameters: { ...formValues },
      });
      const data = (result as { result?: { data?: unknown } })?.result?.data ?? result;
      setToolResult(data);

      // Feed result into chain context
      updateChainFromResult(activeTool.name, data, chain, setChain);

      toast({ title: `${activeTool.displayName} completed`, tone: "success" });
    } catch (err) {
      toast({ title: `${activeTool.displayName} failed`, tone: "error", body: String(err) });
    } finally {
      setRunning(false);
    }
  }, [activeTool, companyId, formValues, executeTool, toast, chain]);

  const handleCreatePost = useCallback(async () => {
    if (!companyId || !chain.topic) return;
    try {
      await createCard({
        companyId,
        topic: chain.topic,
        platform: formValues.platform ?? "twitter",
        caption: chain.caption,
        mediaRef: chain.mediaRef,
        mediaType: chain.mediaType,
        moderationScore: chain.moderationScore,
        source: "human",
      });
      toast({ title: "Post created in pipeline", tone: "success" });
      setChain({});
      setFormValues({});
      setToolResult(null);
      setActiveTool(null);
      onCardCreated();
    } catch (err) {
      toast({ title: "Failed to create post", tone: "error", body: String(err) });
    }
  }, [companyId, chain, formValues, createCard, toast, onCardCreated]);

  const handleSelectTool = useCallback((tool: ToolSchema) => {
    setActiveTool(tool);
    setToolResult(null);
    // Pre-fill from chain context and brand settings
    const prefilled: Record<string, string> = {};
    if (chain.topic) prefilled.topic = chain.topic;
    if (chain.caption) prefilled.content = chain.caption;
    if (brandSettings?.tone) prefilled.tone = brandSettings.tone;
    setFormValues(prefilled);
  }, [chain, brandSettings]);

  return (
    <div style={{ display: "flex", gap: 16, height: "100%" }}>
      {/* Left: Tool Palette */}
      <div style={{ width: 200, flexShrink: 0 }}>
        <div style={{ ...labelStyle, marginBottom: 8 }}>Tools</div>
        {tools.map((tool) => (
          <div
            key={tool.name}
            style={{
              ...cardStyle,
              borderColor: activeTool?.name === tool.name ? "#7c8aff" : "#252525",
              cursor: "pointer",
            }}
            onClick={() => handleSelectTool(tool)}
          >
            <div style={cardTitleStyle}>{tool.displayName}</div>
            <div style={cardMetaStyle}>{tool.description}</div>
          </div>
        ))}
      </div>

      {/* Center: Active Tool Workspace */}
      <div style={{ flex: 1 }}>
        <div style={headerRowStyle}>
          <div>
            <div style={pageTitleStyle}>Create Workshop</div>
            <div style={pageSubtitleStyle}>
              {activeTool ? activeTool.displayName : "Select a tool to get started"}
            </div>
          </div>
        </div>

        {activeTool ? (
          <div>
            {/* Parameter Form */}
            <ToolForm
              tool={activeTool}
              values={formValues}
              onChange={setFormValues}
              brandSettings={brandSettings ?? undefined}
            />
            <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
              <button style={primaryButtonStyle} onClick={handleRunTool} disabled={running}>
                {running ? "Running..." : "Run"}
              </button>
            </div>

            {/* Progress */}
            {running && progressEvent && (
              <div style={{ marginTop: 12, fontSize: 11, color: "#888" }}>
                {progressEvent.stage}: {Math.round(progressEvent.progress * 100)}%
              </div>
            )}

            {/* Result */}
            {toolResult != null && (
              <div style={{ marginTop: 16 }}>
                <div style={labelStyle}>Result</div>
                <pre style={{
                  background: "#0a0a0a",
                  border: "1px solid #222",
                  borderRadius: 6,
                  padding: 10,
                  fontSize: 11,
                  color: "#ccc",
                  overflow: "auto",
                  maxHeight: 300,
                  whiteSpace: "pre-wrap",
                }}>
                  {typeof toolResult === "string" ? toolResult : JSON.stringify(toolResult, null, 2)}
                </pre>
              </div>
            )}
          </div>
        ) : (
          <div style={emptyStateStyle}>
            Select a tool from the palette to begin creating content.
          </div>
        )}
      </div>

      {/* Right: Chain Context */}
      <div style={{ width: 220, flexShrink: 0 }}>
        <div style={{ ...labelStyle, marginBottom: 8 }}>Chain Context</div>
        {chain.topic && (
          <ChainItem label="Topic" value={chain.topic} />
        )}
        {chain.caption && (
          <ChainItem label="Caption" value={chain.caption.slice(0, 140) + (chain.caption.length > 140 ? "..." : "")} />
        )}
        {chain.mediaRef && (
          <ChainItem label="Media" value={`${chain.mediaType ?? "file"}: ${chain.mediaRef}`} />
        )}
        {chain.moderationScore != null && (
          <ChainItem
            label="Moderation"
            value={`Score: ${chain.moderationScore}${chain.moderationApproved ? " (Approved)" : ""}`}
          />
        )}
        {chain.knowledgeContext && (
          <ChainItem label="Knowledge" value="Context loaded" />
        )}

        {(chain.topic || chain.caption) && (
          <button
            style={{ ...primaryButtonStyle, width: "100%", marginTop: 12 }}
            onClick={handleCreatePost}
          >
            Create Post
          </button>
        )}
      </div>
    </div>
  );
}

function ChainItem({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ ...cardStyle, padding: 8 }}>
      <div style={{ fontSize: 10, color: "#555", marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 11, color: "#ccc" }}>{value}</div>
    </div>
  );
}

function ToolForm({
  tool,
  values,
  onChange,
  brandSettings,
}: {
  tool: ToolSchema;
  values: Record<string, string>;
  onChange: (values: Record<string, string>) => void;
  brandSettings?: { tone?: string; platforms?: string[] };
}) {
  const schema = tool.parametersSchema;
  if (!schema?.properties) {
    return <div style={{ fontSize: 12, color: "#666" }}>This tool has no parameters.</div>;
  }

  const properties = Object.entries(schema.properties);
  const required = new Set(schema.required ?? []);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {properties.map(([key, prop]) => (
        <div key={key}>
          <label style={labelStyle}>
            {key}{required.has(key) ? " *" : ""}
          </label>
          {prop.enum ? (
            <select
              style={selectStyle}
              value={values[key] ?? prop.default?.toString() ?? ""}
              onChange={(e) => onChange({ ...values, [key]: e.target.value })}
            >
              <option value="">Select...</option>
              {prop.enum.map((opt) => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
          ) : prop.type === "number" ? (
            <input
              style={inputStyle}
              type="number"
              value={values[key] ?? prop.default?.toString() ?? ""}
              onChange={(e) => onChange({ ...values, [key]: e.target.value })}
              placeholder={prop.description}
            />
          ) : (
            <input
              style={inputStyle}
              value={values[key] ?? ""}
              onChange={(e) => onChange({ ...values, [key]: e.target.value })}
              placeholder={prop.description ?? key}
            />
          )}
        </div>
      ))}
    </div>
  );
}

function updateChainFromResult(
  toolName: string,
  data: unknown,
  chain: ChainContext,
  setChain: (c: ChainContext) => void,
) {
  const d = data as Record<string, unknown> | null;
  if (!d) return;

  const updated = { ...chain };
  switch (toolName) {
    case "generate-caption":
      if (d.caption) updated.caption = d.caption as string;
      break;
    case "generate-media":
      if (d.filename) updated.mediaRef = d.filename as string;
      if (d.mediaType) updated.mediaType = d.mediaType as "image" | "video";
      break;
    case "generate-post":
      if (d.caption) updated.caption = d.caption as string;
      if (d.mediaFilename) updated.mediaRef = d.mediaFilename as string;
      break;
    case "check-trends":
      // If trends returned, use first trend topic
      if (Array.isArray(d.trends) && d.trends.length > 0) {
        updated.topic = (d.trends[0] as { title?: string }).title ?? updated.topic;
      }
      break;
    case "moderate-content":
      if (d.score != null) updated.moderationScore = d.score as number;
      if (d.approved != null) updated.moderationApproved = d.approved as boolean;
      break;
    case "search-knowledge":
      updated.knowledgeContext = "loaded";
      break;
  }
  // Infer topic from form values if not set
  if (!updated.topic && d.topic) updated.topic = d.topic as string;
  setChain(updated);
}
```

- [ ] **Step 2: Commit**

```bash
cd /home/winadmin/projects/BrandAmbassador
git add ui/pages/marketing/Create.tsx
git commit -m "feat(ui): add Create workshop with tool palette and chain context"
```

---

### Task 15: Create Discover View

**Files:**
- Create: `/home/winadmin/projects/BrandAmbassador/ui/pages/marketing/Discover.tsx`

- [ ] **Step 1: Create the Discover component**

Create `ui/pages/marketing/Discover.tsx`:

```tsx
import { useState, useMemo } from "react";
import { usePluginData, usePluginAction, usePluginToast } from "@paperclipai/plugin-sdk/ui";
import type { TrendsData, Trend } from "./types.js";
import {
  headerRowStyle,
  pageTitleStyle,
  pageSubtitleStyle,
  cardStyle,
  cardTitleStyle,
  cardMetaStyle,
  primaryButtonStyle,
  ghostButtonStyle,
  inputStyle,
  badgeStyle,
  emptyStateStyle,
  PLATFORM_EMOJI,
} from "./styles.js";

interface DiscoverProps {
  companyId: string | null;
  onCreateFromTrend: (topic: string) => void;
}

export function Discover({ companyId, onCreateFromTrend }: DiscoverProps) {
  const { data, loading, refresh } = usePluginData<TrendsData>("trends", {
    companyId: companyId ?? undefined,
  });
  const dismissTrend = usePluginAction("dismiss-trend");
  const toast = usePluginToast();

  const [search, setSearch] = useState("");
  const [platformFilter, setPlatformFilter] = useState<string>("all");

  const trends = data?.trends ?? [];

  const filtered = useMemo(() => {
    return trends.filter((t) => {
      if (platformFilter !== "all" && t.platform !== platformFilter) return false;
      if (search && !t.title.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    }).sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
  }, [trends, platformFilter, search]);

  const platforms = useMemo(() => {
    const set = new Set(trends.map((t) => t.platform).filter(Boolean));
    return ["all", ...Array.from(set)] as string[];
  }, [trends]);

  const handleDismiss = async (title: string) => {
    try {
      await dismissTrend({ companyId, title });
      toast({ title: "Trend dismissed", tone: "info" });
      refresh();
    } catch {
      toast({ title: "Failed to dismiss trend", tone: "error" });
    }
  };

  return (
    <div>
      <div style={headerRowStyle}>
        <div>
          <div style={pageTitleStyle}>Discover Trends</div>
          <div style={pageSubtitleStyle}>{trends.length} active trends</div>
        </div>
        <button style={ghostButtonStyle} onClick={refresh}>Refresh</button>
      </div>

      {/* Filters */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        {platforms.map((p) => (
          <button
            key={p}
            style={{
              ...ghostButtonStyle,
              background: platformFilter === p ? "#1a1a2e" : "#111",
              color: platformFilter === p ? "#7c8aff" : "#888",
            }}
            onClick={() => setPlatformFilter(p)}
          >
            {p === "all" ? "All" : `${PLATFORM_EMOJI[p] ?? ""} ${p}`}
          </button>
        ))}
        <input
          style={{ ...inputStyle, maxWidth: 200 }}
          placeholder="Search trends..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Trend Cards */}
      {loading ? (
        <div style={emptyStateStyle}>Loading trends...</div>
      ) : filtered.length === 0 ? (
        <div style={emptyStateStyle}>No trends found. Check back later or adjust filters.</div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 12 }}>
          {filtered.map((trend, i) => (
            <TrendCard
              key={`${trend.title}-${i}`}
              trend={trend}
              onCreateFrom={() => onCreateFromTrend(trend.title)}
              onDismiss={() => handleDismiss(trend.title)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function TrendCard({
  trend,
  onCreateFrom,
  onDismiss,
}: {
  trend: Trend;
  onCreateFrom: () => void;
  onDismiss: () => void;
}) {
  return (
    <div style={cardStyle}>
      <div style={cardTitleStyle}>{trend.title}</div>
      <div style={{ display: "flex", gap: 4, marginTop: 6, flexWrap: "wrap" }}>
        {trend.platform && (
          <span style={badgeStyle("#1a1a2e", "#7c8aff")}>
            {PLATFORM_EMOJI[trend.platform] ?? ""} {trend.platform}
          </span>
        )}
        {trend.score != null && (
          <span style={badgeStyle(
            trend.score >= 70 ? "#1a2e1a" : "#2a2a1e",
            trend.score >= 70 ? "#4caf50" : "#c9a227",
          )}>
            Score: {trend.score}
          </span>
        )}
        {trend.sentiment && (
          <span style={badgeStyle("#1a1a2e", "#888")}>{trend.sentiment}</span>
        )}
        {trend.growth && (
          <span style={badgeStyle("#1a2e1a", "#4caf50")}>{trend.growth}</span>
        )}
      </div>
      <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
        <button style={{ ...primaryButtonStyle, fontSize: 10, padding: "4px 8px" }} onClick={onCreateFrom}>
          Create from this
        </button>
        <button style={{ ...ghostButtonStyle, fontSize: 10, padding: "4px 8px" }} onClick={onDismiss}>
          Dismiss
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
cd /home/winadmin/projects/BrandAmbassador
git add ui/pages/marketing/Discover.tsx
git commit -m "feat(ui): add Discover view with trend filtering and actions"
```

---

### Task 16: Create Monitor View

**Files:**
- Create: `/home/winadmin/projects/BrandAmbassador/ui/pages/marketing/Monitor.tsx`

- [ ] **Step 1: Create the Monitor component**

Create `ui/pages/marketing/Monitor.tsx`:

```tsx
import { useMemo } from "react";
import { usePluginData } from "@paperclipai/plugin-sdk/ui";
import type { EngagementData, EngagementPost } from "./types.js";
import {
  headerRowStyle,
  pageTitleStyle,
  pageSubtitleStyle,
  ghostButtonStyle,
  cardStyle,
  cardTitleStyle,
  cardMetaStyle,
  emptyStateStyle,
  PLATFORM_EMOJI,
} from "./styles.js";

interface MonitorProps {
  companyId: string | null;
  onCreateFollowUp: (topic: string) => void;
  onViewPost: (cardId: string) => void;
}

export function Monitor({ companyId, onCreateFollowUp, onViewPost }: MonitorProps) {
  const { data, loading, refresh } = usePluginData<EngagementData>("engagement", {
    companyId: companyId ?? undefined,
  });

  const posts = data?.posts ?? [];

  const sorted = useMemo(() => {
    return [...posts].sort((a, b) => {
      const engA = (a.likes ?? 0) + (a.retweets ?? 0) + (a.comments ?? 0) + (a.upvotes ?? 0);
      const engB = (b.likes ?? 0) + (b.retweets ?? 0) + (b.comments ?? 0) + (b.upvotes ?? 0);
      return engB - engA;
    });
  }, [posts]);

  return (
    <div>
      <div style={headerRowStyle}>
        <div>
          <div style={pageTitleStyle}>Engagement Monitor</div>
          <div style={pageSubtitleStyle}>{posts.length} published posts tracked</div>
        </div>
        <button style={ghostButtonStyle} onClick={refresh}>Refresh</button>
      </div>

      {loading ? (
        <div style={emptyStateStyle}>Loading engagement data...</div>
      ) : sorted.length === 0 ? (
        <div style={emptyStateStyle}>
          No published posts to monitor yet. Content will appear here after publishing.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {sorted.map((post) => (
            <PostCard
              key={post.id}
              post={post}
              onCreateFollowUp={() => post.topic && onCreateFollowUp(post.topic)}
              onViewPost={() => post.cardId && onViewPost(post.cardId)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function PostCard({
  post,
  onCreateFollowUp,
  onViewPost,
}: {
  post: EngagementPost;
  onCreateFollowUp: () => void;
  onViewPost: () => void;
}) {
  const totalEngagement = (post.likes ?? 0) + (post.retweets ?? 0) + (post.comments ?? 0) + (post.upvotes ?? 0);

  return (
    <div style={{ ...cardStyle, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
      <div style={{ flex: 1 }}>
        <div style={cardTitleStyle}>{post.topic ?? "Untitled post"}</div>
        <div style={cardMetaStyle}>
          {post.platform && `${PLATFORM_EMOJI[post.platform] ?? ""} ${post.platform}`}
          {post.publishedAt && ` \u00b7 ${new Date(post.publishedAt).toLocaleDateString()}`}
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
          {post.likes != null && (
            <span style={{ fontSize: 10, color: "#7c8aff" }}>{"\u2764\ufe0f"} {post.likes}</span>
          )}
          {post.retweets != null && (
            <span style={{ fontSize: 10, color: "#7c8aff" }}>{"\ud83d\udd01"} {post.retweets}</span>
          )}
          {post.comments != null && (
            <span style={{ fontSize: 10, color: "#7c8aff" }}>{"\ud83d\udcac"} {post.comments}</span>
          )}
          {post.upvotes != null && (
            <span style={{ fontSize: 10, color: "#7c8aff" }}>{"\u2b06\ufe0f"} {post.upvotes}</span>
          )}
          {post.impressions != null && (
            <span style={{ fontSize: 10, color: "#888" }}>{"\ud83d\udc41"} {post.impressions}</span>
          )}
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <button
          style={{ ...ghostButtonStyle, fontSize: 10, padding: "4px 8px" }}
          onClick={onCreateFollowUp}
        >
          Create follow-up
        </button>
        {post.cardId && (
          <button
            style={{ ...ghostButtonStyle, fontSize: 10, padding: "4px 8px" }}
            onClick={onViewPost}
          >
            View post
          </button>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
cd /home/winadmin/projects/BrandAmbassador
git add ui/pages/marketing/Monitor.tsx
git commit -m "feat(ui): add Monitor view with engagement cards"
```

---

## Phase 5: Marketing Hub Root + Integration

### Task 17: Create Marketing Hub Root Component

**Files:**
- Create: `/home/winadmin/projects/BrandAmbassador/ui/pages/MarketingHub.tsx`

- [ ] **Step 1: Create the MarketingHub root component**

Create `ui/pages/MarketingHub.tsx`:

```tsx
import { useState, useCallback } from "react";
import { useHostContext, usePluginData, usePluginAction, usePluginToast, useNavigateToEntity } from "@paperclipai/plugin-sdk/ui";
import type { PluginPageProps } from "@paperclipai/plugin-sdk/ui";
import type { HubSection, ContentCard, PipelineData } from "./marketing/types.js";
import { hubContainerStyle, canvasStyle } from "./marketing/styles.js";
import { Sidebar } from "./marketing/Sidebar.js";
import { Pipeline } from "./marketing/Pipeline.js";
import { DetailPanel } from "./marketing/DetailPanel.js";
import { Create } from "./marketing/Create.js";
import { Discover } from "./marketing/Discover.js";
import { Monitor } from "./marketing/Monitor.js";

export function MarketingHubPage(_props: PluginPageProps) {
  const { companyId, companyPrefix } = useHostContext();
  const toast = usePluginToast();
  const navigateToEntity = useNavigateToEntity();
  const updateCardStatus = usePluginAction("update-card-status");

  const [activeSection, setActiveSection] = useState<HubSection>("pipeline");
  const [selectedCard, setSelectedCard] = useState<ContentCard | null>(null);

  const { data: pipelineData, refresh: refreshPipeline } = usePluginData<PipelineData>("pipeline", {
    companyId: companyId ?? undefined,
  });

  const cards = pipelineData?.cards ?? [];

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleStatusChange = useCallback(async (cardId: string, status: ContentCard["status"]) => {
    try {
      await updateCardStatus({ companyId, cardId, status });
      toast({ title: `Card moved to ${status}`, tone: "success" });
      refreshPipeline();
      setSelectedCard(null);
    } catch (err) {
      toast({ title: "Failed to update status", tone: "error", body: String(err) });
    }
  }, [companyId, updateCardStatus, toast, refreshPipeline]);

  const handleNavigateToIssue = useCallback((issueId: string) => {
    if (companyId) {
      navigateToEntity({ type: "issue", id: issueId, companyId });
    }
  }, [companyId, navigateToEntity]);

  const handleNewPost = useCallback(() => {
    setActiveSection("create");
    setSelectedCard(null);
  }, []);

  const handleAutoGenerate = useCallback(() => {
    setActiveSection("create");
    setSelectedCard(null);
    // The create view will handle auto-generate via the generate-post tool
  }, []);

  const handleCreateFromTrend = useCallback((topic: string) => {
    setActiveSection("create");
    setSelectedCard(null);
    // Topic will be pre-filled via the chain context mechanism in Create
  }, []);

  const handleViewPostFromMonitor = useCallback((cardId: string) => {
    const card = cards.find((c) => c.id === cardId);
    if (card) {
      setActiveSection("pipeline");
      setSelectedCard(card);
    }
  }, [cards]);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div style={hubContainerStyle}>
      <Sidebar
        activeSection={activeSection}
        onSectionChange={(s) => { setActiveSection(s); setSelectedCard(null); }}
        companyId={companyId}
        companyPrefix={companyPrefix}
      />

      <div style={canvasStyle}>
        {activeSection === "pipeline" && (
          <Pipeline
            cards={cards}
            onCardClick={setSelectedCard}
            onNewPost={handleNewPost}
            onAutoGenerate={handleAutoGenerate}
          />
        )}
        {activeSection === "create" && (
          <Create
            companyId={companyId}
            onCardCreated={refreshPipeline}
          />
        )}
        {activeSection === "discover" && (
          <Discover
            companyId={companyId}
            onCreateFromTrend={handleCreateFromTrend}
          />
        )}
        {activeSection === "monitor" && (
          <Monitor
            companyId={companyId}
            onCreateFollowUp={handleCreateFromTrend}
            onViewPost={handleViewPostFromMonitor}
          />
        )}
      </div>

      {selectedCard && activeSection === "pipeline" && (
        <DetailPanel
          card={selectedCard}
          onClose={() => setSelectedCard(null)}
          onStatusChange={handleStatusChange}
          onNavigateToIssue={handleNavigateToIssue}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
cd /home/winadmin/projects/BrandAmbassador
git add ui/pages/MarketingHub.tsx
git commit -m "feat(ui): add MarketingHub root layout with section routing"
```

---

### Task 18: Update UI Barrel Export

**Files:**
- Modify: `/home/winadmin/projects/BrandAmbassador/ui/index.tsx`

- [ ] **Step 1: Add MarketingHubPage export**

Add to the end of `ui/index.tsx` (after the existing exports):

```typescript
// Marketing Hub
export { MarketingHubPage } from "./pages/MarketingHub.js";
```

The full file should now be:

```typescript
// Pages (5 + 1 hub)
export { TrendRadarPage } from "./pages/TrendRadar.js";
export { ContentPipelinePage } from "./pages/ContentPipeline.js";
export { BrandSettingsPage } from "./pages/BrandSettings.js";
export { KnowledgeBasePage } from "./pages/KnowledgeBase.js";
export { EngagementPage } from "./pages/Engagement.js";
export { MarketingHubPage } from "./pages/MarketingHub.js";

// Widgets (2)
export { ContentQueueWidget } from "./widgets/ContentQueueStatus.js";
export { ComfyUIStatusWidget } from "./widgets/ComfyUIStatus.js";

// Tabs (1)
export { AgentMarketingToolsTab } from "./tabs/AgentMarketingTools.js";
```

- [ ] **Step 2: Commit**

```bash
cd /home/winadmin/projects/BrandAmbassador
git add ui/index.tsx
git commit -m "feat(ui): export MarketingHubPage from UI barrel"
```

---

### Task 19: Build and Verify

**Files:**
- No new files — verification only

- [ ] **Step 1: Verify BrandAmbassador TypeScript compiles**

Run: `cd /home/winadmin/projects/BrandAmbassador && npx tsc --noEmit 2>&1 | head -30`
Expected: No errors (or only pre-existing ones unrelated to Marketing Hub).

- [ ] **Step 2: Build BrandAmbassador (TypeScript + UI bundle)**

Run: `cd /home/winadmin/projects/BrandAmbassador && pnpm build 2>&1`
Expected: Both `tsc` and `esbuild` succeed. Output appears at `dist/ui/index.js`.

- [ ] **Step 3: Verify the UI bundle was created**

Run: `ls -la /home/winadmin/projects/BrandAmbassador/dist/ui/index.js`
Expected: File exists with non-zero size.

- [ ] **Step 4: Verify the SDK changes compile**

Run: `cd /home/winadmin/projects/paperclip && npx tsc --noEmit -p packages/plugins/sdk/tsconfig.json 2>&1 | head -20`
Expected: No errors.

- [ ] **Step 5: Verify the host UI compiles**

Run: `cd /home/winadmin/projects/paperclip && npx tsc --noEmit -p ui/tsconfig.json 2>&1 | head -20`
Expected: No errors.

- [ ] **Step 6: Commit any fixes**

If any build errors were found and fixed, commit them:

```bash
git add -A && git commit -m "fix: resolve build errors in Marketing Hub"
```

---

### Task 20: Verify `ctx.tools.execute` Exists in SDK

**Files:**
- No changes — research only

- [ ] **Step 1: Check if `ctx.tools.execute` is available**

Run: `cd /home/winadmin/projects/paperclip && grep -r "tools.execute\|tools\.register" packages/plugins/sdk/src/ --include="*.ts" | head -20`

The `execute-tool` action handler (Task 8) calls `ctx.tools.execute()`. We need to verify this method exists on the PluginContext's tools interface.

If `ctx.tools.execute()` does NOT exist, the fallback approach is to call the tool handler directly. In that case, update the `execute-tool` action handler to use the registered tool's handler function directly:

```typescript
// Alternative if ctx.tools.execute doesn't exist:
// Store tool handlers in a map during registration, then look up and call directly
```

- [ ] **Step 2: If needed, update the execute-tool handler**

If `ctx.tools.execute()` doesn't exist, modify the `execute-tool` action handler in `src/handlers/actions.ts` to call the tool handler via an alternative mechanism. The exact implementation depends on what the SDK provides.

Check the tool dispatcher in Paperclip:
Run: `grep -n "executeTool\|tools.execute" /home/winadmin/projects/paperclip/server/src/services/plugin-tool-dispatcher.ts | head -20`

- [ ] **Step 3: Commit any changes**

If the handler needed updating:
```bash
cd /home/winadmin/projects/BrandAmbassador
git add src/handlers/actions.ts
git commit -m "fix: use correct tool execution API in execute-tool handler"
```

---

### Task 21: Reinstall Plugin and Manual Smoke Test

**Files:**
- No code changes

- [ ] **Step 1: Rebuild the plugin**

Run: `cd /home/winadmin/projects/BrandAmbassador && pnpm build`

- [ ] **Step 2: Restart Paperclip to pick up plugin changes**

Run: `cd /home/winadmin/projects/paperclip && ./manage.sh restart`

- [ ] **Step 3: Verify the Marketing Hub route is accessible**

Open `http://172.16.1.230:3100/MEM/marketing` in browser. The Marketing Hub should render with the sidebar, Pipeline view, and 4 empty Kanban columns.

- [ ] **Step 4: Test each section**

1. Click "Pipeline" — should show empty Kanban with "+ New Post" and "Auto-Generate" buttons
2. Click "Create" — should show tool palette on left, empty workspace in center, empty chain context on right
3. Click "Discover" — should show trend list (may be empty if no trends scanned yet)
4. Click "Monitor" — should show engagement list (empty until posts are published)
5. Edit brand settings in sidebar footer — should save and refresh

- [ ] **Step 5: Test tool execution in Create workshop**

1. Select "generate-caption" tool
2. Fill in topic: "ETH staking", platform: "twitter"
3. Click "Run"
4. Result should appear below the form
5. Chain context should update with the caption

- [ ] **Step 6: Test pipeline card creation**

1. After generating a caption, click "Create Post"
2. Card should appear in Draft column of Pipeline view
3. Click the card — Detail Panel should open
4. Click "Send to Review" — card should move to Review column

---

## Summary

| Phase | Tasks | Host Changes | Plugin Backend | Plugin UI |
|-------|-------|-------------|----------------|-----------|
| 1 | 1-4 | SDK types, hooks, bridge, shim | — | — |
| 2 | 5-8 | — | Constants, manifest, data/action handlers | — |
| 3 | 9-10 | — | — | Shared types, styles |
| 4 | 11-16 | — | — | Sidebar, Pipeline, Detail, Create, Discover, Monitor |
| 5 | 17-21 | — | — | Root layout, barrel export, build, verification |

**Total: 21 tasks across 2 repositories.**

Host bridge changes are minimal (1 new hook: `navigateToEntity`) and generic — usable by any future plugin. The `executeTool` and `getToolSchemas` capabilities work entirely through existing plugin bridge infrastructure as data/action handlers.
