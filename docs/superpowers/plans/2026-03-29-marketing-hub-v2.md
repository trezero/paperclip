# Marketing Hub V2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement all 10 V2 roadmap items for the Marketing Hub — real platform publishing, real trends, real engagement, drag-and-drop kanban, campaigns, scheduling, analytics, templates, bulk operations, and A/B testing — plus 3 V1 bug fixes.

**Architecture:** Layer-by-layer approach. Phase 1 builds the platform adapter infrastructure (shared types, resilient HTTP, adapters for Twitter/Reddit/Telegram/RSS.app). Phase 2 builds core UI features (DnD kanban, campaigns, scheduling, templates, bulk ops, A/B variants). Phase 3 wires real data sources, analytics dashboard, streaming fix, and bug fixes. Phase 4 registers agent tools for full AI orchestration parity.

**Tech Stack:** TypeScript, React 19, `@dnd-kit/core` + `@dnd-kit/sortable` (drag-and-drop), `chart.js` + `react-chartjs-2` (analytics), Paperclip Plugin SDK (hooks: `usePluginData`, `usePluginAction`, `usePluginStream`), TweetAPI.com, RSS.app API, Reddit public JSON + OAuth, Telegram Bot API.

**Spec:** `docs/superpowers/specs/2026-03-29-marketing-hub-v2-design.md`

**Plugin workspace:** `/home/winadmin/projects/BrandAmbassador/`

**Reference codebase:** `/home/winadmin/projects/MemeCoinInvestor2026/` (Reddit adapter, resilient HTTP, quality scoring patterns)

---

## File Structure

### New Files (BrandAmbassador plugin)

```
src/services/platforms/
  adapter.ts                — PlatformAdapter interface, shared types (PublishPayload, PublishResult, PlatformPostRef, EngagementMetrics, TrendQuery, TrendItem)
  resilientHttp.ts          — Circuit breaker + retry HTTP client (ported from MemecoinInvestor2026)
  twitterAdapter.ts         — TweetAPI.com adapter implementation
  redditAdapter.ts          — Reddit public JSON reading + OAuth posting
  telegramAdapter.ts        — Telegram Bot API adapter
  rssAppAdapter.ts          — RSS.app feed management + webhook processing
  platformManager.ts        — Adapter registry, health checks, mock mode fallback
  trendScorer.ts            — Trend scoring pipeline (recency, velocity, cross-source, spam filter)

src/handlers/
  webhooks.ts               — RSS.app webhook handler

ui/pages/marketing/
  DnDPipeline.tsx           — Drag-and-drop kanban (replaces current Pipeline.tsx internals)
  Calendar.tsx              — Month-view calendar for scheduling
  Analytics.tsx             — Chart.js analytics dashboard (5th sidebar section)
  Templates.tsx             — Template library + variable fill form
  BulkActionBar.tsx         — Floating bulk action bar
  VariantComparison.tsx     — Side-by-side variant comparison view
  PlatformConnections.tsx   — Credential configuration forms (inside brand settings)

tests/
  platforms/
    adapter.test.ts         — PlatformAdapter mock tests
    twitterAdapter.test.ts  — Twitter adapter unit tests
    redditAdapter.test.ts   — Reddit adapter unit tests
    telegramAdapter.test.ts — Telegram adapter unit tests
    rssAppAdapter.test.ts   — RSS.app adapter unit tests
    resilientHttp.test.ts   — Circuit breaker + retry tests
    trendScorer.test.ts     — Trend scoring pipeline tests
  handlers/
    campaigns.test.ts       — Campaign CRUD handler tests
    scheduling.test.ts      — Scheduling handler + job tests
    templates.test.ts       — Template CRUD handler tests
    variants.test.ts        — Variant group handler tests
    bulkOps.test.ts         — Bulk operations handler tests
```

### Modified Files

```
src/manifest.ts             — Add 9 new agent tools, webhook endpoint for rssapp
src/constants.ts            — Add new data keys, action keys, tool names, state keys
src/worker.ts               — Register new handlers, initialize platformManager
src/handlers/data.ts        — Add: campaigns, templates, variants, analytics data handlers
src/handlers/actions.ts     — Add: campaign CRUD, scheduling, template CRUD, variant CRUD, bulk ops, platform config actions
src/jobs/queue-process.ts   — Add scheduled publishing check
src/jobs/engagement-check.ts— Wire to real platform adapters
src/jobs/trend-scan.ts      — Wire to RSS.app + platform adapters

ui/pages/MarketingHub.tsx   — Add Analytics section, campaign state, selection state, bulk bar
ui/pages/marketing/types.ts — Extend ContentCard, add Campaign, ContentTemplate, VariantGroup, ScoredTrend, EngagementMetrics, etc.
ui/pages/marketing/styles.ts— Add styles for calendar, analytics, bulk bar, variants, DnD
ui/pages/marketing/Pipeline.tsx — Integrate DnDPipeline, campaign filter, Board|Calendar toggle, select mode
ui/pages/marketing/Sidebar.tsx  — Add Campaigns subsection, Analytics nav item, fix brand refresh bug
ui/pages/marketing/Create.tsx   — Add Templates tab, campaign dropdown, variant creation toast
ui/pages/marketing/Discover.tsx — Wire to scored trends, add velocity/source badges, fix React key bug
ui/pages/marketing/Monitor.tsx  — Wire to real engagement data, add trend indicators, alert badges
ui/pages/marketing/DetailPanel.tsx — Add campaign badge, schedule controls, variant controls, save-as-template, platform link
ui/index.tsx                — No changes (MarketingHubPage already exported)

package.json                — Add: @dnd-kit/core, @dnd-kit/sortable, chart.js, react-chartjs-2
```

---

## Phase 1: Platform Adapter Infrastructure

### Task 1: Shared Types & Constants

**Files:**
- Modify: `src/constants.ts`
- Modify: `ui/pages/marketing/types.ts`

- [ ] **Step 1: Extend ContentCard type with V2 fields**

In `ui/pages/marketing/types.ts`, add the V2 fields and new interfaces:

```typescript
// Add to existing ContentCard interface:
  campaignId: string | null
  scheduledAt: string | null
  scheduledStatus: "pending" | "publishing" | "failed" | null
  platformPostRef: PlatformPostRef | null
  publishError: string | null
  publishAttempts: number
  variantGroupId: string | null
  variantLabel: string | null

// New interfaces:
export interface PlatformPostRef {
  platform: Platform
  postId: string
  url: string
  publishedAt: string
}

export interface Campaign {
  id: string
  name: string
  description?: string
  targetPlatforms: Platform[]
  dateRange: { start: string; end: string }
  status: "active" | "completed" | "draft"
  createdAt: string
  updatedAt: string
}

export interface ContentTemplate {
  id: string
  name: string
  description?: string
  platform: Platform
  variables: TemplateVariable[]
  captionTemplate: string
  tone?: string
  mediaPrompt?: string
  toolChain?: string[]
  createdFrom?: string
  useCount: number
  createdAt: string
  updatedAt: string
}

export interface TemplateVariable {
  key: string
  label: string
  type: "text" | "select"
  options?: string[]
  defaultValue?: string
}

export interface VariantGroup {
  id: string
  sourceCardId: string
  topic: string
  variantCardIds: string[]
  winnerCardId?: string
  createdAt: string
}

export interface EngagementMetrics {
  likes: number
  comments: number
  shares: number
  impressions: number
  platform: Platform
  fetchedAt: string
}

export interface EngagementSnapshot {
  cardId: string
  metrics: EngagementMetrics
  timestamp: string
}

export interface EngagementAlerts {
  viralThreshold: number
  engagementDropPercent: number
  enabled: boolean
}

export interface ScoredTrend {
  id: string
  title: string
  description: string
  url: string
  platform: Platform | "web"
  score: number
  sentiment: "positive" | "negative" | "neutral"
  velocity: "rising" | "stable" | "falling"
  firstSeen: string
  lastUpdated: string
  mentionCount: number
  sourceFeeds: string[]
  dismissed: boolean
}

export interface BulkResult {
  total: number
  succeeded: number
  failed: number
  skipped: number
  details: { cardId: string; status: "ok" | "failed" | "skipped"; reason?: string }[]
}
```

- [ ] **Step 2: Add new constants**

In `src/constants.ts`, add under the existing sections:

```typescript
// New data keys
export const DATA_KEY_CAMPAIGNS = "campaigns"
export const DATA_KEY_TEMPLATES = "templates"
export const DATA_KEY_VARIANTS = "variants"
export const DATA_KEY_ANALYTICS = "analytics"

// New action keys
export const ACTION_CREATE_CAMPAIGN = "create-campaign"
export const ACTION_UPDATE_CAMPAIGN = "update-campaign"
export const ACTION_DELETE_CAMPAIGN = "delete-campaign"
export const ACTION_SCHEDULE_CONTENT = "schedule-content"
export const ACTION_CREATE_TEMPLATE = "create-template"
export const ACTION_UPDATE_TEMPLATE = "update-template"
export const ACTION_DELETE_TEMPLATE = "delete-template"
export const ACTION_APPLY_TEMPLATE = "apply-template"
export const ACTION_CREATE_VARIANT = "create-variant"
export const ACTION_PICK_WINNER = "pick-winner"
export const ACTION_BULK_OPERATION = "bulk-operation"
export const ACTION_SAVE_PLATFORM_CONFIG = "save-platform-config"
export const ACTION_TEST_PLATFORM_CONNECTION = "test-platform-connection"

// New tool names (agent-facing)
export const TOOL_MANAGE_CAMPAIGN = "manage-campaign"
export const TOOL_MANAGE_PIPELINE = "manage-pipeline"
export const TOOL_SCHEDULE_CONTENT = "schedule-content"
export const TOOL_READ_ENGAGEMENT = "read-engagement"
export const TOOL_READ_TRENDS = "read-trends"
export const TOOL_MANAGE_VARIANTS = "manage-variants"
export const TOOL_BULK_OPERATIONS = "bulk-operations"
export const TOOL_READ_ANALYTICS = "read-analytics"
export const TOOL_MANAGE_TEMPLATES = "manage-templates"

// State keys
export const STATE_CAMPAIGNS = "campaigns:list"
export const STATE_TEMPLATES = "templates:list"
export const STATE_VARIANT_GROUPS = "variants:groups"
export const STATE_TRENDS_FEEDS = "trends:feeds"
export const STATE_TRENDS_ACTIVE = "trends:active"
export const STATE_ENGAGEMENT_ALERTS = "engagement:alerts"
// engagement:history:{cardId} is dynamic — use helper function
export const engagementHistoryKey = (cardId: string) => `engagement:history:${cardId}`

// Webhook keys
export const WEBHOOK_RSSAPP = "rssapp-feed-update"
```

- [ ] **Step 3: Commit**

```bash
git add src/constants.ts ui/pages/marketing/types.ts
git commit -m "feat: add V2 shared types and constants for Marketing Hub"
```

---

### Task 2: Resilient HTTP Client

**Files:**
- Create: `src/services/platforms/resilientHttp.ts`
- Create: `tests/platforms/resilientHttp.test.ts`

**Reference:** `/home/winadmin/projects/MemeCoinInvestor2026/server/services/resilientHttp.ts`

- [ ] **Step 1: Write failing tests**

Create `tests/platforms/resilientHttp.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest"
import { resilientFetch, CircuitOpenError } from "../../src/services/platforms/resilientHttp.js"

describe("resilientFetch", () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it("returns response on success", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ data: "ok" }),
    })

    const res = await resilientFetch("https://example.com/api", {
      serviceName: "test",
    })
    expect(res.ok).toBe(true)
  })

  it("retries on 503 then succeeds", async () => {
    const fail = { ok: false, status: 503, statusText: "Service Unavailable" }
    const pass = { ok: true, status: 200, json: () => Promise.resolve({}) }
    global.fetch = vi.fn().mockResolvedValueOnce(fail).mockResolvedValueOnce(pass)

    const res = await resilientFetch("https://example.com/api", {
      serviceName: "test",
      maxRetries: 2,
      baseRetryDelayMs: 1,
    })
    expect(res.ok).toBe(true)
    expect(global.fetch).toHaveBeenCalledTimes(2)
  })

  it("opens circuit after threshold failures", async () => {
    const fail = { ok: false, status: 500, statusText: "Server Error" }
    global.fetch = vi.fn().mockResolvedValue(fail)

    const opts = {
      serviceName: "test-circuit",
      endpointKey: "/fail",
      maxRetries: 0,
      circuitFailureThreshold: 2,
      circuitOpenMs: 100,
    }

    // First two failures trip the circuit
    await resilientFetch("https://example.com/fail", opts).catch(() => {})
    await resilientFetch("https://example.com/fail", opts).catch(() => {})

    // Third call should throw CircuitOpenError without hitting fetch
    await expect(resilientFetch("https://example.com/fail", opts))
      .rejects.toThrow(CircuitOpenError)
  })

  it("times out after specified duration", async () => {
    global.fetch = vi.fn().mockImplementation(
      () => new Promise((resolve) => setTimeout(resolve, 5000))
    )

    await expect(
      resilientFetch("https://example.com/slow", {
        serviceName: "test",
        timeoutMs: 50,
        maxRetries: 0,
      })
    ).rejects.toThrow()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /home/winadmin/projects/BrandAmbassador && npx vitest run tests/platforms/resilientHttp.test.ts`

If vitest is not installed, first: `npm install -D vitest`

Expected: FAIL — module not found

- [ ] **Step 3: Implement resilientFetch**

Create `src/services/platforms/resilientHttp.ts`:

```typescript
export class CircuitOpenError extends Error {
  retryAfterMs: number
  constructor(service: string, retryAfterMs: number) {
    super(`Circuit open for ${service}, retry after ${retryAfterMs}ms`)
    this.name = "CircuitOpenError"
    this.retryAfterMs = retryAfterMs
  }
}

export interface ResilientFetchOptions {
  serviceName: string
  endpointKey?: string
  timeoutMs?: number
  maxRetries?: number
  baseRetryDelayMs?: number
  retryStatuses?: number[]
  circuitFailureThreshold?: number
  circuitOpenMs?: number
}

interface CircuitState {
  failures: number
  openUntil: number // timestamp
}

const circuits = new Map<string, CircuitState>()

const DEFAULT_RETRY_STATUSES = [408, 425, 429, 500, 502, 503, 504]

function circuitKey(opts: ResilientFetchOptions): string {
  return `${opts.serviceName}:${opts.endpointKey ?? "default"}`
}

export async function resilientFetch(
  url: string,
  opts: ResilientFetchOptions,
  init?: RequestInit,
): Promise<Response> {
  const key = circuitKey(opts)
  const threshold = opts.circuitFailureThreshold ?? 6
  const openMs = opts.circuitOpenMs ?? 30_000
  const maxRetries = opts.maxRetries ?? 1
  const baseDelay = opts.baseRetryDelayMs ?? 350
  const timeoutMs = opts.timeoutMs ?? 8_000
  const retryStatuses = opts.retryStatuses ?? DEFAULT_RETRY_STATUSES

  // Check circuit
  const state = circuits.get(key)
  if (state && state.failures >= threshold) {
    if (Date.now() < state.openUntil) {
      throw new CircuitOpenError(key, state.openUntil - Date.now())
    }
    // Half-open: allow one attempt
    state.failures = threshold - 1
  }

  let lastError: Error | null = null

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), timeoutMs)

      const response = await fetch(url, {
        ...init,
        signal: controller.signal,
      })

      clearTimeout(timer)

      if (response.ok) {
        // Reset circuit on success
        circuits.delete(key)
        return response
      }

      if (retryStatuses.includes(response.status) && attempt < maxRetries) {
        await sleep(baseDelay * Math.pow(2, attempt))
        continue
      }

      // Non-retryable failure
      recordFailure(key, threshold, openMs)
      return response
    } catch (err) {
      lastError = err as Error
      if (attempt < maxRetries) {
        await sleep(baseDelay * Math.pow(2, attempt))
        continue
      }
    }
  }

  recordFailure(key, threshold, openMs)
  throw lastError ?? new Error(`resilientFetch failed for ${key}`)
}

function recordFailure(key: string, threshold: number, openMs: number): void {
  const state = circuits.get(key) ?? { failures: 0, openUntil: 0 }
  state.failures++
  if (state.failures >= threshold) {
    state.openUntil = Date.now() + openMs
  }
  circuits.set(key, state)
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

/** Reset all circuit state — for testing */
export function resetCircuits(): void {
  circuits.clear()
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/platforms/resilientHttp.test.ts`
Expected: 4 tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/services/platforms/resilientHttp.ts tests/platforms/resilientHttp.test.ts
git commit -m "feat: add resilient HTTP client with circuit breaker"
```

---

### Task 3: PlatformAdapter Interface & Platform Manager

**Files:**
- Create: `src/services/platforms/adapter.ts`
- Create: `src/services/platforms/platformManager.ts`

- [ ] **Step 1: Create adapter interface**

Create `src/services/platforms/adapter.ts`:

```typescript
import type { Platform } from "../../ui/pages/marketing/types.js"

export interface PublishPayload {
  caption: string
  platform: Platform
  mediaRef?: string
  mediaType?: "image" | "video"
  threadSplit?: boolean
  formatting?: "markdown" | "plain"
}

export interface PublishResult {
  success: boolean
  platformPostId: string
  platformUrl: string
  error?: string
}

export interface PlatformPostRef {
  platform: Platform
  postId: string
  url: string
  publishedAt: string
}

export interface EngagementMetrics {
  likes: number
  comments: number
  shares: number
  impressions: number
  platform: Platform
  fetchedAt: string
}

export interface TrendQuery {
  keywords: string[]
  platforms?: Platform[]
  limit?: number
}

export interface TrendItem {
  id: string
  title: string
  description: string
  url: string
  platform: Platform | "web"
  publishedAt: string
  source: string
}

export interface PlatformAdapter {
  platform: Platform
  publish(content: PublishPayload): Promise<PublishResult>
  getEngagement(postRef: PlatformPostRef): Promise<EngagementMetrics>
  discoverTrends?(query: TrendQuery): Promise<TrendItem[]>
  health(): Promise<{ ok: boolean; reason?: string }>
}
```

- [ ] **Step 2: Create platform manager**

Create `src/services/platforms/platformManager.ts`:

```typescript
import type { Platform } from "../../ui/pages/marketing/types.js"
import type {
  PlatformAdapter,
  PublishPayload,
  PublishResult,
  PlatformPostRef,
  EngagementMetrics,
  TrendQuery,
  TrendItem,
} from "./adapter.js"

export class PlatformManager {
  private adapters = new Map<Platform, PlatformAdapter>()

  register(adapter: PlatformAdapter): void {
    this.adapters.set(adapter.platform, adapter)
  }

  get(platform: Platform): PlatformAdapter | undefined {
    return this.adapters.get(platform)
  }

  async publish(payload: PublishPayload): Promise<PublishResult> {
    const adapter = this.adapters.get(payload.platform)
    if (!adapter) {
      return {
        success: false,
        platformPostId: "",
        platformUrl: "",
        error: `No adapter configured for ${payload.platform}`,
      }
    }
    const health = await adapter.health()
    if (!health.ok) {
      return {
        success: false,
        platformPostId: "",
        platformUrl: "",
        error: `${payload.platform} adapter unhealthy: ${health.reason}`,
      }
    }
    return adapter.publish(payload)
  }

  async getEngagement(postRef: PlatformPostRef): Promise<EngagementMetrics | null> {
    const adapter = this.adapters.get(postRef.platform)
    if (!adapter) return null
    const health = await adapter.health()
    if (!health.ok) return null
    return adapter.getEngagement(postRef)
  }

  async discoverTrends(query: TrendQuery): Promise<TrendItem[]> {
    const results: TrendItem[] = []
    const platforms = query.platforms ?? [...this.adapters.keys()]

    for (const platform of platforms) {
      const adapter = this.adapters.get(platform)
      if (!adapter?.discoverTrends) continue
      const health = await adapter.health()
      if (!health.ok) continue
      try {
        const items = await adapter.discoverTrends(query)
        results.push(...items)
      } catch {
        // Swallow — partial failure is fine for trend discovery
      }
    }
    return results
  }

  async healthAll(): Promise<Record<string, { ok: boolean; reason?: string }>> {
    const report: Record<string, { ok: boolean; reason?: string }> = {}
    for (const [platform, adapter] of this.adapters) {
      try {
        report[platform] = await adapter.health()
      } catch (err) {
        report[platform] = { ok: false, reason: String(err) }
      }
    }
    return report
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add src/services/platforms/adapter.ts src/services/platforms/platformManager.ts
git commit -m "feat: add PlatformAdapter interface and PlatformManager registry"
```

---

### Task 4: Twitter Adapter (TweetAPI.com)

**Files:**
- Create: `src/services/platforms/twitterAdapter.ts`
- Create: `tests/platforms/twitterAdapter.test.ts`

- [ ] **Step 1: Write failing tests**

Create `tests/platforms/twitterAdapter.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest"
import { TwitterAdapter } from "../../src/services/platforms/twitterAdapter.js"

describe("TwitterAdapter", () => {
  let adapter: TwitterAdapter

  beforeEach(() => {
    vi.restoreAllMocks()
    adapter = new TwitterAdapter("test-api-key")
  })

  it("reports healthy when API key is set", async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200, json: () => Promise.resolve({}) })
    const result = await adapter.health()
    expect(result.ok).toBe(true)
  })

  it("reports unhealthy when no API key", async () => {
    const noKey = new TwitterAdapter("")
    const result = await noKey.health()
    expect(result).toEqual({ ok: false, reason: "TWEETAPI_API_KEY not configured" })
  })

  it("publishes a tweet and returns post reference", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({
        data: { id: "tweet-123", text: "Hello world" },
      }),
    })

    const result = await adapter.publish({
      caption: "Hello world",
      platform: "twitter",
    })

    expect(result.success).toBe(true)
    expect(result.platformPostId).toBe("tweet-123")
    expect(result.platformUrl).toContain("tweet-123")
  })

  it("splits long captions into threads", async () => {
    const longCaption = "A".repeat(300) + ". " + "B".repeat(100)

    const responses: unknown[] = []
    global.fetch = vi.fn().mockImplementation(async (_url, init) => {
      const body = JSON.parse((init as RequestInit).body as string)
      responses.push(body)
      return {
        ok: true,
        status: 200,
        json: () => Promise.resolve({ data: { id: `tweet-${responses.length}` } }),
      }
    })

    const result = await adapter.publish({
      caption: longCaption,
      platform: "twitter",
      threadSplit: true,
    })

    expect(result.success).toBe(true)
    expect(responses.length).toBeGreaterThan(1)
  })

  it("fetches engagement metrics", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({
        data: {
          public_metrics: {
            like_count: 42,
            reply_count: 5,
            retweet_count: 10,
            quote_count: 3,
            impression_count: 1200,
          },
        },
      }),
    })

    const metrics = await adapter.getEngagement({
      platform: "twitter",
      postId: "tweet-123",
      url: "https://x.com/user/status/tweet-123",
      publishedAt: new Date().toISOString(),
    })

    expect(metrics.likes).toBe(42)
    expect(metrics.comments).toBe(5)
    expect(metrics.shares).toBe(13) // retweet + quote
    expect(metrics.impressions).toBe(1200)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/platforms/twitterAdapter.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement Twitter adapter**

Create `src/services/platforms/twitterAdapter.ts`:

```typescript
import type {
  PlatformAdapter,
  PublishPayload,
  PublishResult,
  PlatformPostRef,
  EngagementMetrics,
  TrendQuery,
  TrendItem,
} from "./adapter.js"
import { resilientFetch } from "./resilientHttp.js"

const TWEETAPI_BASE = "https://api.tweetapi.com/v1"

export class TwitterAdapter implements PlatformAdapter {
  readonly platform = "twitter" as const
  private apiKey: string

  constructor(apiKey: string) {
    this.apiKey = apiKey
  }

  async health(): Promise<{ ok: boolean; reason?: string }> {
    if (!this.apiKey) return { ok: false, reason: "TWEETAPI_API_KEY not configured" }
    try {
      const res = await resilientFetch(`${TWEETAPI_BASE}/account/verify`, {
        serviceName: "twitter",
        endpointKey: "/verify",
        maxRetries: 0,
        timeoutMs: 5_000,
      }, {
        headers: { Authorization: `Bearer ${this.apiKey}` },
      })
      return res.ok ? { ok: true } : { ok: false, reason: `API returned ${res.status}` }
    } catch (err) {
      return { ok: false, reason: String(err) }
    }
  }

  async publish(content: PublishPayload): Promise<PublishResult> {
    if (!this.apiKey) {
      return { success: false, platformPostId: "", platformUrl: "", error: "Not configured" }
    }

    const shouldThread = content.threadSplit !== false && content.caption.length > 280
    const chunks = shouldThread ? splitThread(content.caption) : [content.caption]

    let firstTweetId = ""
    let replyToId: string | undefined

    for (const chunk of chunks) {
      const body: Record<string, unknown> = { text: chunk }
      if (replyToId) body.reply = { in_reply_to_tweet_id: replyToId }
      if (!replyToId && content.mediaRef) {
        body.media = { media_urls: [content.mediaRef] }
      }

      try {
        const res = await resilientFetch(`${TWEETAPI_BASE}/tweets`, {
          serviceName: "twitter",
          endpointKey: "/tweets",
        }, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(body),
        })

        if (!res.ok) {
          const err = await res.json().catch(() => ({}))
          return { success: false, platformPostId: "", platformUrl: "", error: JSON.stringify(err) }
        }

        const data = await res.json() as { data: { id: string } }
        if (!firstTweetId) firstTweetId = data.data.id
        replyToId = data.data.id
      } catch (err) {
        return { success: false, platformPostId: "", platformUrl: "", error: String(err) }
      }
    }

    return {
      success: true,
      platformPostId: firstTweetId,
      platformUrl: `https://x.com/i/status/${firstTweetId}`,
    }
  }

  async getEngagement(postRef: PlatformPostRef): Promise<EngagementMetrics> {
    const res = await resilientFetch(
      `${TWEETAPI_BASE}/tweets/${postRef.postId}?tweet.fields=public_metrics`,
      { serviceName: "twitter", endpointKey: "/tweets/:id" },
      { headers: { Authorization: `Bearer ${this.apiKey}` } },
    )

    const json = await res.json() as {
      data: {
        public_metrics: {
          like_count: number
          reply_count: number
          retweet_count: number
          quote_count: number
          impression_count: number
        }
      }
    }

    const m = json.data.public_metrics
    return {
      likes: m.like_count,
      comments: m.reply_count,
      shares: m.retweet_count + m.quote_count,
      impressions: m.impression_count,
      platform: "twitter",
      fetchedAt: new Date().toISOString(),
    }
  }

  async discoverTrends(query: TrendQuery): Promise<TrendItem[]> {
    const q = query.keywords.join(" OR ")
    const limit = query.limit ?? 20
    const res = await resilientFetch(
      `${TWEETAPI_BASE}/tweets/search/recent?query=${encodeURIComponent(q)}&max_results=${limit}&tweet.fields=created_at,author_id,text`,
      { serviceName: "twitter", endpointKey: "/search" },
      { headers: { Authorization: `Bearer ${this.apiKey}` } },
    )

    const json = await res.json() as { data?: Array<{ id: string; text: string; created_at: string }> }
    return (json.data ?? []).map((tweet) => ({
      id: `twitter-${tweet.id}`,
      title: tweet.text.slice(0, 120),
      description: tweet.text,
      url: `https://x.com/i/status/${tweet.id}`,
      platform: "twitter" as const,
      publishedAt: tweet.created_at,
      source: "tweetapi-search",
    }))
  }
}

function splitThread(text: string): string[] {
  const MAX = 280
  if (text.length <= MAX) return [text]

  const sentences = text.match(/[^.!?]+[.!?]+\s*/g) ?? [text]
  const chunks: string[] = []
  let current = ""

  for (const sentence of sentences) {
    if ((current + sentence).length > MAX && current.length > 0) {
      chunks.push(current.trim())
      current = sentence
    } else {
      current += sentence
    }
  }
  if (current.trim()) chunks.push(current.trim())

  return chunks
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/platforms/twitterAdapter.test.ts`
Expected: 5 tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/services/platforms/twitterAdapter.ts tests/platforms/twitterAdapter.test.ts
git commit -m "feat: add Twitter adapter via TweetAPI.com"
```

---

### Task 5: Reddit Adapter

**Files:**
- Create: `src/services/platforms/redditAdapter.ts`
- Create: `tests/platforms/redditAdapter.test.ts`

**Reference:** `/home/winadmin/projects/MemeCoinInvestor2026/server/services/social/redditAdapter.ts`

- [ ] **Step 1: Write failing tests**

Create `tests/platforms/redditAdapter.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest"
import { RedditAdapter } from "../../src/services/platforms/redditAdapter.js"

describe("RedditAdapter", () => {
  let adapter: RedditAdapter

  beforeEach(() => {
    vi.restoreAllMocks()
    adapter = new RedditAdapter() // Reading needs no auth
  })

  it("health always ok for reading (no auth needed)", async () => {
    const result = await adapter.health()
    expect(result.ok).toBe(true)
  })

  it("discovers trends from hot posts", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({
        data: {
          children: [
            {
              data: {
                id: "abc123",
                title: "Big DeFi news",
                selftext: "Details here",
                author: "user1",
                created_utc: Date.now() / 1000,
                permalink: "/r/crypto/comments/abc123/big_defi_news/",
                ups: 500,
                subreddit: "crypto",
              },
            },
          ],
        },
      }),
    })

    const trends = await adapter.discoverTrends({ keywords: ["DeFi"] })
    expect(trends).toHaveLength(1)
    expect(trends[0].platform).toBe("reddit")
    expect(trends[0].title).toBe("Big DeFi news")
  })

  it("fetches engagement (upvotes + comments)", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve([
        { data: { children: [{ data: { ups: 250, num_comments: 42, subreddit: "test" } }] } },
      ]),
    })

    const metrics = await adapter.getEngagement({
      platform: "reddit",
      postId: "abc123",
      url: "https://reddit.com/r/test/comments/abc123/title/",
      publishedAt: new Date().toISOString(),
    })

    expect(metrics.likes).toBe(250)
    expect(metrics.comments).toBe(42)
  })

  it("publish requires OAuth credentials", async () => {
    const result = await adapter.publish({
      caption: "Test post",
      platform: "reddit",
    })
    expect(result.success).toBe(false)
    expect(result.error).toContain("OAuth")
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/platforms/redditAdapter.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement Reddit adapter**

Create `src/services/platforms/redditAdapter.ts`:

```typescript
import type {
  PlatformAdapter,
  PublishPayload,
  PublishResult,
  PlatformPostRef,
  EngagementMetrics,
  TrendQuery,
  TrendItem,
} from "./adapter.js"
import { resilientFetch } from "./resilientHttp.js"

interface RedditChild {
  data: {
    id: string
    title: string
    selftext: string
    author: string
    created_utc: number
    permalink: string
    ups: number
    num_comments: number
    subreddit: string
  }
}

const REDDIT_FETCH_OPTS = {
  serviceName: "reddit",
  maxRetries: 1,
  timeoutMs: 8_000,
  circuitFailureThreshold: 6,
  circuitOpenMs: 30_000,
}

export class RedditAdapter implements PlatformAdapter {
  readonly platform = "reddit" as const
  private oauthToken: string | null
  private subreddits: string[]

  constructor(oauthToken?: string, subreddits: string[] = []) {
    this.oauthToken = oauthToken ?? null
    this.subreddits = subreddits
  }

  async health(): Promise<{ ok: boolean; reason?: string }> {
    // Reading uses public JSON — always available
    return { ok: true }
  }

  async publish(content: PublishPayload): Promise<PublishResult> {
    if (!this.oauthToken) {
      return {
        success: false,
        platformPostId: "",
        platformUrl: "",
        error: "Reddit OAuth credentials not configured",
      }
    }

    const subreddit = this.subreddits[0]
    if (!subreddit) {
      return { success: false, platformPostId: "", platformUrl: "", error: "No target subreddit configured" }
    }

    const params = new URLSearchParams({
      sr: subreddit,
      kind: content.mediaRef ? "image" : "self",
      title: content.caption.split("\n")[0].slice(0, 300),
      text: content.caption,
      api_type: "json",
    })

    const res = await resilientFetch("https://oauth.reddit.com/api/submit", {
      ...REDDIT_FETCH_OPTS,
      endpointKey: "/api/submit",
    }, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.oauthToken}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    })

    const json = await res.json() as { json: { data?: { id: string; url: string; name: string } } }
    const data = json.json.data
    if (!data) {
      return { success: false, platformPostId: "", platformUrl: "", error: "Reddit submit failed" }
    }

    return {
      success: true,
      platformPostId: data.id,
      platformUrl: data.url,
    }
  }

  async getEngagement(postRef: PlatformPostRef): Promise<EngagementMetrics> {
    const res = await resilientFetch(
      `${postRef.url}.json`,
      { ...REDDIT_FETCH_OPTS, endpointKey: "/comments" },
    )

    const json = await res.json() as Array<{ data: { children: RedditChild[] } }>
    const post = json[0]?.data?.children?.[0]?.data

    return {
      likes: post?.ups ?? 0,
      comments: post?.num_comments ?? 0,
      shares: 0, // Reddit doesn't expose crosspost count in public JSON
      impressions: 0, // Not available
      platform: "reddit",
      fetchedAt: new Date().toISOString(),
    }
  }

  async discoverTrends(query: TrendQuery): Promise<TrendItem[]> {
    const q = query.keywords.join(" ")
    const limit = query.limit ?? 10

    const res = await resilientFetch(
      `https://www.reddit.com/search.json?q=${encodeURIComponent(q)}&sort=hot&limit=${limit}`,
      { ...REDDIT_FETCH_OPTS, endpointKey: "/search" },
    )

    const json = await res.json() as { data: { children: RedditChild[] } }
    return json.data.children.map(({ data: p }) => ({
      id: `reddit-${p.id}`,
      title: p.title,
      description: p.selftext.slice(0, 300),
      url: `https://reddit.com${p.permalink}`,
      platform: "reddit" as const,
      publishedAt: new Date(p.created_utc * 1000).toISOString(),
      source: `reddit:${p.subreddit}`,
    }))
  }

  async getHotPosts(subreddit: string, limit = 10): Promise<TrendItem[]> {
    const res = await resilientFetch(
      `https://www.reddit.com/r/${subreddit}/hot.json?limit=${limit}`,
      { ...REDDIT_FETCH_OPTS, endpointKey: `/r/${subreddit}/hot` },
    )

    const json = await res.json() as { data: { children: RedditChild[] } }
    return json.data.children.map(({ data: p }) => ({
      id: `reddit-${p.id}`,
      title: p.title,
      description: p.selftext.slice(0, 300),
      url: `https://reddit.com${p.permalink}`,
      platform: "reddit" as const,
      publishedAt: new Date(p.created_utc * 1000).toISOString(),
      source: `reddit:${p.subreddit}`,
    }))
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/platforms/redditAdapter.test.ts`
Expected: 4 tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/services/platforms/redditAdapter.ts tests/platforms/redditAdapter.test.ts
git commit -m "feat: add Reddit adapter with public JSON reading and OAuth posting"
```

---

### Task 6: Telegram Adapter

**Files:**
- Create: `src/services/platforms/telegramAdapter.ts`
- Create: `tests/platforms/telegramAdapter.test.ts`

- [ ] **Step 1: Write failing tests**

Create `tests/platforms/telegramAdapter.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest"
import { TelegramAdapter } from "../../src/services/platforms/telegramAdapter.js"

describe("TelegramAdapter", () => {
  let adapter: TelegramAdapter

  beforeEach(() => {
    vi.restoreAllMocks()
    adapter = new TelegramAdapter("bot-token-123", ["-1001234567890"])
  })

  it("reports healthy with valid token", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true, status: 200,
      json: () => Promise.resolve({ ok: true, result: { id: 123 } }),
    })
    const result = await adapter.health()
    expect(result.ok).toBe(true)
  })

  it("reports unhealthy without token", async () => {
    const noToken = new TelegramAdapter("", [])
    const result = await noToken.health()
    expect(result).toEqual({ ok: false, reason: "TELEGRAM_BOT_TOKEN not configured" })
  })

  it("publishes text message to channel", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true, status: 200,
      json: () => Promise.resolve({ ok: true, result: { message_id: 456, chat: { id: -100 } } }),
    })

    const result = await adapter.publish({
      caption: "Hello from Marketing Hub",
      platform: "telegram",
      formatting: "markdown",
    })

    expect(result.success).toBe(true)
    expect(result.platformPostId).toBe("456")
  })

  it("publishes photo message when mediaRef present", async () => {
    const calls: string[] = []
    global.fetch = vi.fn().mockImplementation(async (url: string) => {
      calls.push(url)
      return {
        ok: true, status: 200,
        json: () => Promise.resolve({ ok: true, result: { message_id: 789 } }),
      }
    })

    await adapter.publish({
      caption: "Check this out",
      platform: "telegram",
      mediaRef: "https://example.com/image.png",
      mediaType: "image",
    })

    expect(calls[0]).toContain("sendPhoto")
  })

  it("fetches engagement from channel message", async () => {
    // Telegram Bot API doesn't directly expose view counts via getMessages
    // We use the forwarding workaround or accept limited data
    global.fetch = vi.fn().mockResolvedValue({
      ok: true, status: 200,
      json: () => Promise.resolve({ ok: true, result: { views: 1500 } }),
    })

    const metrics = await adapter.getEngagement({
      platform: "telegram",
      postId: "456:-1001234567890",
      url: "https://t.me/c/1234567890/456",
      publishedAt: new Date().toISOString(),
    })

    expect(metrics.platform).toBe("telegram")
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/platforms/telegramAdapter.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement Telegram adapter**

Create `src/services/platforms/telegramAdapter.ts`:

```typescript
import type {
  PlatformAdapter,
  PublishPayload,
  PublishResult,
  PlatformPostRef,
  EngagementMetrics,
} from "./adapter.js"
import { resilientFetch } from "./resilientHttp.js"

const TG_API = "https://api.telegram.org"

export class TelegramAdapter implements PlatformAdapter {
  readonly platform = "telegram" as const
  private botToken: string
  private channelIds: string[]

  constructor(botToken: string, channelIds: string[]) {
    this.botToken = botToken
    this.channelIds = channelIds
  }

  private api(method: string): string {
    return `${TG_API}/bot${this.botToken}/${method}`
  }

  async health(): Promise<{ ok: boolean; reason?: string }> {
    if (!this.botToken) return { ok: false, reason: "TELEGRAM_BOT_TOKEN not configured" }
    try {
      const res = await resilientFetch(this.api("getMe"), {
        serviceName: "telegram",
        endpointKey: "/getMe",
        maxRetries: 0,
        timeoutMs: 5_000,
      })
      const json = await res.json() as { ok: boolean }
      return json.ok ? { ok: true } : { ok: false, reason: "Bot token invalid" }
    } catch (err) {
      return { ok: false, reason: String(err) }
    }
  }

  async publish(content: PublishPayload): Promise<PublishResult> {
    if (!this.botToken || this.channelIds.length === 0) {
      return { success: false, platformPostId: "", platformUrl: "", error: "Not configured" }
    }

    const chatId = this.channelIds[0]
    const useMarkdown = content.formatting === "markdown"
    const isPhoto = content.mediaRef && content.mediaType === "image"

    const method = isPhoto ? "sendPhoto" : "sendMessage"
    const body: Record<string, unknown> = {
      chat_id: chatId,
      ...(useMarkdown ? { parse_mode: "MarkdownV2" } : {}),
    }

    if (isPhoto) {
      body.photo = content.mediaRef
      body.caption = content.caption
    } else {
      body.text = content.caption
    }

    try {
      const res = await resilientFetch(this.api(method), {
        serviceName: "telegram",
        endpointKey: `/${method}`,
      }, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })

      const json = await res.json() as { ok: boolean; result?: { message_id: number } }
      if (!json.ok || !json.result) {
        return { success: false, platformPostId: "", platformUrl: "", error: "Telegram API error" }
      }

      const messageId = json.result.message_id
      // Construct t.me link — strip leading -100 from channel ID for link
      const channelNum = chatId.replace(/^-100/, "")
      return {
        success: true,
        platformPostId: `${messageId}:${chatId}`,
        platformUrl: `https://t.me/c/${channelNum}/${messageId}`,
      }
    } catch (err) {
      return { success: false, platformPostId: "", platformUrl: "", error: String(err) }
    }
  }

  async getEngagement(postRef: PlatformPostRef): Promise<EngagementMetrics> {
    // Telegram Bot API has limited engagement access
    // Channel view counts require channel admin stats API
    // Return zeroes as baseline — V3 can add channel stats integration
    return {
      likes: 0,
      comments: 0,
      shares: 0,
      impressions: 0,
      platform: "telegram",
      fetchedAt: new Date().toISOString(),
    }
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/platforms/telegramAdapter.test.ts`
Expected: 5 tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/services/platforms/telegramAdapter.ts tests/platforms/telegramAdapter.test.ts
git commit -m "feat: add Telegram adapter with Bot API publishing"
```

---

### Task 7: RSS.app Adapter

**Files:**
- Create: `src/services/platforms/rssAppAdapter.ts`
- Create: `tests/platforms/rssAppAdapter.test.ts`

- [ ] **Step 1: Write failing tests**

Create `tests/platforms/rssAppAdapter.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest"
import { RssAppAdapter } from "../../src/services/platforms/rssAppAdapter.js"

describe("RssAppAdapter", () => {
  let adapter: RssAppAdapter

  beforeEach(() => {
    vi.restoreAllMocks()
    adapter = new RssAppAdapter("api-key", "api-secret")
  })

  it("creates a keyword feed", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true, status: 201,
      json: () => Promise.resolve({ id: "feed-123", title: "DeFi News" }),
    })

    const feed = await adapter.createKeywordFeed("DeFi", "US:en")
    expect(feed.id).toBe("feed-123")
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining("/v1/feeds"),
      expect.objectContaining({ method: "POST" }),
    )
  })

  it("creates a URL feed", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true, status: 201,
      json: () => Promise.resolve({ id: "feed-456" }),
    })

    const feed = await adapter.createUrlFeed("https://twitter.com/search?q=DeFi")
    expect(feed.id).toBe("feed-456")
  })

  it("retrieves feed items", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true, status: 200,
      json: () => Promise.resolve({
        id: "feed-123",
        items: [
          {
            url: "https://example.com/article",
            title: "Hot Take",
            description_text: "Details...",
            date_published: "2026-03-29T10:00:00Z",
          },
        ],
      }),
    })

    const items = await adapter.getFeedItems("feed-123")
    expect(items).toHaveLength(1)
    expect(items[0].title).toBe("Hot Take")
  })

  it("deletes a feed", async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200, json: () => Promise.resolve({}) })
    await adapter.deleteFeed("feed-123")
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining("feed-123"),
      expect.objectContaining({ method: "DELETE" }),
    )
  })

  it("reports unhealthy without credentials", async () => {
    const noKey = new RssAppAdapter("", "")
    const result = await noKey.health()
    expect(result.ok).toBe(false)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/platforms/rssAppAdapter.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement RSS.app adapter**

Create `src/services/platforms/rssAppAdapter.ts`:

```typescript
import { resilientFetch } from "./resilientHttp.js"

const RSSAPP_BASE = "https://api.rss.app"

interface RssAppFeed {
  id: string
  title?: string
  source_url?: string
  rss_feed_url?: string
}

export interface RssAppFeedItem {
  url: string
  title: string
  description_text: string
  description_html?: string
  thumbnail?: string
  date_published: string
  authors?: Array<{ name: string }>
}

export class RssAppAdapter {
  private apiKey: string
  private apiSecret: string

  constructor(apiKey: string, apiSecret: string) {
    this.apiKey = apiKey
    this.apiSecret = apiSecret
  }

  private headers(): Record<string, string> {
    return {
      Authorization: `Bearer ${this.apiKey}:${this.apiSecret}`,
      "Content-Type": "application/json",
    }
  }

  async health(): Promise<{ ok: boolean; reason?: string }> {
    if (!this.apiKey || !this.apiSecret) {
      return { ok: false, reason: "RSSAPP credentials not configured" }
    }
    try {
      const res = await resilientFetch(`${RSSAPP_BASE}/v1/feeds?limit=1`, {
        serviceName: "rssapp",
        endpointKey: "/feeds",
        maxRetries: 0,
        timeoutMs: 5_000,
      }, { headers: this.headers() })
      return res.ok ? { ok: true } : { ok: false, reason: `API returned ${res.status}` }
    } catch (err) {
      return { ok: false, reason: String(err) }
    }
  }

  async createKeywordFeed(keyword: string, region = "US:en"): Promise<RssAppFeed> {
    const res = await resilientFetch(`${RSSAPP_BASE}/v1/feeds`, {
      serviceName: "rssapp",
      endpointKey: "/feeds/create",
    }, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify({ keyword, region }),
    })
    return res.json() as Promise<RssAppFeed>
  }

  async createUrlFeed(url: string): Promise<RssAppFeed> {
    const res = await resilientFetch(`${RSSAPP_BASE}/v1/feeds`, {
      serviceName: "rssapp",
      endpointKey: "/feeds/create",
    }, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify({ url }),
    })
    return res.json() as Promise<RssAppFeed>
  }

  async getFeedItems(feedId: string): Promise<RssAppFeedItem[]> {
    const res = await resilientFetch(`${RSSAPP_BASE}/v1/feeds/${feedId}`, {
      serviceName: "rssapp",
      endpointKey: "/feeds/:id",
    }, { headers: this.headers() })

    const json = await res.json() as { items?: RssAppFeedItem[] }
    return json.items ?? []
  }

  async listFeeds(): Promise<RssAppFeed[]> {
    const res = await resilientFetch(`${RSSAPP_BASE}/v1/feeds`, {
      serviceName: "rssapp",
      endpointKey: "/feeds",
    }, { headers: this.headers() })

    const json = await res.json() as { data?: RssAppFeed[] }
    return json.data ?? []
  }

  async deleteFeed(feedId: string): Promise<void> {
    await resilientFetch(`${RSSAPP_BASE}/v1/feeds/${feedId}`, {
      serviceName: "rssapp",
      endpointKey: "/feeds/:id",
    }, {
      method: "DELETE",
      headers: this.headers(),
    })
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/platforms/rssAppAdapter.test.ts`
Expected: 5 tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/services/platforms/rssAppAdapter.ts tests/platforms/rssAppAdapter.test.ts
git commit -m "feat: add RSS.app adapter for trend feed management"
```

---

### Task 8: Trend Scoring Pipeline

**Files:**
- Create: `src/services/platforms/trendScorer.ts`
- Create: `tests/platforms/trendScorer.test.ts`

**Reference:** `/home/winadmin/projects/MemeCoinInvestor2026/server/services/socialSignalQuality.ts`

- [ ] **Step 1: Write failing tests**

Create `tests/platforms/trendScorer.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from "vitest"
import { TrendScorer } from "../../src/services/platforms/trendScorer.js"
import type { ScoredTrend } from "../../ui/pages/marketing/types.js"

describe("TrendScorer", () => {
  let scorer: TrendScorer

  beforeEach(() => {
    scorer = new TrendScorer({ brandKeywords: ["DeFi", "crypto"] })
  })

  it("scores a relevant fresh trend highly", () => {
    const trend = scorer.score({
      id: "t1",
      title: "DeFi Protocol Launches New Feature",
      description: "Major crypto DeFi protocol...",
      url: "https://example.com",
      platform: "twitter",
      publishedAt: new Date().toISOString(),
      source: "rssapp",
    })
    expect(trend.score).toBeGreaterThan(50)
    expect(trend.velocity).toBe("stable")
  })

  it("scores old trends lower", () => {
    const old = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString()
    const trend = scorer.score({
      id: "t2", title: "DeFi news", description: "old", url: "", platform: "web",
      publishedAt: old, source: "rssapp",
    })
    expect(trend.score).toBeLessThan(30)
  })

  it("filters spam content", () => {
    const trend = scorer.score({
      id: "t3", title: "🚀🚀🚀 100X GUARANTEED AIRDROP NOW FREE MINT 🚀🚀🚀",
      description: "JOIN NOW", url: "", platform: "twitter",
      publishedAt: new Date().toISOString(), source: "rssapp",
    })
    expect(trend.score).toBeLessThan(20)
  })

  it("deduplicates identical trends", () => {
    const item = {
      id: "t4", title: "Same headline", description: "Same text", url: "",
      platform: "twitter" as const, publishedAt: new Date().toISOString(), source: "rssapp",
    }
    const first = scorer.score(item)
    const dupe = scorer.score({ ...item, id: "t4-dupe" })
    expect(first.score).toBeGreaterThan(0)
    expect(dupe.score).toBe(0) // deduplicated
  })

  it("detects rising velocity with multiple mentions", () => {
    scorer.score({
      id: "t5a", title: "Topic A mentioned", description: "...", url: "",
      platform: "twitter", publishedAt: new Date().toISOString(), source: "feed-1",
    })
    scorer.score({
      id: "t5b", title: "Topic A mentioned again", description: "...", url: "",
      platform: "reddit", publishedAt: new Date().toISOString(), source: "feed-2",
    })
    const result = scorer.score({
      id: "t5c", title: "Topic A mentioned third time", description: "...", url: "",
      platform: "web", publishedAt: new Date().toISOString(), source: "feed-3",
    })
    expect(result.velocity).toBe("rising")
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/platforms/trendScorer.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement trend scorer**

Create `src/services/platforms/trendScorer.ts`:

```typescript
import type { ScoredTrend, Platform } from "../../ui/pages/marketing/types.js"
import type { TrendItem } from "./adapter.js"

interface TrendScorerConfig {
  brandKeywords: string[]
  duplicateWindowMs?: number
  maxContentAgeMs?: number
}

const SPAM_KEYWORDS = [
  "100x", "guaranteed", "airdrop now", "free mint",
  "pump signal", "copy trade now", "dm for call",
  "join now", "act fast", "limited time",
]

const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000
const DEFAULT_DUPLICATE_WINDOW = 20 * 60 * 1000 // 20 min

export class TrendScorer {
  private config: Required<TrendScorerConfig>
  private fingerprints = new Map<string, number>() // fingerprint → timestamp
  private topicMentions = new Map<string, { count: number; sources: Set<string> }>()

  constructor(config: TrendScorerConfig) {
    this.config = {
      brandKeywords: config.brandKeywords,
      duplicateWindowMs: config.duplicateWindowMs ?? DEFAULT_DUPLICATE_WINDOW,
      maxContentAgeMs: config.maxContentAgeMs ?? 48 * 60 * 60 * 1000,
    }
  }

  score(item: TrendItem): ScoredTrend {
    const now = Date.now()
    const publishedMs = new Date(item.publishedAt).getTime()
    const ageMs = now - publishedMs

    // Deduplication
    const fingerprint = this.contentFingerprint(item.title, item.description)
    const lastSeen = this.fingerprints.get(fingerprint)
    if (lastSeen && now - lastSeen < this.config.duplicateWindowMs) {
      return this.toScoredTrend(item, 0, "stable", 0, [])
    }
    this.fingerprints.set(fingerprint, now)

    // Track topic mentions for velocity
    const topicKey = this.extractTopicKey(item.title)
    const mentions = this.topicMentions.get(topicKey) ?? { count: 0, sources: new Set() }
    mentions.count++
    mentions.sources.add(item.source)
    this.topicMentions.set(topicKey, mentions)

    // Scoring factors
    const recencyScore = Math.max(0, 1 - ageMs / TWENTY_FOUR_HOURS) * 40
    const relevanceScore = this.relevanceScore(item.title + " " + item.description) * 30
    const spamPenalty = this.spamPenalty(item.title + " " + item.description)
    const crossSourceBonus = Math.min(20, (mentions.sources.size - 1) * 10)

    const raw = recencyScore + relevanceScore + crossSourceBonus - spamPenalty
    const score = Math.max(0, Math.min(100, Math.round(raw)))

    const velocity: ScoredTrend["velocity"] =
      mentions.count >= 3 ? "rising" : mentions.count === 1 ? "stable" : "stable"

    return this.toScoredTrend(item, score, velocity, mentions.count, [...mentions.sources])
  }

  private relevanceScore(text: string): number {
    const lower = text.toLowerCase()
    let matches = 0
    for (const keyword of this.config.brandKeywords) {
      if (lower.includes(keyword.toLowerCase())) matches++
    }
    return Math.min(1, matches / Math.max(1, this.config.brandKeywords.length))
  }

  private spamPenalty(text: string): number {
    const lower = text.toLowerCase()
    let penalty = 0

    // Spam keywords
    for (const kw of SPAM_KEYWORDS) {
      if (lower.includes(kw)) penalty += 15
    }

    // Excessive emoji/caps
    const capsRatio = (text.match(/[A-Z]/g)?.length ?? 0) / Math.max(1, text.length)
    if (capsRatio > 0.7 && text.length > 20) penalty += 20

    // Link-heavy
    const links = (text.match(/https?:\/\//g) ?? []).length
    if (links >= 3) penalty += 10

    return Math.min(80, penalty)
  }

  private contentFingerprint(title: string, description: string): string {
    return (title + description).toLowerCase().replace(/\s+/g, " ").trim().slice(0, 200)
  }

  private extractTopicKey(title: string): string {
    // Normalize to rough topic: lowercase, remove punctuation, take first 5 significant words
    return title.toLowerCase().replace(/[^a-z0-9\s]/g, "").split(/\s+/).slice(0, 5).join(" ")
  }

  private toScoredTrend(
    item: TrendItem, score: number, velocity: ScoredTrend["velocity"],
    mentionCount: number, sourceFeeds: string[],
  ): ScoredTrend {
    return {
      id: item.id,
      title: item.title,
      description: item.description,
      url: item.url,
      platform: item.platform,
      score,
      sentiment: "neutral", // Sentiment analysis deferred — would need LLM call
      velocity,
      firstSeen: item.publishedAt,
      lastUpdated: new Date().toISOString(),
      mentionCount,
      sourceFeeds,
      dismissed: false,
    }
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/platforms/trendScorer.test.ts`
Expected: 5 tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/services/platforms/trendScorer.ts tests/platforms/trendScorer.test.ts
git commit -m "feat: add trend scoring pipeline with spam detection and deduplication"
```

---

## Phase 2: Core Features — Backend Handlers

### Task 9: Campaign CRUD Handlers

**Files:**
- Modify: `src/handlers/data.ts` — add `campaigns` data handler
- Modify: `src/handlers/actions.ts` — add campaign CRUD actions
- Create: `tests/handlers/campaigns.test.ts`

- [ ] **Step 1: Write failing tests**

Create `tests/handlers/campaigns.test.ts`:

```typescript
import { describe, it, expect, vi } from "vitest"
import { handleCampaignAction } from "../../src/handlers/actions.js"

// Mock plugin context
function mockCtx(state: Record<string, unknown> = {}) {
  const store = new Map(Object.entries(state))
  return {
    state: {
      get: vi.fn((key: string) => Promise.resolve(store.get(key) ?? null)),
      set: vi.fn((key: string, val: unknown) => { store.set(key, val); return Promise.resolve() }),
    },
    company: { id: "comp-1" },
  }
}

describe("Campaign Handlers", () => {
  it("creates a campaign", async () => {
    const ctx = mockCtx({ "campaigns:list": [] })
    const result = await handleCampaignAction(ctx as any, {
      action: "create",
      name: "Q2 Launch",
      targetPlatforms: ["twitter", "reddit"],
      dateRange: { start: "2026-04-01", end: "2026-04-30" },
    })
    expect(result.id).toBeDefined()
    expect(result.name).toBe("Q2 Launch")
    expect(result.status).toBe("draft")
  })

  it("updates a campaign", async () => {
    const existing = [{
      id: "camp-1", name: "Old", description: "", targetPlatforms: [],
      dateRange: { start: "", end: "" }, status: "draft", createdAt: "", updatedAt: "",
    }]
    const ctx = mockCtx({ "campaigns:list": existing })
    const result = await handleCampaignAction(ctx as any, {
      action: "update",
      campaignId: "camp-1",
      name: "New Name",
      status: "active",
    })
    expect(result.name).toBe("New Name")
    expect(result.status).toBe("active")
  })

  it("deletes a campaign and unlinks cards", async () => {
    const campaigns = [{ id: "camp-1", name: "Test", targetPlatforms: [], dateRange: { start: "", end: "" }, status: "active", createdAt: "", updatedAt: "" }]
    const cards = [
      { id: "card-1", campaignId: "camp-1" },
      { id: "card-2", campaignId: null },
    ]
    const ctx = mockCtx({ "campaigns:list": campaigns, "pipeline:cards": cards })
    await handleCampaignAction(ctx as any, { action: "delete", campaignId: "camp-1" })

    const updatedCampaigns = await ctx.state.get("campaigns:list")
    expect(updatedCampaigns).toEqual([])

    const updatedCards = await ctx.state.get("pipeline:cards")
    expect((updatedCards as any[])[0].campaignId).toBeNull()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/handlers/campaigns.test.ts`
Expected: FAIL

- [ ] **Step 3: Add campaign handlers to actions.ts**

In `src/handlers/actions.ts`, add the exported handler function and register it:

```typescript
import { v4 as uuid } from "uuid" // or use crypto.randomUUID()
import type { Campaign } from "../ui/pages/marketing/types.js"
import { STATE_CAMPAIGNS } from "../constants.js"

export async function handleCampaignAction(
  ctx: any,
  params: Record<string, unknown>,
): Promise<Campaign> {
  const action = params.action as string
  const campaigns: Campaign[] = (await ctx.state.get(STATE_CAMPAIGNS)) ?? []

  if (action === "create") {
    const campaign: Campaign = {
      id: crypto.randomUUID(),
      name: params.name as string,
      description: (params.description as string) ?? "",
      targetPlatforms: (params.targetPlatforms as string[]) ?? [],
      dateRange: params.dateRange as { start: string; end: string },
      status: "draft",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    campaigns.push(campaign)
    await ctx.state.set(STATE_CAMPAIGNS, campaigns)
    return campaign
  }

  if (action === "update") {
    const idx = campaigns.findIndex((c) => c.id === params.campaignId)
    if (idx === -1) throw new Error(`Campaign ${params.campaignId} not found`)
    const campaign = campaigns[idx]
    if (params.name !== undefined) campaign.name = params.name as string
    if (params.description !== undefined) campaign.description = params.description as string
    if (params.targetPlatforms !== undefined) campaign.targetPlatforms = params.targetPlatforms as string[]
    if (params.dateRange !== undefined) campaign.dateRange = params.dateRange as { start: string; end: string }
    if (params.status !== undefined) campaign.status = params.status as Campaign["status"]
    campaign.updatedAt = new Date().toISOString()
    await ctx.state.set(STATE_CAMPAIGNS, campaigns)
    return campaign
  }

  if (action === "delete") {
    const filtered = campaigns.filter((c) => c.id !== params.campaignId)
    await ctx.state.set(STATE_CAMPAIGNS, filtered)

    // Unlink cards
    const cards: any[] = (await ctx.state.get("pipeline:cards")) ?? []
    for (const card of cards) {
      if (card.campaignId === params.campaignId) card.campaignId = null
    }
    await ctx.state.set("pipeline:cards", cards)

    return { id: params.campaignId } as Campaign
  }

  throw new Error(`Unknown campaign action: ${action}`)
}

// Register in the existing registration block:
// registerActionHandler("create-campaign", async (ctx, params) => handleCampaignAction(ctx, { ...params, action: "create" }))
// registerActionHandler("update-campaign", async (ctx, params) => handleCampaignAction(ctx, { ...params, action: "update" }))
// registerActionHandler("delete-campaign", async (ctx, params) => handleCampaignAction(ctx, { ...params, action: "delete" }))
```

Add the `campaigns` data handler in `src/handlers/data.ts`:

```typescript
// Register in data handlers:
// registerDataHandler("campaigns", async (ctx) => {
//   return (await ctx.state.get(STATE_CAMPAIGNS)) ?? []
// })
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/handlers/campaigns.test.ts`
Expected: 3 tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/handlers/actions.ts src/handlers/data.ts tests/handlers/campaigns.test.ts
git commit -m "feat: add campaign CRUD handlers"
```

---

### Task 10: Scheduling Handlers & Job Enhancement

**Files:**
- Modify: `src/handlers/actions.ts` — add `schedule-content` action
- Modify: `src/jobs/queue-process.ts` — add scheduled publishing check
- Create: `tests/handlers/scheduling.test.ts`

- [ ] **Step 1: Write failing tests**

Create `tests/handlers/scheduling.test.ts`:

```typescript
import { describe, it, expect, vi } from "vitest"
import { handleScheduleAction } from "../../src/handlers/actions.js"

function mockCtx(cards: any[] = []) {
  const store = new Map<string, unknown>([["pipeline:cards", cards]])
  return {
    state: {
      get: vi.fn((key: string) => Promise.resolve(store.get(key))),
      set: vi.fn((key: string, val: unknown) => { store.set(key, val); return Promise.resolve() }),
    },
  }
}

describe("Scheduling Handlers", () => {
  it("schedules an approved card", async () => {
    const cards = [{ id: "card-1", status: "approved", scheduledAt: null, scheduledStatus: null }]
    const ctx = mockCtx(cards)
    const result = await handleScheduleAction(ctx as any, {
      action: "schedule",
      cardId: "card-1",
      scheduledAt: "2026-04-01T10:00:00Z",
    })
    expect(result.scheduledAt).toBe("2026-04-01T10:00:00Z")
    expect(result.scheduledStatus).toBe("pending")
  })

  it("rejects scheduling a draft card", async () => {
    const cards = [{ id: "card-1", status: "draft", scheduledAt: null, scheduledStatus: null }]
    const ctx = mockCtx(cards)
    await expect(
      handleScheduleAction(ctx as any, { action: "schedule", cardId: "card-1", scheduledAt: "2026-04-01T10:00:00Z" })
    ).rejects.toThrow("cannot_schedule_draft")
  })

  it("unschedules a card", async () => {
    const cards = [{
      id: "card-1", status: "approved",
      scheduledAt: "2026-04-01T10:00:00Z", scheduledStatus: "pending",
    }]
    const ctx = mockCtx(cards)
    const result = await handleScheduleAction(ctx as any, { action: "unschedule", cardId: "card-1" })
    expect(result.scheduledAt).toBeNull()
    expect(result.scheduledStatus).toBeNull()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/handlers/scheduling.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement schedule handler**

Add to `src/handlers/actions.ts`:

```typescript
export async function handleScheduleAction(
  ctx: any,
  params: Record<string, unknown>,
): Promise<any> {
  const cards: any[] = (await ctx.state.get("pipeline:cards")) ?? []
  const card = cards.find((c) => c.id === params.cardId)
  if (!card) throw new Error(`Card ${params.cardId} not found`)

  const action = params.action as string

  if (action === "schedule") {
    if (card.status !== "approved") {
      throw Object.assign(new Error("cannot_schedule_draft"), {
        hint: "Move card to approved status first",
      })
    }
    card.scheduledAt = params.scheduledAt as string
    card.scheduledStatus = "pending"
  } else if (action === "unschedule") {
    card.scheduledAt = null
    card.scheduledStatus = null
  } else if (action === "reschedule") {
    card.scheduledAt = params.scheduledAt as string
    card.scheduledStatus = "pending"
  }

  card.updatedAt = new Date().toISOString()
  await ctx.state.set("pipeline:cards", cards)
  return card
}
```

- [ ] **Step 4: Enhance queue-process job with scheduled publishing**

In `src/jobs/queue-process.ts`, add to the existing job handler:

```typescript
// Add to existing queue-process job body:
async function processScheduledCards(ctx: any, platformManager: PlatformManager) {
  const cards: any[] = (await ctx.state.get("pipeline:cards")) ?? []
  const now = new Date().toISOString()

  for (const card of cards) {
    if (card.status !== "approved" || !card.scheduledAt || card.scheduledStatus !== "pending") continue
    if (card.scheduledAt > now) continue

    card.scheduledStatus = "publishing"
    await ctx.state.set("pipeline:cards", cards)

    const result = await platformManager.publish({
      caption: card.caption,
      platform: card.platform,
      mediaRef: card.mediaRef,
      mediaType: card.mediaType,
    })

    if (result.success) {
      card.status = "published"
      card.scheduledStatus = null
      card.platformPostRef = {
        platform: card.platform,
        postId: result.platformPostId,
        url: result.platformUrl,
        publishedAt: new Date().toISOString(),
      }
    } else {
      card.scheduledStatus = "failed"
      card.publishError = result.error ?? "Unknown error"
      card.publishAttempts = (card.publishAttempts ?? 0) + 1
    }

    card.updatedAt = new Date().toISOString()
    await ctx.state.set("pipeline:cards", cards)
  }
}
```

- [ ] **Step 5: Run tests**

Run: `npx vitest run tests/handlers/scheduling.test.ts`
Expected: 3 tests PASS

- [ ] **Step 6: Commit**

```bash
git add src/handlers/actions.ts src/jobs/queue-process.ts tests/handlers/scheduling.test.ts
git commit -m "feat: add content scheduling handlers and scheduled publish job"
```

---

### Task 11: Template CRUD Handlers

**Files:**
- Modify: `src/handlers/data.ts` — add `templates` data handler
- Modify: `src/handlers/actions.ts` — add template CRUD + apply actions
- Create: `tests/handlers/templates.test.ts`

- [ ] **Step 1: Write failing tests**

Create `tests/handlers/templates.test.ts`:

```typescript
import { describe, it, expect, vi } from "vitest"
import { handleTemplateAction, applyTemplate } from "../../src/handlers/actions.js"

function mockCtx(state: Record<string, unknown> = {}) {
  const store = new Map(Object.entries(state))
  return {
    state: {
      get: vi.fn((key: string) => Promise.resolve(store.get(key) ?? null)),
      set: vi.fn((key: string, val: unknown) => { store.set(key, val); return Promise.resolve() }),
    },
  }
}

describe("Template Handlers", () => {
  it("creates a template", async () => {
    const ctx = mockCtx({ "templates:list": [] })
    const result = await handleTemplateAction(ctx as any, {
      action: "create",
      name: "DeFi Thread",
      platform: "twitter",
      captionTemplate: "🔥 {{topic}} is changing the game for {{audience}}",
      variables: [
        { key: "topic", label: "Topic", type: "text" },
        { key: "audience", label: "Audience", type: "text", defaultValue: "DeFi users" },
      ],
      toolChain: ["generate-caption", "generate-media"],
    })
    expect(result.id).toBeDefined()
    expect(result.name).toBe("DeFi Thread")
    expect(result.useCount).toBe(0)
  })

  it("applies a template with variable substitution", () => {
    const template = {
      captionTemplate: "🔥 {{topic}} is changing the game for {{audience}}",
      variables: [
        { key: "topic", label: "Topic", type: "text" },
        { key: "audience", label: "Audience", type: "text" },
      ],
    }
    const result = applyTemplate(template as any, { topic: "ETH staking", audience: "DeFi degens" })
    expect(result).toBe("🔥 ETH staking is changing the game for DeFi degens")
  })
})
```

- [ ] **Step 2: Run test, verify fail, implement, verify pass**

Add to `src/handlers/actions.ts`:

```typescript
import type { ContentTemplate } from "../ui/pages/marketing/types.js"
import { STATE_TEMPLATES } from "../constants.js"

export async function handleTemplateAction(ctx: any, params: Record<string, unknown>): Promise<ContentTemplate> {
  const templates: ContentTemplate[] = (await ctx.state.get(STATE_TEMPLATES)) ?? []
  const action = params.action as string

  if (action === "create") {
    const template: ContentTemplate = {
      id: crypto.randomUUID(),
      name: params.name as string,
      description: (params.description as string) ?? "",
      platform: params.platform as any,
      variables: (params.variables as any[]) ?? [],
      captionTemplate: params.captionTemplate as string,
      tone: params.tone as string | undefined,
      mediaPrompt: params.mediaPrompt as string | undefined,
      toolChain: params.toolChain as string[] | undefined,
      createdFrom: params.createdFrom as string | undefined,
      useCount: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    templates.push(template)
    await ctx.state.set(STATE_TEMPLATES, templates)
    return template
  }

  if (action === "delete") {
    const filtered = templates.filter((t) => t.id !== params.templateId)
    await ctx.state.set(STATE_TEMPLATES, filtered)
    return { id: params.templateId } as ContentTemplate
  }

  throw new Error(`Unknown template action: ${action}`)
}

export function applyTemplate(template: ContentTemplate, variables: Record<string, string>): string {
  let result = template.captionTemplate
  for (const v of template.variables) {
    const value = variables[v.key] ?? v.defaultValue ?? ""
    result = result.replace(new RegExp(`\\{\\{${v.key}\\}\\}`, "g"), value)
  }
  return result
}
```

- [ ] **Step 3: Run tests, commit**

Run: `npx vitest run tests/handlers/templates.test.ts`

```bash
git add src/handlers/actions.ts src/handlers/data.ts tests/handlers/templates.test.ts
git commit -m "feat: add content template CRUD and apply handlers"
```

---

### Task 12: Variant Group Handlers

**Files:**
- Modify: `src/handlers/actions.ts` — add variant CRUD actions
- Modify: `src/handlers/data.ts` — add `variants` data handler
- Create: `tests/handlers/variants.test.ts`

- [ ] **Step 1: Write failing tests**

Create `tests/handlers/variants.test.ts`:

```typescript
import { describe, it, expect, vi } from "vitest"
import { handleVariantAction } from "../../src/handlers/actions.js"

function mockCtx(state: Record<string, unknown> = {}) {
  const store = new Map(Object.entries(state))
  return {
    state: {
      get: vi.fn((key: string) => Promise.resolve(store.get(key) ?? null)),
      set: vi.fn((key: string, val: unknown) => { store.set(key, val); return Promise.resolve() }),
    },
  }
}

describe("Variant Handlers", () => {
  it("creates a variant group from source card", async () => {
    const cards = [
      { id: "card-1", topic: "DeFi trends", status: "draft", variantGroupId: null, variantLabel: null },
    ]
    const ctx = mockCtx({ "pipeline:cards": cards, "variants:groups": [] })

    const result = await handleVariantAction(ctx as any, {
      action: "create-variant",
      sourceCardId: "card-1",
      newCardData: { caption: "Variant B caption", tone: "serious" },
    })

    expect(result.group.variantCardIds).toHaveLength(2) // original + new
    expect(result.newCard.variantLabel).toBe("B")
  })

  it("picks a winner", async () => {
    const groups = [{ id: "vg-1", sourceCardId: "c1", topic: "test", variantCardIds: ["c1", "c2"], createdAt: "" }]
    const ctx = mockCtx({ "variants:groups": groups })

    const result = await handleVariantAction(ctx as any, {
      action: "pick-winner",
      variantGroupId: "vg-1",
      winnerCardId: "c2",
    })

    expect(result.group.winnerCardId).toBe("c2")
  })

  it("limits variants to 3 per group", async () => {
    const cards = [
      { id: "c1", variantGroupId: "vg-1", variantLabel: "A" },
      { id: "c2", variantGroupId: "vg-1", variantLabel: "B" },
      { id: "c3", variantGroupId: "vg-1", variantLabel: "C" },
    ]
    const groups = [{ id: "vg-1", sourceCardId: "c1", topic: "test", variantCardIds: ["c1", "c2", "c3"], createdAt: "" }]
    const ctx = mockCtx({ "pipeline:cards": cards, "variants:groups": groups })

    await expect(
      handleVariantAction(ctx as any, { action: "create-variant", sourceCardId: "c1", newCardData: {} })
    ).rejects.toThrow("maximum")
  })
})
```

- [ ] **Step 2: Run test, verify fail, implement, verify pass**

Add to `src/handlers/actions.ts`:

```typescript
import type { VariantGroup } from "../ui/pages/marketing/types.js"
import { STATE_VARIANT_GROUPS } from "../constants.js"

export async function handleVariantAction(ctx: any, params: Record<string, unknown>): Promise<any> {
  const groups: VariantGroup[] = (await ctx.state.get(STATE_VARIANT_GROUPS)) ?? []
  const cards: any[] = (await ctx.state.get("pipeline:cards")) ?? []
  const action = params.action as string

  if (action === "create-variant") {
    const sourceId = params.sourceCardId as string
    const sourceCard = cards.find((c) => c.id === sourceId)
    if (!sourceCard) throw new Error(`Source card ${sourceId} not found`)

    // Find or create group
    let group = groups.find((g) => g.variantCardIds.includes(sourceId))
    if (!group) {
      group = {
        id: crypto.randomUUID(),
        sourceCardId: sourceId,
        topic: sourceCard.topic,
        variantCardIds: [sourceId],
        createdAt: new Date().toISOString(),
      }
      groups.push(group)
      sourceCard.variantGroupId = group.id
      sourceCard.variantLabel = "A"
    }

    if (group.variantCardIds.length >= 3) {
      throw new Error("maximum 3 variants per group")
    }

    // Create new variant card
    const labels = ["A", "B", "C"]
    const newCard = {
      ...sourceCard,
      ...(params.newCardData as Record<string, unknown>),
      id: crypto.randomUUID(),
      variantGroupId: group.id,
      variantLabel: labels[group.variantCardIds.length],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }

    cards.push(newCard)
    group.variantCardIds.push(newCard.id)

    await ctx.state.set("pipeline:cards", cards)
    await ctx.state.set(STATE_VARIANT_GROUPS, groups)
    return { group, newCard }
  }

  if (action === "pick-winner") {
    const group = groups.find((g) => g.id === params.variantGroupId)
    if (!group) throw new Error(`Variant group ${params.variantGroupId} not found`)
    group.winnerCardId = params.winnerCardId as string
    await ctx.state.set(STATE_VARIANT_GROUPS, groups)
    return { group }
  }

  if (action === "compare") {
    const group = groups.find((g) => g.id === params.variantGroupId)
    if (!group) throw new Error(`Variant group ${params.variantGroupId} not found`)
    const variantCards = cards.filter((c) => group.variantCardIds.includes(c.id))
    return { group, cards: variantCards }
  }

  throw new Error(`Unknown variant action: ${action}`)
}
```

- [ ] **Step 3: Run tests, commit**

Run: `npx vitest run tests/handlers/variants.test.ts`

```bash
git add src/handlers/actions.ts src/handlers/data.ts tests/handlers/variants.test.ts
git commit -m "feat: add A/B variant group handlers"
```

---

### Task 13: Bulk Operations Handler

**Files:**
- Modify: `src/handlers/actions.ts` — add `bulk-operation` action
- Create: `tests/handlers/bulkOps.test.ts`

- [ ] **Step 1: Write failing tests**

Create `tests/handlers/bulkOps.test.ts`:

```typescript
import { describe, it, expect, vi } from "vitest"
import { handleBulkOperation } from "../../src/handlers/actions.js"

function mockCtx(cards: any[] = []) {
  const store = new Map<string, unknown>([["pipeline:cards", cards]])
  return {
    state: {
      get: vi.fn((key: string) => Promise.resolve(store.get(key))),
      set: vi.fn((key: string, val: unknown) => { store.set(key, val); return Promise.resolve() }),
    },
  }
}

describe("Bulk Operations", () => {
  it("approves multiple review cards", async () => {
    const cards = [
      { id: "c1", status: "review" },
      { id: "c2", status: "review" },
      { id: "c3", status: "draft" },
    ]
    const ctx = mockCtx(cards)
    const result = await handleBulkOperation(ctx as any, {
      action: "approve",
      cardIds: ["c1", "c2", "c3"],
    })
    expect(result.succeeded).toBe(2)
    expect(result.skipped).toBe(1) // c3 is draft, can't approve
    expect(result.total).toBe(3)
  })

  it("moves cards to target status", async () => {
    const cards = [
      { id: "c1", status: "draft" },
      { id: "c2", status: "draft" },
    ]
    const ctx = mockCtx(cards)
    const result = await handleBulkOperation(ctx as any, {
      action: "move",
      cardIds: ["c1", "c2"],
      targetStatus: "review",
    })
    expect(result.succeeded).toBe(2)
  })

  it("assigns campaign to multiple cards", async () => {
    const cards = [
      { id: "c1", campaignId: null },
      { id: "c2", campaignId: "old" },
    ]
    const ctx = mockCtx(cards)
    const result = await handleBulkOperation(ctx as any, {
      action: "assign-campaign",
      cardIds: ["c1", "c2"],
      campaignId: "camp-1",
    })
    expect(result.succeeded).toBe(2)
    const updated = await ctx.state.get("pipeline:cards")
    expect((updated as any[])[0].campaignId).toBe("camp-1")
  })
})
```

- [ ] **Step 2: Run test, verify fail, implement, verify pass**

Add to `src/handlers/actions.ts`:

```typescript
import type { BulkResult, ContentStatus } from "../ui/pages/marketing/types.js"

const VALID_TRANSITIONS: Record<string, string[]> = {
  draft: ["review"],
  review: ["draft", "approved"],
  approved: ["published"],
  published: [],
}

export async function handleBulkOperation(ctx: any, params: Record<string, unknown>): Promise<BulkResult> {
  const cards: any[] = (await ctx.state.get("pipeline:cards")) ?? []
  const cardIds = params.cardIds as string[]
  const action = params.action as string
  const result: BulkResult = { total: cardIds.length, succeeded: 0, failed: 0, skipped: 0, details: [] }

  for (const cardId of cardIds) {
    const card = cards.find((c) => c.id === cardId)
    if (!card) {
      result.failed++
      result.details.push({ cardId, status: "failed", reason: "Card not found" })
      continue
    }

    try {
      if (action === "approve") {
        if (card.status !== "review") {
          result.skipped++
          result.details.push({ cardId, status: "skipped", reason: `Cannot approve from ${card.status}` })
          continue
        }
        card.status = "approved"
      } else if (action === "reject") {
        if (card.status !== "review") {
          result.skipped++
          result.details.push({ cardId, status: "skipped", reason: `Cannot reject from ${card.status}` })
          continue
        }
        card.status = "draft"
      } else if (action === "move") {
        const target = params.targetStatus as string
        if (!VALID_TRANSITIONS[card.status]?.includes(target)) {
          result.skipped++
          result.details.push({ cardId, status: "skipped", reason: `Invalid transition ${card.status}→${target}` })
          continue
        }
        card.status = target
      } else if (action === "assign-campaign") {
        card.campaignId = params.campaignId ?? null
      }

      card.updatedAt = new Date().toISOString()
      result.succeeded++
      result.details.push({ cardId, status: "ok" })
    } catch (err) {
      result.failed++
      result.details.push({ cardId, status: "failed", reason: String(err) })
    }
  }

  await ctx.state.set("pipeline:cards", cards)
  return result
}
```

- [ ] **Step 3: Run tests, commit**

Run: `npx vitest run tests/handlers/bulkOps.test.ts`

```bash
git add src/handlers/actions.ts tests/handlers/bulkOps.test.ts
git commit -m "feat: add bulk operations handler"
```

---

### Task 14: Wire All New Handlers into Worker

**Files:**
- Modify: `src/handlers/data.ts` — register all new data handlers
- Modify: `src/handlers/actions.ts` — register all new action handlers
- Modify: `src/worker.ts` — initialize platformManager, pass to jobs

- [ ] **Step 1: Register all data handlers**

Add to the registration block in `src/handlers/data.ts`:

```typescript
registerDataHandler(DATA_KEY_CAMPAIGNS, async (ctx) => {
  return (await ctx.state.get(STATE_CAMPAIGNS)) ?? []
})

registerDataHandler(DATA_KEY_TEMPLATES, async (ctx) => {
  return (await ctx.state.get(STATE_TEMPLATES)) ?? []
})

registerDataHandler(DATA_KEY_VARIANTS, async (ctx) => {
  return (await ctx.state.get(STATE_VARIANT_GROUPS)) ?? []
})

registerDataHandler(DATA_KEY_ANALYTICS, async (ctx, params) => {
  // Aggregation logic — reads pipeline cards + engagement history
  const cards: any[] = (await ctx.state.get("pipeline:cards")) ?? []
  const dateRange = params?.dateRange as { start: string; end: string } | undefined
  const campaignId = params?.campaignId as string | undefined
  const groupBy = (params?.groupBy as string) ?? "day"

  let filtered = cards
  if (campaignId) filtered = filtered.filter((c) => c.campaignId === campaignId)
  if (dateRange) {
    filtered = filtered.filter((c) => c.createdAt >= dateRange.start && c.createdAt <= dateRange.end)
  }

  // Aggregate engagement by groupBy dimension
  const aggregated: Record<string, any> = {}
  for (const card of filtered) {
    if (card.status !== "published") continue
    const key = groupBy === "platform" ? card.platform
      : groupBy === "source" ? card.source
      : groupBy === "mediaType" ? (card.mediaType ?? "text")
      : card.createdAt?.slice(0, 10) ?? "unknown"

    if (!aggregated[key]) aggregated[key] = { likes: 0, comments: 0, shares: 0, impressions: 0, count: 0 }
    const engagement = card.latestEngagement ?? {}
    aggregated[key].likes += engagement.likes ?? 0
    aggregated[key].comments += engagement.comments ?? 0
    aggregated[key].shares += engagement.shares ?? 0
    aggregated[key].impressions += engagement.impressions ?? 0
    aggregated[key].count++
  }

  return { groupBy, data: aggregated, totalCards: filtered.length }
})
```

- [ ] **Step 2: Register all action handlers**

Add to `src/handlers/actions.ts` registration block:

```typescript
registerActionHandler(ACTION_CREATE_CAMPAIGN, async (ctx, params) =>
  handleCampaignAction(ctx, { ...params, action: "create" }))
registerActionHandler(ACTION_UPDATE_CAMPAIGN, async (ctx, params) =>
  handleCampaignAction(ctx, { ...params, action: "update" }))
registerActionHandler(ACTION_DELETE_CAMPAIGN, async (ctx, params) =>
  handleCampaignAction(ctx, { ...params, action: "delete" }))
registerActionHandler(ACTION_SCHEDULE_CONTENT, async (ctx, params) =>
  handleScheduleAction(ctx, params))
registerActionHandler(ACTION_CREATE_TEMPLATE, async (ctx, params) =>
  handleTemplateAction(ctx, { ...params, action: "create" }))
registerActionHandler(ACTION_UPDATE_TEMPLATE, async (ctx, params) =>
  handleTemplateAction(ctx, { ...params, action: "update" }))
registerActionHandler(ACTION_DELETE_TEMPLATE, async (ctx, params) =>
  handleTemplateAction(ctx, { ...params, action: "delete" }))
registerActionHandler(ACTION_APPLY_TEMPLATE, async (ctx, params) => {
  const templates: ContentTemplate[] = (await ctx.state.get(STATE_TEMPLATES)) ?? []
  const template = templates.find((t) => t.id === params.templateId)
  if (!template) throw new Error(`Template ${params.templateId} not found`)
  template.useCount++
  await ctx.state.set(STATE_TEMPLATES, templates)
  return { resolved: applyTemplate(template, params.variables as Record<string, string>) }
})
registerActionHandler(ACTION_CREATE_VARIANT, async (ctx, params) =>
  handleVariantAction(ctx, { ...params, action: "create-variant" }))
registerActionHandler(ACTION_PICK_WINNER, async (ctx, params) =>
  handleVariantAction(ctx, { ...params, action: "pick-winner" }))
registerActionHandler(ACTION_BULK_OPERATION, async (ctx, params) =>
  handleBulkOperation(ctx, params))
registerActionHandler(ACTION_SAVE_PLATFORM_CONFIG, async (ctx, params) => {
  await ctx.state.set("platform:config", params)
  return { saved: true }
})
registerActionHandler(ACTION_TEST_PLATFORM_CONNECTION, async (ctx, params) => {
  // Delegates to platformManager.healthAll() — wired in worker.ts
  return { status: "not_implemented_yet" }
})
```

- [ ] **Step 3: Initialize platformManager in worker.ts**

Add to `src/worker.ts` initialization:

```typescript
import { PlatformManager } from "./services/platforms/platformManager.js"
import { TwitterAdapter } from "./services/platforms/twitterAdapter.js"
import { RedditAdapter } from "./services/platforms/redditAdapter.js"
import { TelegramAdapter } from "./services/platforms/telegramAdapter.js"
import { RssAppAdapter } from "./services/platforms/rssAppAdapter.js"

// In the worker init function:
const platformManager = new PlatformManager()

// Resolve secrets and register adapters
try {
  const twitterKey = await ctx.secrets.resolve("TWEETAPI_API_KEY").catch(() => "")
  if (twitterKey) platformManager.register(new TwitterAdapter(twitterKey))

  const redditToken = await ctx.secrets.resolve("REDDIT_REFRESH_TOKEN").catch(() => "")
  platformManager.register(new RedditAdapter(redditToken || undefined))

  const tgToken = await ctx.secrets.resolve("TELEGRAM_BOT_TOKEN").catch(() => "")
  const tgChannels = await ctx.secrets.resolve("TELEGRAM_CHANNEL_IDS").catch(() => "")
  if (tgToken) platformManager.register(new TelegramAdapter(tgToken, tgChannels.split(",").filter(Boolean)))
} catch {
  // Adapters not configured — graceful degradation
}

// Pass platformManager to jobs that need it
```

- [ ] **Step 4: Commit**

```bash
git add src/handlers/data.ts src/handlers/actions.ts src/worker.ts
git commit -m "feat: wire all V2 handlers and initialize platform manager"
```

---

## Phase 3: Core Features — UI Components

### Task 15: Install UI Dependencies

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install packages**

```bash
cd /home/winadmin/projects/BrandAmbassador
npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities chart.js react-chartjs-2
```

- [ ] **Step 2: Commit**

```bash
git add package.json package-lock.json
git commit -m "deps: add @dnd-kit, chart.js, react-chartjs-2"
```

---

### Task 16: Drag-and-Drop Kanban

**Files:**
- Create: `ui/pages/marketing/DnDPipeline.tsx`
- Modify: `ui/pages/marketing/Pipeline.tsx` — integrate DnD wrapper
- Modify: `ui/pages/marketing/styles.ts` — add DnD-specific styles

- [ ] **Step 1: Create DnDPipeline component**

Create `ui/pages/marketing/DnDPipeline.tsx` — this wraps the existing Pipeline column/card rendering with `@dnd-kit` sortable containers:

```tsx
import React, { useState } from "react"
import {
  DndContext,
  DragOverlay,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
} from "@dnd-kit/core"
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable"
import { usePluginAction, usePluginToast } from "@paperclipai/plugin-sdk/ui"
import type { ContentCard, ContentStatus } from "./types"
import { STATUS_COLORS } from "./styles"

const VALID_TRANSITIONS: Record<ContentStatus, ContentStatus[]> = {
  draft: ["review"],
  review: ["draft", "approved"],
  approved: ["published"],
  published: [],
}

interface DnDPipelineProps {
  cards: ContentCard[]
  columns: ContentStatus[]
  onCardClick: (card: ContentCard) => void
  onRefresh: () => void
}

export function DnDPipeline({ cards, columns, onCardClick, onRefresh }: DnDPipelineProps) {
  const [activeCard, setActiveCard] = useState<ContentCard | null>(null)
  const updateStatus = usePluginAction("update-card-status")
  const toast = usePluginToast()

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor),
  )

  function handleDragStart(event: DragStartEvent) {
    const card = cards.find((c) => c.id === event.active.id)
    setActiveCard(card ?? null)
  }

  async function handleDragEnd(event: DragEndEvent) {
    setActiveCard(null)
    const { active, over } = event
    if (!over) return

    const card = cards.find((c) => c.id === active.id)
    if (!card) return

    const targetStatus = over.id as ContentStatus
    if (card.status === targetStatus) return

    if (!VALID_TRANSITIONS[card.status].includes(targetStatus)) {
      toast({ type: "warning", message: `Cannot move from ${card.status} to ${targetStatus}` })
      return
    }

    try {
      await updateStatus({ cardId: card.id, newStatus: targetStatus })
      toast({ type: "success", message: `Card moved to ${targetStatus}` })
      onRefresh()
    } catch (err) {
      toast({ type: "error", message: `Failed: ${err}` })
    }
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCorners}
      onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div style={{ display: "flex", gap: 16, overflowX: "auto", flex: 1 }}>
        {columns.map((status) => {
          const columnCards = cards.filter((c) => c.status === status)
          return (
            <DroppableColumn key={status} id={status} title={status} count={columnCards.length}>
              <SortableContext items={columnCards.map((c) => c.id)} strategy={verticalListSortingStrategy}>
                {columnCards.map((card) => (
                  <DraggableCard key={card.id} card={card} onClick={() => onCardClick(card)} />
                ))}
              </SortableContext>
            </DroppableColumn>
          )
        })}
      </div>
      <DragOverlay>
        {activeCard ? <CardPreview card={activeCard} /> : null}
      </DragOverlay>
    </DndContext>
  )
}

// DroppableColumn, DraggableCard, and CardPreview are extracted
// sub-components using @dnd-kit/sortable's useSortable and useDroppable hooks.
// Implementation follows the same card rendering as the existing Pipeline.tsx
// but wrapped in sortable/droppable containers.
```

Note: The full sub-component implementations (`DroppableColumn`, `DraggableCard`, `CardPreview`) should replicate the existing card rendering from `Pipeline.tsx` lines 45-85, wrapped in `@dnd-kit` primitives (`useDroppable` for columns, `useSortable` for cards). Extract the card rendering into `CardPreview` and reuse it in both the regular list and the `DragOverlay`.

- [ ] **Step 2: Integrate into Pipeline.tsx**

Modify `ui/pages/marketing/Pipeline.tsx` to import and use `DnDPipeline`:

```tsx
// Replace the existing static column rendering with:
import { DnDPipeline } from "./DnDPipeline"

// In the Pipeline component return:
<DnDPipeline
  cards={filteredCards}
  columns={["draft", "review", "approved", "published"]}
  onCardClick={onSelectCard}
  onRefresh={refresh}
/>
```

- [ ] **Step 3: Add DnD styles to styles.ts**

Add to `ui/pages/marketing/styles.ts`:

```typescript
export const dropTargetActiveStyle: React.CSSProperties = {
  backgroundColor: "rgba(124, 138, 255, 0.1)",
  borderColor: "#7c8aff",
  borderStyle: "dashed",
}

export const draggingCardStyle: React.CSSProperties = {
  opacity: 0.5,
  transform: "rotate(3deg)",
  boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
}
```

- [ ] **Step 4: Commit**

```bash
git add ui/pages/marketing/DnDPipeline.tsx ui/pages/marketing/Pipeline.tsx ui/pages/marketing/styles.ts
git commit -m "feat: add drag-and-drop kanban with @dnd-kit"
```

---

### Task 17: Campaign UI

**Files:**
- Modify: `ui/pages/marketing/Sidebar.tsx` — add Campaigns subsection
- Modify: `ui/pages/marketing/Pipeline.tsx` — add campaign filter dropdown
- Modify: `ui/pages/marketing/DetailPanel.tsx` — add campaign badge + reassignment
- Modify: `ui/pages/marketing/Create.tsx` — add campaign dropdown on post creation

- [ ] **Step 1: Add Campaigns section to Sidebar**

In `ui/pages/marketing/Sidebar.tsx`, add between the nav items and the brand footer:

```tsx
// Add state + data hook:
const { data: campaigns, refresh: refreshCampaigns } = usePluginData<Campaign[]>("campaigns")
const createCampaign = usePluginAction("create-campaign")

// Render campaigns section:
<div style={{ borderTop: "1px solid #333", padding: "12px 0" }}>
  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
    <span style={{ fontSize: 12, color: "#888", textTransform: "uppercase" }}>Campaigns</span>
    <button onClick={() => onCreateCampaign()} style={ghostButtonStyle}>+ New</button>
  </div>
  {(campaigns ?? []).filter(c => c.status === "active").map(campaign => (
    <div key={campaign.id}
      onClick={() => onSelectCampaign(campaign.id)}
      style={{ padding: "8px 12px", cursor: "pointer", borderRadius: 6,
        backgroundColor: selectedCampaignId === campaign.id ? "#1a1a2e" : "transparent" }}>
      <div style={{ fontSize: 13, color: "#e2e8f0" }}>{campaign.name}</div>
      <div style={{ fontSize: 11, color: "#666" }}>
        {campaign.dateRange.start} — {campaign.dateRange.end}
      </div>
    </div>
  ))}
</div>
```

- [ ] **Step 2: Add campaign filter to Pipeline header**

In `ui/pages/marketing/Pipeline.tsx`, add filter dropdown:

```tsx
// Props addition:
interface PipelineProps {
  selectedCampaignId: string | null
  onCampaignFilter: (id: string | null) => void
  campaigns: Campaign[]
  // ... existing props
}

// In header:
<select value={selectedCampaignId ?? "all"}
  onChange={(e) => onCampaignFilter(e.target.value === "all" ? null : e.target.value)}
  style={selectStyle}>
  <option value="all">All Campaigns</option>
  {campaigns.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
  <option value="uncategorized">Uncategorized</option>
</select>
```

Filter cards: `cards.filter(c => !selectedCampaignId || c.campaignId === selectedCampaignId || (selectedCampaignId === "uncategorized" && !c.campaignId))`

- [ ] **Step 3: Add campaign badge + reassignment to DetailPanel**

In `ui/pages/marketing/DetailPanel.tsx`:

```tsx
// Show campaign badge:
<div style={badgeStyle}>
  {card.campaignId
    ? campaigns?.find(c => c.id === card.campaignId)?.name ?? "Unknown Campaign"
    : "Uncategorized"}
</div>

// Campaign reassignment dropdown:
<select value={card.campaignId ?? ""} onChange={(e) => reassignCampaign(card.id, e.target.value || null)} style={selectStyle}>
  <option value="">Uncategorized</option>
  {(campaigns ?? []).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
</select>
```

- [ ] **Step 4: Add campaign dropdown to Create workshop**

In `ui/pages/marketing/Create.tsx`, add to the "Create Post" section:

```tsx
<select value={selectedCampaignId ?? ""} onChange={(e) => setSelectedCampaignId(e.target.value || null)} style={selectStyle}>
  <option value="">No Campaign</option>
  {(campaigns ?? []).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
</select>
```

Pass `campaignId` to the `create-pipeline-card` action params.

- [ ] **Step 5: Commit**

```bash
git add ui/pages/marketing/Sidebar.tsx ui/pages/marketing/Pipeline.tsx ui/pages/marketing/DetailPanel.tsx ui/pages/marketing/Create.tsx
git commit -m "feat: add campaign UI — sidebar, pipeline filter, detail panel, create workshop"
```

---

### Task 18: Calendar View

**Files:**
- Create: `ui/pages/marketing/Calendar.tsx`
- Modify: `ui/pages/marketing/Pipeline.tsx` — add Board|Calendar toggle
- Modify: `ui/pages/marketing/styles.ts` — add calendar styles

- [ ] **Step 1: Create Calendar component**

Create `ui/pages/marketing/Calendar.tsx` — a month-view grid showing scheduled cards:

```tsx
import React, { useState, useMemo } from "react"
import { usePluginAction, usePluginToast } from "@paperclipai/plugin-sdk/ui"
import type { ContentCard } from "./types"
import { PLATFORM_EMOJI } from "./styles"

interface CalendarProps {
  cards: ContentCard[]
  onCardClick: (card: ContentCard) => void
  onScheduleChange: (cardId: string, date: string) => void
}

export function Calendar({ cards, onCardClick, onScheduleChange }: CalendarProps) {
  const [viewDate, setViewDate] = useState(() => new Date())

  const year = viewDate.getFullYear()
  const month = viewDate.getMonth()
  const firstDay = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()

  const scheduledCards = useMemo(() => {
    return cards.filter((c) => c.scheduledAt)
  }, [cards])

  const unscheduledApproved = useMemo(() => {
    return cards.filter((c) => c.status === "approved" && !c.scheduledAt)
  }, [cards])

  function cardsForDay(day: number): ContentCard[] {
    const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`
    return scheduledCards.filter((c) => c.scheduledAt?.startsWith(dateStr))
  }

  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

  return (
    <div>
      {/* Month navigation */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <button onClick={() => setViewDate(new Date(year, month - 1))} style={{ background: "none", border: "none", color: "#7c8aff", cursor: "pointer", fontSize: 18 }}>←</button>
        <span style={{ color: "#e2e8f0", fontSize: 16, fontWeight: 600 }}>
          {viewDate.toLocaleString("default", { month: "long", year: "numeric" })}
        </span>
        <button onClick={() => setViewDate(new Date(year, month + 1))} style={{ background: "none", border: "none", color: "#7c8aff", cursor: "pointer", fontSize: 18 }}>→</button>
      </div>

      {/* Day header */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 1, marginBottom: 4 }}>
        {dayNames.map((d) => (
          <div key={d} style={{ textAlign: "center", color: "#666", fontSize: 11, padding: 4 }}>{d}</div>
        ))}
      </div>

      {/* Calendar grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 1 }}>
        {/* Empty cells before first day */}
        {Array.from({ length: firstDay }, (_, i) => (
          <div key={`empty-${i}`} style={{ minHeight: 80, backgroundColor: "#0a0a0a", borderRadius: 4 }} />
        ))}

        {/* Day cells */}
        {Array.from({ length: daysInMonth }, (_, i) => {
          const day = i + 1
          const dayCards = cardsForDay(day)
          return (
            <div key={day}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                const cardId = e.dataTransfer.getData("cardId")
                if (cardId) {
                  const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}T12:00:00Z`
                  onScheduleChange(cardId, dateStr)
                }
              }}
              style={{ minHeight: 80, backgroundColor: "#111", borderRadius: 4, padding: 4 }}>
              <div style={{ fontSize: 11, color: "#666", marginBottom: 4 }}>{day}</div>
              {dayCards.map((card) => (
                <div key={card.id} onClick={() => onCardClick(card)}
                  draggable onDragStart={(e) => e.dataTransfer.setData("cardId", card.id)}
                  style={{
                    fontSize: 11, padding: "2px 6px", borderRadius: 4, marginBottom: 2,
                    backgroundColor: "#1a1a2e", color: "#e2e8f0", cursor: "pointer",
                    whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                  }}>
                  {PLATFORM_EMOJI[card.platform]} {card.topic?.slice(0, 20)}
                </div>
              ))}
            </div>
          )
        })}
      </div>

      {/* Ready to Schedule tray */}
      {unscheduledApproved.length > 0 && (
        <div style={{ marginTop: 16, borderTop: "1px solid #333", paddingTop: 12 }}>
          <div style={{ fontSize: 12, color: "#888", marginBottom: 8 }}>Ready to Schedule ({unscheduledApproved.length})</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {unscheduledApproved.map((card) => (
              <div key={card.id}
                draggable onDragStart={(e) => e.dataTransfer.setData("cardId", card.id)}
                style={{
                  fontSize: 12, padding: "4px 10px", borderRadius: 6,
                  backgroundColor: "#1a2e1a", color: "#4caf50", cursor: "grab",
                }}>
                {PLATFORM_EMOJI[card.platform]} {card.topic?.slice(0, 30)}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Add Board|Calendar toggle to Pipeline.tsx**

```tsx
const [viewMode, setViewMode] = useState<"board" | "calendar">("board")

// In header:
<div style={{ display: "flex", gap: 4, backgroundColor: "#1a1a1a", borderRadius: 6, padding: 2 }}>
  <button onClick={() => setViewMode("board")}
    style={{ padding: "4px 12px", borderRadius: 4, border: "none", cursor: "pointer",
      backgroundColor: viewMode === "board" ? "#7c8aff" : "transparent",
      color: viewMode === "board" ? "#fff" : "#888" }}>Board</button>
  <button onClick={() => setViewMode("calendar")}
    style={{ padding: "4px 12px", borderRadius: 4, border: "none", cursor: "pointer",
      backgroundColor: viewMode === "calendar" ? "#7c8aff" : "transparent",
      color: viewMode === "calendar" ? "#fff" : "#888" }}>Calendar</button>
</div>

// In render body:
{viewMode === "board" ? (
  <DnDPipeline cards={filteredCards} columns={columns} onCardClick={onSelectCard} onRefresh={refresh} />
) : (
  <Calendar cards={filteredCards} onCardClick={onSelectCard}
    onScheduleChange={(cardId, date) => scheduleContent({ action: "schedule", cardId, scheduledAt: date })} />
)}
```

- [ ] **Step 3: Commit**

```bash
git add ui/pages/marketing/Calendar.tsx ui/pages/marketing/Pipeline.tsx
git commit -m "feat: add calendar view with Board|Calendar toggle"
```

---

### Task 19: Schedule Controls in Detail Panel

**Files:**
- Modify: `ui/pages/marketing/DetailPanel.tsx`

- [ ] **Step 1: Add scheduling section to DetailPanel**

When card status is "approved", show schedule controls:

```tsx
const scheduleContent = usePluginAction("schedule-content")

// Inside the detail panel, after status buttons:
{card.status === "approved" && (
  <div style={{ borderTop: "1px solid #333", paddingTop: 12, marginTop: 12 }}>
    <div style={{ fontSize: 12, color: "#888", marginBottom: 8 }}>Schedule</div>
    {card.scheduledAt ? (
      <>
        <div style={{ fontSize: 13, color: "#e2e8f0", marginBottom: 8 }}>
          🕐 Scheduled: {new Date(card.scheduledAt).toLocaleString()}
          {card.scheduledStatus === "pending" && (
            <span style={{ color: "#c9a227", marginLeft: 8 }}>
              (Publishes in {formatCountdown(card.scheduledAt)})
            </span>
          )}
          {card.scheduledStatus === "failed" && (
            <span style={{ color: "#ff4444", marginLeft: 8 }}>Failed</span>
          )}
        </div>
        <button onClick={() => scheduleContent({ action: "unschedule", cardId: card.id })}
          style={ghostButtonStyle}>Unschedule</button>
        {card.scheduledStatus === "failed" && (
          <button onClick={() => scheduleContent({ action: "reschedule", cardId: card.id, scheduledAt: card.scheduledAt })}
            style={{ ...primaryButtonStyle, marginLeft: 8 }}>Retry</button>
        )}
      </>
    ) : (
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <input type="datetime-local" value={scheduleInput}
          onChange={(e) => setScheduleInput(e.target.value)}
          style={inputStyle} />
        <button onClick={() => {
          if (scheduleInput) scheduleContent({
            action: "schedule", cardId: card.id,
            scheduledAt: new Date(scheduleInput).toISOString(),
          })
        }} style={primaryButtonStyle}>Schedule</button>
      </div>
    )}
    {card.publishError && (
      <div style={{ color: "#ff4444", fontSize: 12, marginTop: 8 }}>
        Error: {card.publishError}
      </div>
    )}
  </div>
)}

// Published cards with platformPostRef:
{card.status === "published" && card.platformPostRef && (
  <a href={card.platformPostRef.url} target="_blank" rel="noopener"
    style={{ color: "#7c8aff", fontSize: 13, textDecoration: "none" }}>
    View on {card.platform} ↗
  </a>
)}
```

Helper function:
```typescript
function formatCountdown(isoDate: string): string {
  const ms = new Date(isoDate).getTime() - Date.now()
  if (ms <= 0) return "now"
  const hours = Math.floor(ms / 3600000)
  const mins = Math.floor((ms % 3600000) / 60000)
  return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`
}
```

- [ ] **Step 2: Commit**

```bash
git add ui/pages/marketing/DetailPanel.tsx
git commit -m "feat: add scheduling controls and platform link to detail panel"
```

---

### Task 20: Templates UI

**Files:**
- Create: `ui/pages/marketing/Templates.tsx`
- Modify: `ui/pages/marketing/Create.tsx` — add Templates tab

- [ ] **Step 1: Create Templates component**

Create `ui/pages/marketing/Templates.tsx`:

```tsx
import React, { useState } from "react"
import { usePluginData, usePluginAction, usePluginToast } from "@paperclipai/plugin-sdk/ui"
import type { ContentTemplate } from "./types"
import { inputStyle, primaryButtonStyle, cardStyle, badgeStyle, selectStyle } from "./styles"

interface TemplatesProps {
  onApplyTemplate: (resolved: string, template: ContentTemplate) => void
}

export function Templates({ onApplyTemplate }: TemplatesProps) {
  const { data: templates } = usePluginData<ContentTemplate[]>("templates")
  const applyTemplate = usePluginAction("apply-template")
  const toast = usePluginToast()
  const [selectedTemplate, setSelectedTemplate] = useState<ContentTemplate | null>(null)
  const [variables, setVariables] = useState<Record<string, string>>({})
  const [search, setSearch] = useState("")

  const filtered = (templates ?? []).filter((t) =>
    t.name.toLowerCase().includes(search.toLowerCase())
  )

  async function handleApply() {
    if (!selectedTemplate) return
    try {
      const result = await applyTemplate({
        templateId: selectedTemplate.id,
        variables,
      }) as { resolved: string }
      onApplyTemplate(result.resolved, selectedTemplate)
      toast({ type: "success", message: "Template applied" })
    } catch (err) {
      toast({ type: "error", message: `Failed: ${err}` })
    }
  }

  if (selectedTemplate) {
    return (
      <div>
        <button onClick={() => setSelectedTemplate(null)} style={{ background: "none", border: "none", color: "#7c8aff", cursor: "pointer", marginBottom: 12 }}>← Back to templates</button>
        <h4 style={{ color: "#e2e8f0", margin: "0 0 12px" }}>{selectedTemplate.name}</h4>
        {selectedTemplate.variables.map((v) => (
          <div key={v.key} style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 12, color: "#888", display: "block", marginBottom: 4 }}>{v.label}</label>
            {v.type === "select" ? (
              <select value={variables[v.key] ?? v.defaultValue ?? ""}
                onChange={(e) => setVariables((prev) => ({ ...prev, [v.key]: e.target.value }))}
                style={selectStyle}>
                {v.options?.map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
            ) : (
              <input value={variables[v.key] ?? v.defaultValue ?? ""}
                onChange={(e) => setVariables((prev) => ({ ...prev, [v.key]: e.target.value }))}
                placeholder={v.defaultValue ?? v.label}
                style={inputStyle} />
            )}
          </div>
        ))}
        <button onClick={handleApply} style={primaryButtonStyle}>Apply Template</button>
      </div>
    )
  }

  return (
    <div>
      <input value={search} onChange={(e) => setSearch(e.target.value)}
        placeholder="Search templates..." style={{ ...inputStyle, marginBottom: 12, width: "100%" }} />
      {filtered.map((t) => (
        <div key={t.id} onClick={() => { setSelectedTemplate(t); setVariables({}) }}
          style={{ ...cardStyle, cursor: "pointer", marginBottom: 8 }}>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span style={{ color: "#e2e8f0", fontSize: 13, fontWeight: 500 }}>{t.name}</span>
            <span style={badgeStyle}>{t.platform}</span>
          </div>
          {t.description && <div style={{ fontSize: 11, color: "#666", marginTop: 4 }}>{t.description}</div>}
          <div style={{ fontSize: 11, color: "#555", marginTop: 4 }}>Used {t.useCount} times</div>
        </div>
      ))}
      {filtered.length === 0 && (
        <div style={{ color: "#555", fontSize: 13, textAlign: "center", padding: 24 }}>No templates yet</div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Add Templates tab to Create.tsx**

In `ui/pages/marketing/Create.tsx`, add a tab toggle between Tools and Templates in the left palette:

```tsx
import { Templates } from "./Templates"

// Add state:
const [paletteTab, setPaletteTab] = useState<"tools" | "templates">("tools")

// Tab toggle in left palette header:
<div style={{ display: "flex", gap: 4, marginBottom: 12 }}>
  <button onClick={() => setPaletteTab("tools")} style={{
    padding: "4px 12px", borderRadius: 4, border: "none", cursor: "pointer",
    backgroundColor: paletteTab === "tools" ? "#7c8aff" : "#1a1a1a",
    color: paletteTab === "tools" ? "#fff" : "#888",
  }}>Tools</button>
  <button onClick={() => setPaletteTab("templates")} style={{
    padding: "4px 12px", borderRadius: 4, border: "none", cursor: "pointer",
    backgroundColor: paletteTab === "templates" ? "#7c8aff" : "#1a1a1a",
    color: paletteTab === "templates" ? "#fff" : "#888",
  }}>Templates</button>
</div>

// Render based on tab:
{paletteTab === "tools" ? (
  /* existing tool palette */
) : (
  <Templates onApplyTemplate={(resolved, template) => {
    setChainContext((prev) => ({ ...prev, caption: resolved, topic: template.name }))
    setPaletteTab("tools") // Switch back to show tools for execution
  }} />
)}
```

- [ ] **Step 3: Add "Save as Template" button to DetailPanel**

In `ui/pages/marketing/DetailPanel.tsx`:

```tsx
const createTemplate = usePluginAction("create-template")

// Add button below card content:
<button onClick={async () => {
  await createTemplate({
    name: `Template from: ${card.topic}`,
    platform: card.platform,
    captionTemplate: card.caption,
    variables: [],
    createdFrom: card.id,
  })
  toast({ type: "success", message: "Saved as template" })
}} style={ghostButtonStyle}>Save as Template</button>
```

- [ ] **Step 4: Commit**

```bash
git add ui/pages/marketing/Templates.tsx ui/pages/marketing/Create.tsx ui/pages/marketing/DetailPanel.tsx
git commit -m "feat: add template library UI with apply flow and save-as-template"
```

---

### Task 21: Bulk Operations UI

**Files:**
- Create: `ui/pages/marketing/BulkActionBar.tsx`
- Modify: `ui/pages/marketing/Pipeline.tsx` — add selection mode
- Modify: `ui/pages/marketing/MarketingHub.tsx` — lift selection state

- [ ] **Step 1: Create BulkActionBar component**

Create `ui/pages/marketing/BulkActionBar.tsx`:

```tsx
import React, { useState } from "react"
import { usePluginAction, usePluginToast } from "@paperclipai/plugin-sdk/ui"
import type { Campaign, BulkResult } from "./types"
import { primaryButtonStyle, selectStyle } from "./styles"

interface BulkActionBarProps {
  selectedIds: string[]
  campaigns: Campaign[]
  onClear: () => void
  onComplete: () => void
}

export function BulkActionBar({ selectedIds, campaigns, onClear, onComplete }: BulkActionBarProps) {
  const bulkOp = usePluginAction("bulk-operation")
  const toast = usePluginToast()
  const [running, setRunning] = useState(false)

  async function execute(action: string, extra: Record<string, unknown> = {}) {
    setRunning(true)
    try {
      const result = await bulkOp({ action, cardIds: selectedIds, ...extra }) as BulkResult
      toast({
        type: result.failed > 0 ? "warning" : "success",
        message: `${result.succeeded} succeeded, ${result.skipped} skipped, ${result.failed} failed`,
      })
      onComplete()
      onClear()
    } catch (err) {
      toast({ type: "error", message: String(err) })
    } finally {
      setRunning(false)
    }
  }

  if (selectedIds.length === 0) return null

  return (
    <div style={{
      position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)",
      display: "flex", alignItems: "center", gap: 12, padding: "10px 20px",
      backgroundColor: "#1a1a2e", borderRadius: 12, border: "1px solid #333",
      boxShadow: "0 8px 32px rgba(0,0,0,0.5)", zIndex: 100,
    }}>
      <span style={{ color: "#e2e8f0", fontSize: 13, fontWeight: 600 }}>{selectedIds.length} selected</span>
      <div style={{ width: 1, height: 20, backgroundColor: "#333" }} />
      <button onClick={() => execute("approve")} disabled={running} style={primaryButtonStyle}>Approve</button>
      <button onClick={() => execute("reject")} disabled={running} style={{ ...primaryButtonStyle, backgroundColor: "#aa3333" }}>Reject</button>
      <select onChange={(e) => { if (e.target.value) execute("move", { targetStatus: e.target.value }); e.target.value = "" }}
        disabled={running} style={selectStyle}>
        <option value="">Move to...</option>
        <option value="draft">Draft</option>
        <option value="review">Review</option>
        <option value="approved">Approved</option>
      </select>
      <select onChange={(e) => { if (e.target.value) execute("assign-campaign", { campaignId: e.target.value === "none" ? null : e.target.value }); e.target.value = "" }}
        disabled={running} style={selectStyle}>
        <option value="">Assign Campaign...</option>
        <option value="none">Uncategorized</option>
        {campaigns.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
      </select>
      <div style={{ width: 1, height: 20, backgroundColor: "#333" }} />
      <button onClick={onClear} style={{ background: "none", border: "none", color: "#888", cursor: "pointer", fontSize: 12 }}>Deselect All</button>
    </div>
  )
}
```

- [ ] **Step 2: Add selection mode to Pipeline**

In `ui/pages/marketing/Pipeline.tsx`, add selection state and checkbox rendering to cards. Lift `selectedCardIds` state to `MarketingHub.tsx` and pass down as props.

- [ ] **Step 3: Commit**

```bash
git add ui/pages/marketing/BulkActionBar.tsx ui/pages/marketing/Pipeline.tsx ui/pages/marketing/MarketingHub.tsx
git commit -m "feat: add bulk operations with selection mode and floating action bar"
```

---

### Task 22: A/B Variant Comparison UI

**Files:**
- Create: `ui/pages/marketing/VariantComparison.tsx`
- Modify: `ui/pages/marketing/DetailPanel.tsx` — add "Create Variant" and "Compare" buttons
- Modify: `ui/pages/marketing/Pipeline.tsx` — add variant visual indicators

- [ ] **Step 1: Create VariantComparison component**

Create `ui/pages/marketing/VariantComparison.tsx`:

```tsx
import React from "react"
import { usePluginData, usePluginAction, usePluginToast } from "@paperclipai/plugin-sdk/ui"
import type { ContentCard, VariantGroup } from "./types"
import { PLATFORM_EMOJI, primaryButtonStyle, cardStyle } from "./styles"

interface VariantComparisonProps {
  group: VariantGroup
  cards: ContentCard[]
  onBack: () => void
}

export function VariantComparison({ group, cards, onBack }: VariantComparisonProps) {
  const pickWinner = usePluginAction("pick-winner")
  const toast = usePluginToast()

  const variants = group.variantCardIds
    .map((id) => cards.find((c) => c.id === id))
    .filter(Boolean) as ContentCard[]

  return (
    <div>
      <button onClick={onBack} style={{ background: "none", border: "none", color: "#7c8aff", cursor: "pointer", marginBottom: 16 }}>
        ← Back to Pipeline
      </button>
      <h3 style={{ color: "#e2e8f0", margin: "0 0 16px" }}>Variant Comparison: {group.topic}</h3>
      <div style={{ display: "grid", gridTemplateColumns: `repeat(${variants.length}, 1fr)`, gap: 16 }}>
        {variants.map((card) => (
          <div key={card.id} style={{
            ...cardStyle, padding: 16,
            border: group.winnerCardId === card.id ? "2px solid #4caf50" : "1px solid #333",
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
              <span style={{
                backgroundColor: "#7c8aff", color: "#fff", padding: "2px 8px",
                borderRadius: 4, fontSize: 12, fontWeight: 700,
              }}>Variant {card.variantLabel}</span>
              {group.winnerCardId === card.id && (
                <span style={{ fontSize: 16 }}>👑</span>
              )}
            </div>

            {/* Caption */}
            <div style={{ fontSize: 13, color: "#e2e8f0", marginBottom: 12, whiteSpace: "pre-wrap" }}>
              {card.caption}
            </div>

            {/* Metadata */}
            <div style={{ fontSize: 12, color: "#888", marginBottom: 8 }}>
              {PLATFORM_EMOJI[card.platform]} {card.platform} · Mod: {card.moderationScore ?? "—"}
            </div>

            {/* Engagement (if published) */}
            {card.status === "published" && card.platformPostRef && (
              <div style={{ borderTop: "1px solid #333", paddingTop: 8, marginTop: 8 }}>
                <div style={{ fontSize: 12, color: "#888", marginBottom: 4 }}>Engagement</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4, fontSize: 13, color: "#e2e8f0" }}>
                  <span>👍 {(card as any).latestEngagement?.likes ?? 0}</span>
                  <span>🔄 {(card as any).latestEngagement?.shares ?? 0}</span>
                  <span>💬 {(card as any).latestEngagement?.comments ?? 0}</span>
                  <span>👁 {(card as any).latestEngagement?.impressions ?? 0}</span>
                </div>
              </div>
            )}

            {/* Pick Winner */}
            {!group.winnerCardId && card.status === "published" && (
              <button onClick={async () => {
                await pickWinner({ variantGroupId: group.id, winnerCardId: card.id })
                toast({ type: "success", message: `Variant ${card.variantLabel} picked as winner` })
              }} style={{ ...primaryButtonStyle, width: "100%", marginTop: 12 }}>
                👑 Pick Winner
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Add variant buttons to DetailPanel**

In `ui/pages/marketing/DetailPanel.tsx`:

```tsx
// "Create Variant" button for draft/review cards:
{(card.status === "draft" || card.status === "review") && (
  <button onClick={() => onCreateVariant(card.id)} style={ghostButtonStyle}>
    Create Variant
  </button>
)}

// "Compare Variants" button if card is in a variant group:
{card.variantGroupId && (
  <button onClick={() => onCompareVariants(card.variantGroupId!)} style={ghostButtonStyle}>
    Compare Variants
  </button>
)}

// Variant label badge:
{card.variantLabel && (
  <span style={{ backgroundColor: "#7c8aff", color: "#fff", padding: "1px 6px", borderRadius: 4, fontSize: 11, fontWeight: 700, marginLeft: 8 }}>
    Variant {card.variantLabel}
  </span>
)}
```

- [ ] **Step 3: Add variant indicators to Pipeline cards**

In `DnDPipeline.tsx` / `Pipeline.tsx` card rendering, add variant badge:

```tsx
{card.variantLabel && (
  <span style={{ fontSize: 10, backgroundColor: "#7c8aff", color: "#fff", padding: "1px 4px", borderRadius: 3 }}>
    {card.variantLabel}
  </span>
)}
```

- [ ] **Step 4: Commit**

```bash
git add ui/pages/marketing/VariantComparison.tsx ui/pages/marketing/DetailPanel.tsx ui/pages/marketing/DnDPipeline.tsx
git commit -m "feat: add A/B variant comparison view and variant indicators"
```

---

### Task 23: Analytics Dashboard

**Files:**
- Create: `ui/pages/marketing/Analytics.tsx`
- Modify: `ui/pages/marketing/Sidebar.tsx` — add Analytics nav item
- Modify: `ui/pages/MarketingHub.tsx` — add "analytics" section

- [ ] **Step 1: Create Analytics component**

Create `ui/pages/marketing/Analytics.tsx`:

```tsx
import React, { useState, useMemo } from "react"
import { usePluginData } from "@paperclipai/plugin-sdk/ui"
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, BarElement, ArcElement, Title, Tooltip, Legend } from "chart.js"
import { Line, Bar, Doughnut } from "react-chartjs-2"
import type { Campaign } from "./types"
import { selectStyle } from "./styles"

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, ArcElement, Title, Tooltip, Legend)

const CHART_COLORS = {
  twitter: "#1DA1F2",
  reddit: "#FF4500",
  telegram: "#0088cc",
  instagram: "#E1306C",
  human: "#4caf50",
  agent: "#7c8aff",
}

interface AnalyticsProps {
  campaigns: Campaign[]
}

export function Analytics({ campaigns }: AnalyticsProps) {
  const [dateRange, setDateRange] = useState<"7d" | "30d" | "90d">("30d")
  const [campaignId, setCampaignId] = useState<string | null>(null)

  const rangeDays = dateRange === "7d" ? 7 : dateRange === "30d" ? 30 : 90
  const startDate = new Date(Date.now() - rangeDays * 86400000).toISOString().slice(0, 10)
  const endDate = new Date().toISOString().slice(0, 10)

  const { data: byDay } = usePluginData<any>("analytics", {
    dateRange: { start: startDate, end: endDate },
    campaignId: campaignId ?? undefined,
    groupBy: "day",
  })

  const { data: byPlatform } = usePluginData<any>("analytics", {
    dateRange: { start: startDate, end: endDate },
    campaignId: campaignId ?? undefined,
    groupBy: "platform",
  })

  const { data: bySource } = usePluginData<any>("analytics", {
    dateRange: { start: startDate, end: endDate },
    campaignId: campaignId ?? undefined,
    groupBy: "source",
  })

  const { data: byMediaType } = usePluginData<any>("analytics", {
    dateRange: { start: startDate, end: endDate },
    campaignId: campaignId ?? undefined,
    groupBy: "mediaType",
  })

  const chartOpts = { responsive: true, plugins: { legend: { labels: { color: "#888" } } }, scales: { x: { ticks: { color: "#666" } }, y: { ticks: { color: "#666" } } } }

  return (
    <div>
      {/* Header */}
      <div style={{ display: "flex", gap: 12, marginBottom: 20, alignItems: "center" }}>
        <div style={{ display: "flex", gap: 4, backgroundColor: "#1a1a1a", borderRadius: 6, padding: 2 }}>
          {(["7d", "30d", "90d"] as const).map((r) => (
            <button key={r} onClick={() => setDateRange(r)} style={{
              padding: "4px 10px", borderRadius: 4, border: "none", cursor: "pointer", fontSize: 12,
              backgroundColor: dateRange === r ? "#7c8aff" : "transparent",
              color: dateRange === r ? "#fff" : "#888",
            }}>{r}</button>
          ))}
        </div>
        <select value={campaignId ?? "all"} onChange={(e) => setCampaignId(e.target.value === "all" ? null : e.target.value)} style={selectStyle}>
          <option value="all">All Campaigns</option>
          {campaigns.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      {/* 2x2 Chart Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        {/* Engagement Over Time */}
        <div style={{ backgroundColor: "#111", borderRadius: 8, padding: 16 }}>
          <h4 style={{ color: "#e2e8f0", margin: "0 0 12px", fontSize: 14 }}>Engagement Over Time</h4>
          {byDay?.data && (
            <Line data={{
              labels: Object.keys(byDay.data).sort(),
              datasets: [{
                label: "Total Engagement",
                data: Object.keys(byDay.data).sort().map((k) => {
                  const d = byDay.data[k]
                  return d.likes + d.comments + d.shares
                }),
                borderColor: "#7c8aff",
                backgroundColor: "rgba(124,138,255,0.1)",
                fill: true,
              }],
            }} options={chartOpts as any} />
          )}
        </div>

        {/* Platform Comparison */}
        <div style={{ backgroundColor: "#111", borderRadius: 8, padding: 16 }}>
          <h4 style={{ color: "#e2e8f0", margin: "0 0 12px", fontSize: 14 }}>Platform Comparison</h4>
          {byPlatform?.data && (
            <Bar data={{
              labels: Object.keys(byPlatform.data),
              datasets: [
                { label: "Likes", data: Object.values(byPlatform.data).map((d: any) => d.likes), backgroundColor: "#4caf50" },
                { label: "Shares", data: Object.values(byPlatform.data).map((d: any) => d.shares), backgroundColor: "#7c8aff" },
                { label: "Comments", data: Object.values(byPlatform.data).map((d: any) => d.comments), backgroundColor: "#c9a227" },
              ],
            }} options={chartOpts as any} />
          )}
        </div>

        {/* Agent vs Human */}
        <div style={{ backgroundColor: "#111", borderRadius: 8, padding: 16 }}>
          <h4 style={{ color: "#e2e8f0", margin: "0 0 12px", fontSize: 14 }}>Agent vs Human</h4>
          {bySource?.data && (
            <Doughnut data={{
              labels: Object.keys(bySource.data).map((k) => `${k} (${bySource.data[k].count})`),
              datasets: [{
                data: Object.values(bySource.data).map((d: any) => d.count),
                backgroundColor: Object.keys(bySource.data).map((k) => (CHART_COLORS as any)[k] ?? "#555"),
              }],
            }} options={{ responsive: true, plugins: { legend: { labels: { color: "#888" } } } }} />
          )}
        </div>

        {/* Content Type Breakdown */}
        <div style={{ backgroundColor: "#111", borderRadius: 8, padding: 16 }}>
          <h4 style={{ color: "#e2e8f0", margin: "0 0 12px", fontSize: 14 }}>Content Type</h4>
          {byMediaType?.data && (
            <Bar data={{
              labels: Object.keys(byMediaType.data),
              datasets: [{
                label: "Avg Engagement",
                data: Object.values(byMediaType.data).map((d: any) => {
                  const total = d.likes + d.shares + d.comments
                  return d.count > 0 ? Math.round(total / d.count) : 0
                }),
                backgroundColor: "#7c8aff",
              }],
            }} options={{ ...chartOpts, indexAxis: "y" } as any} />
          )}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Add Analytics to sidebar nav and MarketingHub**

In `ui/pages/marketing/Sidebar.tsx`, add 5th nav item:

```tsx
{ key: "analytics", label: "📊 Analytics" }
```

In `ui/pages/MarketingHub.tsx`, add the section:

```tsx
import { Analytics } from "./marketing/Analytics"

// Extend HubSection type in types.ts:
// type HubSection = "pipeline" | "create" | "discover" | "monitor" | "analytics"

// In section rendering:
{activeSection === "analytics" && <Analytics campaigns={campaigns ?? []} />}
```

- [ ] **Step 3: Commit**

```bash
git add ui/pages/marketing/Analytics.tsx ui/pages/marketing/Sidebar.tsx ui/pages/MarketingHub.tsx ui/pages/marketing/types.ts
git commit -m "feat: add analytics dashboard with Chart.js"
```

---

### Task 24: Platform Connections UI

**Files:**
- Create: `ui/pages/marketing/PlatformConnections.tsx`
- Modify: `ui/pages/marketing/Sidebar.tsx` — add to brand settings editor

- [ ] **Step 1: Create PlatformConnections component**

Create `ui/pages/marketing/PlatformConnections.tsx` — a configuration form for entering API credentials per platform, with a "Test Connection" button per platform. Renders inside the brand settings editor in the sidebar.

```tsx
import React, { useState } from "react"
import { usePluginAction, usePluginToast } from "@paperclipai/plugin-sdk/ui"
import { inputStyle, primaryButtonStyle, ghostButtonStyle } from "./styles"

const PLATFORMS = [
  { key: "twitter", label: "Twitter / X", secretKeys: ["TWEETAPI_API_KEY"], icon: "🐦" },
  { key: "reddit", label: "Reddit", secretKeys: ["REDDIT_CLIENT_ID", "REDDIT_CLIENT_SECRET", "REDDIT_REFRESH_TOKEN"], icon: "📱" },
  { key: "telegram", label: "Telegram", secretKeys: ["TELEGRAM_BOT_TOKEN", "TELEGRAM_CHANNEL_IDS"], icon: "✈️" },
  { key: "rssapp", label: "RSS.app (Trends)", secretKeys: ["RSSAPP_API_KEY", "RSSAPP_API_SECRET"], icon: "📡" },
]

export function PlatformConnections() {
  const saveConfig = usePluginAction("save-platform-config")
  const testConnection = usePluginAction("test-platform-connection")
  const toast = usePluginToast()
  const [values, setValues] = useState<Record<string, string>>({})
  const [testing, setTesting] = useState<string | null>(null)

  return (
    <div>
      <h4 style={{ color: "#e2e8f0", margin: "0 0 12px", fontSize: 14 }}>Platform Connections</h4>
      {PLATFORMS.map(({ key, label, secretKeys, icon }) => (
        <div key={key} style={{ marginBottom: 16, padding: 12, backgroundColor: "#111", borderRadius: 8 }}>
          <div style={{ fontSize: 13, color: "#e2e8f0", marginBottom: 8 }}>{icon} {label}</div>
          {secretKeys.map((sk) => (
            <div key={sk} style={{ marginBottom: 8 }}>
              <label style={{ fontSize: 11, color: "#666", display: "block", marginBottom: 2 }}>{sk}</label>
              <input type="password" value={values[sk] ?? ""}
                onChange={(e) => setValues((prev) => ({ ...prev, [sk]: e.target.value }))}
                placeholder="Enter key..." style={{ ...inputStyle, width: "100%", fontSize: 12 }} />
            </div>
          ))}
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={async () => {
              const configForPlatform = Object.fromEntries(secretKeys.map((sk) => [sk, values[sk] ?? ""]))
              await saveConfig({ platform: key, ...configForPlatform })
              toast({ type: "success", message: `${label} credentials saved` })
            }} style={primaryButtonStyle}>Save</button>
            <button onClick={async () => {
              setTesting(key)
              try {
                const result = await testConnection({ platform: key }) as any
                toast({ type: result.ok ? "success" : "error", message: result.ok ? `${label} connected!` : result.reason })
              } catch { toast({ type: "error", message: "Connection test failed" }) }
              finally { setTesting(null) }
            }} disabled={testing === key} style={ghostButtonStyle}>
              {testing === key ? "Testing..." : "Test Connection"}
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 2: Integrate into Sidebar brand settings editor**

In `ui/pages/marketing/Sidebar.tsx`, add below the brand editor form:

```tsx
import { PlatformConnections } from "./PlatformConnections"

// Inside the brand settings editor section:
<PlatformConnections />
```

- [ ] **Step 3: Commit**

```bash
git add ui/pages/marketing/PlatformConnections.tsx ui/pages/marketing/Sidebar.tsx
git commit -m "feat: add platform connections UI for credential management"
```

---

## Phase 4: Bug Fixes & Streaming

### Task 25: Fix V1 Bugs

**Files:**
- Modify: `ui/pages/marketing/Discover.tsx` — fix React key warning
- Modify: `ui/pages/marketing/Sidebar.tsx` — fix brand refresh race

- [ ] **Step 1: Fix React key in Discover.tsx**

In `ui/pages/marketing/Discover.tsx`, line 101, change:

```tsx
// Before:
key={`${trend.title}-${i}`}
// After:
key={trend.id}
```

- [ ] **Step 2: Fix brand sidebar refresh in Sidebar.tsx**

In `ui/pages/marketing/Sidebar.tsx`, lines 83-93, change the save handler to use the action response optimistically:

```tsx
// Before:
const onSave = async () => {
  await saveBrand({ tone: editTone, audience: editAudience, platforms: editPlatforms })
  toast({ type: "success", message: "Brand settings saved" })
  refreshBrand()
  setEditing(false)
}

// After:
const onSave = async () => {
  const saved = await saveBrand({ tone: editTone, audience: editAudience, platforms: editPlatforms }) as any
  toast({ type: "success", message: "Brand settings saved" })
  // Optimistically update from response instead of re-fetching
  if (saved) {
    setBrandData(saved)
  }
  setEditing(false)
}
```

This requires the `save-brand-settings` action handler to return the saved brand settings in its response. Check `src/handlers/actions.ts` — if it doesn't already, add `return { tone, audience, platforms, bannedKeywords }` at the end of the handler.

- [ ] **Step 3: Commit**

```bash
git add ui/pages/marketing/Discover.tsx ui/pages/marketing/Sidebar.tsx
git commit -m "fix: React key warning in Discover and brand sidebar refresh race"
```

---

### Task 26: Generation Progress Streaming

**Files:**
- Modify: `src/handlers/actions.ts` — emit stream events during tool execution
- Read: ComfyUI docs from Archon for progress polling pattern

- [ ] **Step 1: Add stream emission to execute-tool handler**

In `src/handlers/actions.ts`, modify the `execute-tool` action handler to emit progress events. The worker emits events via JSON-RPC notifications to the host's streamBus:

```typescript
// In the execute-tool handler, when toolName is "generate-media" or "generate-post":

// Emit start
ctx.streams.emit("generation-progress", { stage: "queued", toolName })

// After dispatching to ComfyUI:
ctx.streams.emit("generation-progress", { stage: "generating", progress: 0, toolName })

// Poll ComfyUI progress endpoint during generation:
// GET http://{comfyuiHost}:{comfyuiPort}/history/{promptId}
// Or: GET /queue to check position

// Emit progress updates as they come:
// ctx.streams.emit("generation-progress", { stage: "generating", progress: 0.5, toolName })

// On completion:
ctx.streams.emit("generation-progress", { stage: "complete", outputFile: result.mediaRef, toolName })

// On error:
ctx.streams.emit("generation-progress", { stage: "error", message: err.message, toolName })
```

The `ctx.streams.emit(channel, event)` method sends a JSON-RPC notification `streams.emit` to the host, which the host's `plugin-worker-manager.ts` handles and publishes to the `streamBus`, which the SSE endpoint delivers to the UI's `usePluginStream("generation-progress")`.

- [ ] **Step 2: Verify Create.tsx already listens**

The Create workshop already has `usePluginStream("generation-progress")` wired to the progress indicator. Once the worker emits events, the UI will automatically show progress. No UI changes needed.

- [ ] **Step 3: Commit**

```bash
git add src/handlers/actions.ts
git commit -m "fix: emit generation-progress stream events during tool execution"
```

---

### Task 26a: Update Monitor UI for Real Data

**Files:**
- Modify: `ui/pages/marketing/Monitor.tsx`

- [ ] **Step 1: Add real engagement rendering to Monitor**

Update `Monitor.tsx` to show real engagement data with V2 enhancements:

```tsx
// Add trend indicators (compare current vs previous engagement):
{card.latestEngagement && card.previousEngagement && (
  <span style={{ color: card.latestEngagement.likes > card.previousEngagement.likes ? "#4caf50" : "#ff4444", fontSize: 11 }}>
    {card.latestEngagement.likes > card.previousEngagement.likes ? "▲" : "▼"}
  </span>
)}

// Add platform filter:
const [platformFilter, setPlatformFilter] = useState<Platform | "all">("all")
const filtered = platformFilter === "all" ? posts : posts.filter(p => p.platform === platformFilter)

// Add sort options:
const [sortBy, setSortBy] = useState<"engagement" | "growth" | "date">("engagement")

// Add "View on Platform" link for cards with platformPostRef:
{card.platformPostRef && (
  <a href={card.platformPostRef.url} target="_blank" rel="noopener" style={{ color: "#7c8aff", fontSize: 12 }}>
    View on {card.platform} ↗
  </a>
)}

// Alert badges:
{card.isViral && <span style={{ fontSize: 14 }} title="Viral!">🔥</span>}
{card.engagementDropped && <span style={{ fontSize: 14 }} title="Engagement dropped">⚠️</span>}
```

- [ ] **Step 2: Add publish trigger to update-card-status handler**

In `src/handlers/actions.ts`, update the existing `update-card-status` handler so that when a card transitions to `"published"` (manually or by agent), it also calls `platformManager.publish()`:

```typescript
// Inside update-card-status handler, after setting card.status = "published":
if (newStatus === "published" && platformManager) {
  const result = await platformManager.publish({
    caption: card.caption,
    platform: card.platform,
    mediaRef: card.mediaRef,
    mediaType: card.mediaType,
  })
  if (result.success) {
    card.platformPostRef = {
      platform: card.platform,
      postId: result.platformPostId,
      url: result.platformUrl,
      publishedAt: new Date().toISOString(),
    }
  } else {
    card.publishError = result.error ?? "Unknown error"
  }
}

// Also emit schedule-fired stream event:
ctx.streams.emit("schedule-fired", { cardId: card.id, status: "published" })
```

- [ ] **Step 3: Commit**

```bash
git add ui/pages/marketing/Monitor.tsx src/handlers/actions.ts
git commit -m "feat: update Monitor view with real engagement data and publish trigger"
```

---

## Phase 5: Wire Real Data Sources

### Task 27: Real Trend Sources (RSS.app + Platform Adapters)

**Files:**
- Modify: `src/jobs/trend-scan.ts` — wire to RSS.app adapter + platform adapters
- Create: `src/handlers/webhooks.ts` — RSS.app webhook handler
- Modify: `src/manifest.ts` — add webhook endpoint

- [ ] **Step 1: Enhance trend-scan job**

In `src/jobs/trend-scan.ts`, replace mock data generation with real adapter calls:

```typescript
import type { TrendItem } from "../services/platforms/adapter.js"
import { TrendScorer } from "../services/platforms/trendScorer.js"
import type { ScoredTrend } from "../../ui/pages/marketing/types.js"

export async function runTrendScan(ctx: any, platformManager: PlatformManager, rssApp: RssAppAdapter | null) {
  const brandSettings = await ctx.state.get("brand-settings")
  const keywords = brandSettings?.keywords ?? []
  const scorer = new TrendScorer({ brandKeywords: keywords })

  const rawItems: TrendItem[] = []

  // 1. Direct platform adapter trends
  const platformTrends = await platformManager.discoverTrends({ keywords })
  rawItems.push(...platformTrends)

  // 2. RSS.app feed items (if configured)
  if (rssApp) {
    const feeds = (await ctx.state.get("trends:feeds")) ?? []
    for (const feed of feeds) {
      try {
        const items = await rssApp.getFeedItems(feed.id)
        rawItems.push(...items.map((item) => ({
          id: `rssapp-${feed.id}-${item.url}`,
          title: item.title,
          description: item.description_text,
          url: item.url,
          platform: feed.platform ?? ("web" as const),
          publishedAt: item.date_published,
          source: `rssapp:${feed.id}`,
        })))
      } catch { /* skip failed feeds */ }
    }
  }

  // 3. Score all items
  const existing: ScoredTrend[] = (await ctx.state.get("trends:active")) ?? []
  const dismissed = new Set(existing.filter((t) => t.dismissed).map((t) => t.id))
  const scored = rawItems
    .map((item) => scorer.score(item))
    .filter((t) => t.score > 0 && !dismissed.has(t.id))
    .sort((a, b) => b.score - a.score)

  // Merge with existing (keep dismissed state)
  const merged = [...scored]
  for (const ex of existing) {
    if (ex.dismissed && !merged.find((m) => m.id === ex.id)) {
      merged.push(ex)
    }
  }

  await ctx.state.set("trends:active", merged)
  ctx.streams.emit("trends-updated", { count: scored.length })
}
```

- [ ] **Step 2: Add webhook handler for RSS.app**

Create `src/handlers/webhooks.ts`:

```typescript
import { TrendScorer } from "../services/platforms/trendScorer.js"
import type { RssAppFeedItem } from "../services/platforms/rssAppAdapter.js"

export async function handleRssAppWebhook(ctx: any, payload: {
  headers: Record<string, string | string[]>
  parsedBody: unknown
}) {
  // TODO: Validate HMAC signature from headers

  const body = payload.parsedBody as { feed_id: string; items: RssAppFeedItem[] }
  if (!body?.items?.length) return { processed: 0 }

  const brandSettings = await ctx.state.get("brand-settings")
  const scorer = new TrendScorer({ brandKeywords: brandSettings?.keywords ?? [] })

  const feeds = (await ctx.state.get("trends:feeds")) ?? []
  const feed = feeds.find((f: any) => f.id === body.feed_id)

  const scored = body.items.map((item) => scorer.score({
    id: `rssapp-${body.feed_id}-${item.url}`,
    title: item.title,
    description: item.description_text,
    url: item.url,
    platform: feed?.platform ?? "web",
    publishedAt: item.date_published,
    source: `rssapp:${body.feed_id}`,
  })).filter((t) => t.score > 0)

  const existing = (await ctx.state.get("trends:active")) ?? []
  const merged = [...scored, ...existing].slice(0, 200) // Cap at 200
  await ctx.state.set("trends:active", merged)

  ctx.streams.emit("trends-updated", { count: scored.length })
  return { processed: scored.length }
}
```

- [ ] **Step 3: Register webhook in manifest**

In `src/manifest.ts`, add to the webhooks array:

```typescript
webhooks: [
  // ... existing webhooks
  {
    endpointKey: "rssapp-feed-update",
    description: "RSS.app webhook for real-time feed updates",
  },
],
```

And in `src/worker.ts`, register the webhook handler:

```typescript
registerWebhookHandler("rssapp-feed-update", async (ctx, payload) => {
  return handleRssAppWebhook(ctx, payload)
})
```

- [ ] **Step 4: Commit**

```bash
git add src/jobs/trend-scan.ts src/handlers/webhooks.ts src/manifest.ts src/worker.ts
git commit -m "feat: wire real trend sources via RSS.app and platform adapters"
```

---

### Task 28: Real Engagement Polling

**Files:**
- Modify: `src/jobs/engagement-check.ts` — wire to platform adapters

- [ ] **Step 1: Enhance engagement-check job**

In `src/jobs/engagement-check.ts`:

```typescript
import type { EngagementSnapshot, EngagementAlerts } from "../../ui/pages/marketing/types.js"
import { engagementHistoryKey } from "../constants.js"

export async function runEngagementCheck(ctx: any, platformManager: PlatformManager) {
  const cards: any[] = (await ctx.state.get("pipeline:cards")) ?? []
  const alertConfig: EngagementAlerts = (await ctx.state.get("engagement:alerts")) ?? {
    viralThreshold: 500, engagementDropPercent: 50, enabled: true,
  }

  for (const card of cards) {
    if (card.status !== "published" || !card.platformPostRef) continue

    const metrics = await platformManager.getEngagement(card.platformPostRef)
    if (!metrics) continue

    // Store snapshot
    const historyKey = engagementHistoryKey(card.id)
    const history: EngagementSnapshot[] = (await ctx.state.get(historyKey)) ?? []
    history.push({ cardId: card.id, metrics, timestamp: new Date().toISOString() })
    // Keep last 100 snapshots per card
    if (history.length > 100) history.splice(0, history.length - 100)
    await ctx.state.set(historyKey, history)

    // Update latest on card
    const prevLikes = card.latestEngagement?.likes ?? 0
    card.latestEngagement = metrics
    card.updatedAt = new Date().toISOString()

    // Check alerts
    if (alertConfig.enabled) {
      if (metrics.likes >= alertConfig.viralThreshold && prevLikes < alertConfig.viralThreshold) {
        ctx.streams.emit("engagement-alert", {
          type: "viral",
          cardId: card.id,
          message: `🔥 "${card.topic}" hit ${metrics.likes} likes!`,
        })
      }

      if (prevLikes > 0) {
        const dropPct = ((prevLikes - metrics.likes) / prevLikes) * 100
        if (dropPct >= alertConfig.engagementDropPercent) {
          ctx.streams.emit("engagement-alert", {
            type: "drop",
            cardId: card.id,
            message: `⚠️ "${card.topic}" engagement dropped ${Math.round(dropPct)}%`,
          })
        }
      }
    }
  }

  await ctx.state.set("pipeline:cards", cards)
}
```

- [ ] **Step 2: Commit**

```bash
git add src/jobs/engagement-check.ts
git commit -m "feat: wire real engagement polling with viral detection and alerts"
```

---

## Phase 6: Agent Tool Registration

### Task 29: Register V2 Agent Tools in Manifest

**Files:**
- Modify: `src/manifest.ts` — add 9 new agent tools with parameter schemas

- [ ] **Step 1: Add tool definitions to manifest**

In `src/manifest.ts`, add to the `tools` array:

```typescript
{
  name: "manage-campaign",
  displayName: "Manage Campaign",
  description: "Create, update, delete, or list marketing campaigns",
  parametersSchema: {
    type: "object",
    properties: {
      action: { type: "string", enum: ["list", "get", "create", "update", "delete"] },
      campaignId: { type: "string" },
      name: { type: "string" },
      description: { type: "string" },
      targetPlatforms: { type: "array", items: { type: "string" } },
      dateRange: { type: "object", properties: { start: { type: "string" }, end: { type: "string" } } },
      status: { type: "string", enum: ["draft", "active", "completed"] },
    },
    required: ["action"],
  },
},
{
  name: "manage-pipeline",
  displayName: "Manage Pipeline",
  description: "Read pipeline state, move cards between statuses, filter by campaign or status",
  parametersSchema: {
    type: "object",
    properties: {
      action: { type: "string", enum: ["list", "move", "delete"] },
      cardId: { type: "string" },
      newStatus: { type: "string", enum: ["draft", "review", "approved", "published"] },
      filters: { type: "object", properties: {
        campaignId: { type: "string" },
        status: { type: "string" },
        platform: { type: "string" },
      }},
    },
    required: ["action"],
  },
},
{
  name: "schedule-content",
  displayName: "Schedule Content",
  description: "Set, update, or remove publish schedules on content cards",
  parametersSchema: {
    type: "object",
    properties: {
      action: { type: "string", enum: ["schedule", "unschedule", "reschedule"] },
      cardId: { type: "string" },
      scheduledAt: { type: "string", description: "ISO 8601 datetime" },
    },
    required: ["action", "cardId"],
  },
},
{
  name: "read-engagement",
  displayName: "Read Engagement",
  description: "Get engagement metrics for published content cards",
  parametersSchema: {
    type: "object",
    properties: {
      cardId: { type: "string" },
      campaignId: { type: "string" },
      platform: { type: "string" },
      dateRange: { type: "object", properties: { start: { type: "string" }, end: { type: "string" } } },
    },
  },
},
{
  name: "read-trends",
  displayName: "Read Trends",
  description: "Get scored trending topics with filters",
  parametersSchema: {
    type: "object",
    properties: {
      platform: { type: "string" },
      minScore: { type: "number" },
      keyword: { type: "string" },
      velocity: { type: "string", enum: ["rising", "stable", "falling"] },
    },
  },
},
{
  name: "manage-variants",
  displayName: "Manage A/B Variants",
  description: "Create variant groups, compare results, pick winners",
  parametersSchema: {
    type: "object",
    properties: {
      action: { type: "string", enum: ["create-variant", "list", "compare", "pick-winner"] },
      sourceCardId: { type: "string" },
      variantGroupId: { type: "string" },
      winnerCardId: { type: "string" },
      modifications: { type: "object" },
    },
    required: ["action"],
  },
},
{
  name: "bulk-operations",
  displayName: "Bulk Operations",
  description: "Batch approve, reject, move, regenerate, or assign campaign to multiple cards",
  parametersSchema: {
    type: "object",
    properties: {
      action: { type: "string", enum: ["approve", "reject", "move", "regenerate", "assign-campaign"] },
      cardIds: { type: "array", items: { type: "string" } },
      targetStatus: { type: "string" },
      toolsToRerun: { type: "array", items: { type: "string" } },
      campaignId: { type: "string" },
    },
    required: ["action", "cardIds"],
  },
},
{
  name: "read-analytics",
  displayName: "Read Analytics",
  description: "Query aggregated analytics data for engagement, platforms, content types",
  parametersSchema: {
    type: "object",
    properties: {
      metric: { type: "string", enum: ["engagement-over-time", "platform-comparison", "agent-vs-human", "content-type"] },
      dateRange: { type: "object", properties: { start: { type: "string" }, end: { type: "string" } } },
      campaignId: { type: "string" },
      groupBy: { type: "string", enum: ["day", "week", "platform", "source", "mediaType"] },
    },
  },
},
{
  name: "manage-templates",
  displayName: "Manage Templates",
  description: "List, create, apply, or delete content templates",
  parametersSchema: {
    type: "object",
    properties: {
      action: { type: "string", enum: ["list", "get", "create", "apply", "delete"] },
      templateId: { type: "string" },
      name: { type: "string" },
      platform: { type: "string" },
      captionTemplate: { type: "string" },
      variables: { type: "object" },
      toolChain: { type: "array", items: { type: "string" } },
    },
    required: ["action"],
  },
},
```

- [ ] **Step 2: Register tool handlers in worker.ts**

Wire each agent tool to the corresponding action/data handler in `src/worker.ts`:

```typescript
registerTool("manage-campaign", async (ctx, params) => handleCampaignAction(ctx, params))
registerTool("manage-pipeline", async (ctx, params) => {
  if (params.action === "list") {
    const cards = (await ctx.state.get("pipeline:cards")) ?? []
    let filtered = cards
    if (params.filters?.campaignId) filtered = filtered.filter((c: any) => c.campaignId === params.filters.campaignId)
    if (params.filters?.status) filtered = filtered.filter((c: any) => c.status === params.filters.status)
    if (params.filters?.platform) filtered = filtered.filter((c: any) => c.platform === params.filters.platform)
    return { cards: filtered, total: filtered.length }
  }
  if (params.action === "move") return handleScheduleAction(ctx, { action: "move", ...params })
  throw new Error(`Unknown manage-pipeline action: ${params.action}`)
})
registerTool("schedule-content", async (ctx, params) => handleScheduleAction(ctx, params))
registerTool("read-engagement", async (ctx, params) => { /* delegate to analytics data handler */ })
registerTool("read-trends", async (ctx, params) => {
  const trends = (await ctx.state.get("trends:active")) ?? []
  let filtered = trends
  if (params.platform) filtered = filtered.filter((t: any) => t.platform === params.platform)
  if (params.minScore) filtered = filtered.filter((t: any) => t.score >= params.minScore)
  if (params.keyword) filtered = filtered.filter((t: any) => t.title.toLowerCase().includes(params.keyword.toLowerCase()))
  if (params.velocity) filtered = filtered.filter((t: any) => t.velocity === params.velocity)
  return { trends: filtered, total: filtered.length }
})
registerTool("manage-variants", async (ctx, params) => handleVariantAction(ctx, params))
registerTool("bulk-operations", async (ctx, params) => handleBulkOperation(ctx, params))
registerTool("read-analytics", async (ctx, params) => { /* delegate to analytics data handler */ })
registerTool("manage-templates", async (ctx, params) => handleTemplateAction(ctx, params))
```

- [ ] **Step 3: Commit**

```bash
git add src/manifest.ts src/worker.ts
git commit -m "feat: register 9 V2 agent tools for full AI orchestration parity"
```

---

## Phase 7: Final Integration & Verification

### Task 30: Build Verification

**Files:** None — verification only

- [ ] **Step 1: Run all tests**

```bash
cd /home/winadmin/projects/BrandAmbassador
npx vitest run
```

Expected: All tests pass.

- [ ] **Step 2: Build the plugin**

```bash
npm run build
```

Expected: TypeScript compilation succeeds, UI bundle builds.

- [ ] **Step 3: Verify no type errors**

```bash
npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 4: Run Paperclip with the updated plugin**

Start Paperclip dev server and verify:
1. Marketing Hub loads without errors
2. All 5 sidebar sections render (Pipeline, Create, Discover, Monitor, Analytics)
3. DnD kanban works (drag a card between columns)
4. Calendar toggle renders month grid
5. Brand settings show Platform Connections section
6. No console errors

- [ ] **Step 5: Final commit if any fixes needed**

```bash
git add -A
git commit -m "chore: build verification fixes"
```

---

## Task Dependency Graph

```
Phase 1 (Adapters):     Task 1 → Task 2 → Task 3 → Tasks 4,5,6,7 (parallel) → Task 8
Phase 2 (Handlers):     Task 1 → Tasks 9,10,11,12,13 (parallel) → Task 14
Phase 3 (UI):           Task 15 → Tasks 16,17,18,19,20,21,22,23,24 (mostly parallel)
Phase 4 (Bug Fixes):    Task 25, Task 26 (parallel, independent)
Phase 5 (Real Data):    Tasks 4-8 + Task 14 → Tasks 27,28 (parallel)
Phase 6 (Agent Tools):  Tasks 9-13 → Task 29
Phase 7 (Verification): All → Task 30
```

Tasks within the same phase can often be parallelized by separate subagents, especially:
- Tasks 4, 5, 6, 7 (four platform adapters)
- Tasks 9, 10, 11, 12, 13 (five handler groups)
- Tasks 16-24 (UI components)
- Tasks 25, 26, 27, 28 (fixes + data wiring)
