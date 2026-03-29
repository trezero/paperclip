# Marketing Hub V2 — Design Specification

**Date:** 2026-03-29
**Status:** Draft
**Predecessor:** `docs/superpowers/specs/2026-03-29-marketing-hub-design.md` (V1 spec)
**Approach:** Layer-by-Layer (Adapters → Core Features → Data & Analytics)

## Overview

V2 completes the Marketing Hub vision: real platform publishing, real trend sources, real engagement data, drag-and-drop workflows, campaigns, scheduling, analytics, templates, bulk operations, and A/B testing. All 10 items from the V1 roadmap plus 3 V1 bug fixes.

**Core design principle — Agent Parity:** Every action, query, and view available in the UI is equally available to AI agents through registered tools. Agents and humans are first-class peers across the entire system.

---

## Part 1: Platform Adapter Layer

### Architecture

A unified `PlatformAdapter` interface with concrete implementations for each external service. All adapters live in the BrandAmbassador plugin worker.

```
BrandAmbassador/src/services/platforms/
  ├── adapter.ts           — Base PlatformAdapter interface
  ├── twitterAdapter.ts    — TweetAPI.com implementation
  ├── redditAdapter.ts     — Reddit public JSON + OAuth posting (ported from MemecoinInvestor2026)
  ├── telegramAdapter.ts   — Telegram Bot API implementation
  ├── rssAppAdapter.ts     — RSS.app feed management + polling
  └── resilientHttp.ts     — Circuit breaker + retry (ported from MemecoinInvestor2026)
```

### PlatformAdapter Interface

```ts
interface PlatformAdapter {
  platform: Platform;  // "twitter" | "reddit" | "telegram"

  // Publishing
  publish(content: PublishPayload): Promise<PublishResult>;

  // Engagement reading
  getEngagement(postRef: PlatformPostRef): Promise<EngagementMetrics>;

  // Trend discovery (optional — not all platforms support this)
  discoverTrends?(query: TrendQuery): Promise<TrendItem[]>;

  // Health check
  health(): Promise<{ ok: boolean; reason?: string }>;
}
```

### Twitter Adapter (TweetAPI.com)

- **Posting:** `POST` to TweetAPI.com endpoint with caption text, optional media URLs. Handles thread splitting for >280 chars automatically (split on sentence boundaries).
- **Engagement:** Poll published tweet IDs for likes, retweets, replies, impressions.
- **Trends:** Search endpoint for keyword-based tweet discovery. Supplements RSS.app for Twitter-specific trends.
- **Auth:** API key stored in plugin secrets (Paperclip's `pluginSecrets` store), loaded at worker init.
- **Cost:** ~$17/mo for Starter tier.
- **Mock mode:** Returns realistic fake data when credentials are missing. Adapter reports `{ ok: false, reason: "not configured" }`.

### Reddit Adapter

Ported from MemecoinInvestor2026's `redditAdapter.ts`. Reading uses public JSON endpoints (no auth, free). Publishing uses OAuth.

- `search(query)` — keyword search across Reddit
- `getHotPosts(subreddit)` — trending posts in a community
- `getRecent(subreddit)` — latest submissions
- **Publishing:** OAuth app registration with `snoowrap` or direct OAuth2 token flow. Post to configured subreddit(s).
- **Engagement:** Upvotes, comment count from post data.

**Reference implementation:** `/home/winadmin/projects/MemeCoinInvestor2026/server/services/social/redditAdapter.ts`

### Telegram Adapter

- **Publishing:** Bot API `sendMessage` / `sendPhoto` to configured channel(s). Bot token stored in plugin secrets.
- **Engagement:** `getMessageReactions` + view count from channel stats. Limited data — views available for channels, reactions in groups.
- **Trends:** Not directly supported. RSS.app handles Telegram channel monitoring via feeds.

### RSS.app Adapter

Trend aggregation service feeding the Discover view. Not a platform adapter — a cross-platform monitoring layer.

- **Setup:** On brand settings save, create RSS.app feeds for configured keywords + platform URLs.
- **Feed types:** Keyword feeds (web-wide monitoring), Twitter search URL feeds, subreddit URL feeds, Telegram channel URL feeds.
- **Polling:** Webhook-driven (preferred) or 15-min poll via `GET /v1/feeds/:id`.
- **Webhook receiver:** New endpoint at `POST /api/plugins/brandambassador/webhooks/rssapp`. Validates signature, parses items, runs scoring pipeline, stores to `trends:active`, emits `trends-updated` stream event.
- **Feed reconciliation:** When brand settings change, compute desired feeds vs existing feeds. Create/delete/update as needed.
- **Auth:** API key/secret in plugin secrets. Node.js SDK: `rss-generator-api`.
- **Cost:** ~$16.64/mo Developer plan (100 feeds, 15-min refresh, 10 webhooks, API access). Reads are free — only feed creation counts as an operation.

### Resilient HTTP Layer

Ported from MemecoinInvestor2026's `resilientHttp.ts`:
- Per-service circuit breakers (6 failures → 30s open)
- Configurable timeouts (8s default)
- Retry with exponential backoff
- Budget tracking per adapter (daily caps configurable per-tenant)

### Secrets Management

All API keys stored in Paperclip's existing `pluginSecrets` API:
- `TWEETAPI_API_KEY`
- `RSSAPP_API_KEY` + `RSSAPP_API_SECRET`
- `REDDIT_CLIENT_ID` + `REDDIT_CLIENT_SECRET` + `REDDIT_REFRESH_TOKEN`
- `TELEGRAM_BOT_TOKEN` + `TELEGRAM_CHANNEL_IDS`

Brand settings UI gets a new "Platform Connections" section for managing credentials.

---

## Part 2: Drag-and-Drop Kanban

### Library

`@dnd-kit/core` + `@dnd-kit/sortable` — modern React DnD library (~12KB), accessible, works with existing component architecture.

### Behavior

- Cards draggable between 4 columns (Draft, Review, Approved, Published)
- Visual drop targets highlight on valid columns during drag
- Drop triggers the **same `update-card-status` action** the V1 buttons use — identical logic, different input
- Status transition rules enforced: Draft→Review (creates Paperclip issue), Review→Draft (reject), Review→Approved, Approved→Published. Invalid drops snap back with explanatory toast.
- V1 button-based transitions **remain as fallback** in detail panel — drag-and-drop is additive
- Cards sortable within a column — order stored in plugin state

### Data Flow

```
User drags card from "Draft" → drops on "Review"
  → onDragEnd fires
    → Calls usePluginAction("update-card-status", { cardId, newStatus: "review" })
      → Same handler as V1 button click
        → Creates Paperclip issue, updates card, returns result
          → Kanban re-renders from updated usePluginData("pipeline")
```

No new bridge methods, no new action handlers.

---

## Part 3: Campaign Management

### Data Model

New `Campaign` entity in plugin state (`campaigns:list`):

```ts
interface Campaign {
  id: string;              // UUID
  name: string;            // "Q2 DeFi Launch"
  description?: string;
  targetPlatforms: Platform[];
  dateRange: { start: string; end: string };  // ISO dates
  status: "active" | "completed" | "draft";
  createdAt: string;
  updatedAt: string;
}
```

Content cards get a new field: `campaignId: string | null`. Null means "uncategorized."

### UI Changes

**Pipeline view:**
- Dropdown filter above kanban: "All Campaigns" | specific campaigns | "Uncategorized"
- Campaign summary bar: card counts by status, overall progress percentage
- Filtered kanban shows only cards in selected campaign

**Sidebar:**
- "Campaigns" subsection above brand context footer
- Active campaigns as compact cards with name, date range, progress
- "+ New Campaign" button opens creation form in detail panel
- Click campaign → selects as pipeline filter

**Create Workshop:**
- "Campaign" dropdown on "Create Post" — assign content at creation time
- Auto-selected if pipeline was filtered to a campaign when user clicked "+ New Post"

**Detail Panel:**
- Campaign badge on card detail (or "Uncategorized")
- Campaign reassignment dropdown

### Data/Action Handlers

- `usePluginData("campaigns")` — campaign list
- `usePluginAction("create-campaign")` — create
- `usePluginAction("update-campaign")` — edit
- `usePluginAction("delete-campaign")` — remove (cards become uncategorized)

### Agent Tool

`manage-campaign` tool: `action` = list | get | create | update | delete. Full CRUD with structured JSON responses.

---

## Part 4: Content Scheduling

### Data Model Changes

New fields on content cards:

```ts
scheduledAt: string | null;    // ISO datetime — when to publish
scheduledStatus: "pending" | "publishing" | "failed" | null;
```

Only cards in `status: "approved"` can be scheduled.

### Backend: Scheduled Publishing

The `queue-process` background job gets a scheduling check:

```
Every 60 seconds:
  → Query cards: status === "approved" AND scheduledAt <= now AND scheduledStatus === "pending"
    → For each: scheduledStatus = "publishing"
      → Call platform adapter publish() (if configured)
        → Success: status = "published", scheduledStatus = null, store platformPostRef
        → Failure: scheduledStatus = "failed", store error
```

If no platform adapter configured, card still transitions to "published" (V1 behavior).

### UI: Calendar View (Pipeline Tab Toggle)

**Toggle in Pipeline header:** `Board | Calendar`

**Calendar layout:**
- Month view grid with day cells
- Cards placed on `scheduledAt` date as compact pills (platform emoji + truncated topic)
- Click pill → opens detail panel
- Drag pill to different date → updates `scheduledAt`
- Color coding by platform
- "Ready to Schedule" tray below calendar for unscheduled approved cards
- Drag from tray onto date → sets `scheduledAt`
- Custom grid component (~150 lines) — avoids external dependency for a simple date grid with drop targets

### UI: Schedule Controls in Detail Panel

- Approved cards show "Schedule" section: date picker + time picker + "Schedule" button
- Scheduled cards show: scheduled time, countdown ("Publishes in 2h 15m"), "Unschedule" button
- Failed publishes: red warning with error + "Retry" button

### Pipeline Board Updates

- Scheduled cards show clock icon + formatted date/time
- Countdown badge when within 24 hours
- Scheduled cards sort to top of "Approved" column

### Agent Tool

`schedule-content` tool: `action` = schedule | unschedule | reschedule. Accepts `cardId` + `scheduledAt`.

---

## Part 5: Agent Parity Principle

**Every UI action has a corresponding programmatic API path.** Agents interact through the same action/data handlers the UI uses.

### Agent Tool Surface (All V2)

| Tool | Purpose | Key Actions |
|------|---------|-------------|
| `manage-campaign` | Campaign CRUD + listing | list, get, create, update, delete |
| `manage-pipeline` | Read pipeline state, move cards, filter | list, move, delete, with filters |
| `schedule-content` | Set/update/remove publish schedules | schedule, unschedule, reschedule |
| `read-engagement` | Get engagement metrics | by card, campaign, platform, date range |
| `read-trends` | Get scored trends with filters | by platform, score, keyword, velocity |
| `manage-variants` | A/B variant creation and comparison | create-variant, list, compare, pick-winner |
| `bulk-operations` | Batch actions on multiple cards | approve, reject, move, regenerate, assign-campaign |
| `read-analytics` | Query aggregated analytics data | by metric type, date range, groupBy |
| `manage-templates` | Template CRUD + application | list, get, create, apply |

### Design Rules

- Every tool returns structured JSON — no HTML, no "see the UI"
- List/query tools support filtering and pagination
- State-changing tools return the updated entity for verification
- Error responses include actionable context: `{ error: "cannot_schedule_draft", hint: "Move card to approved status first" }`

### Agent Orchestration Scenarios

**Autonomous content pipeline:**
```
Agent reads trends → picks high-scoring topic → generates caption → generates media
→ moderates → creates card in campaign → schedules for optimal time
```

**Engagement-driven optimization:**
```
Agent reads engagement → identifies top performer → creates variant
→ generates A/B alternatives → schedules both → reads engagement after 24h → reports winner
```

**Campaign management:**
```
Agent creates campaign → generates batch content → spreads across schedule
→ monitors engagement → adjusts remaining schedule
```

---

## Part 6: Platform Publishing

### Publishing Flow

```
Card reaches "published" status (manual, scheduled, or agent-driven)
  → Check platform adapter configured + healthy for card's platform
    → Yes: adapter.publish(payload) → store platformPostRef on card
    → No:  card still marked "published" (V1 behavior), platformPostRef = null
```

### Data Types

```ts
interface PublishPayload {
  caption: string;
  platform: Platform;
  mediaRef?: string;
  mediaType?: "image" | "video";
  threadSplit?: boolean;      // Twitter: auto-split >280 chars
  formatting?: "markdown" | "plain";  // Telegram: markdown
}

interface PublishResult {
  success: boolean;
  platformPostId: string;
  platformUrl: string;
  error?: string;
}

interface PlatformPostRef {
  platform: Platform;
  postId: string;
  url: string;
  publishedAt: string;
}
```

### Platform-Specific Formatting

**Twitter (TweetAPI.com):**
- ≤280 chars → single tweet
- >280 chars → thread (split on sentence boundaries)
- Media: upload via TweetAPI media endpoint, attach to first tweet

**Reddit:**
- Post to configured subreddit(s)
- Title: first line or topic field. Body: caption as markdown.
- Image posts via Reddit media endpoint. Link flair if configured.

**Telegram:**
- `sendPhoto` for image posts, `sendMessage` for text-only
- Markdown formatting
- Silent option for off-hours scheduling

### Content Card Changes

```ts
// New fields:
platformPostRef: PlatformPostRef | null;
publishError: string | null;
publishAttempts: number;
```

### UI Changes

**Detail Panel (published cards):**
- "View on Platform" link → opens `platformPostRef.url`
- Publish error: red banner + "Retry Publish" button
- No adapter configured: info banner "Platform not connected"

**Brand Settings — "Platform Connections" section:**
- Per-platform cards: Twitter, Reddit, Telegram
- Connection status, "Configure" button, credential form
- "Test Connection" button → calls `adapter.health()`
- Connected platforms show green checkmark in sidebar footer

### Multi-Platform Strategy

One card = one platform. Publishing same content to multiple platforms = multiple cards. Bulk operations and templates make this easy. Avoids partial-success states.

---

## Part 7: Real Trend Sources

### Architecture

Two data paths into the Discover view:

**Path 1: RSS.app (primary aggregation)**
- Keyword feeds, Twitter search feeds, subreddit feeds, Telegram channel feeds
- Webhook-driven with 15-min refresh
- Broad coverage, low cost

**Path 2: Direct platform adapters (supplemental)**
- Twitter adapter keyword search, Reddit hot posts
- On-demand (user refresh) or scheduled interval

### Feed Management

On brand settings save, `trend-scan` job reconciles RSS.app feeds:

```
Brand settings changed → compute desired feeds → compare to existing
  → Create new feeds for added keywords/platforms
  → Delete feeds for removed keywords/platforms
  → Update feed settings for changed filters
```

### Webhook Receiver

Uses BrandAmbassador's existing `http` capability to register an inbound webhook route on the plugin's HTTP namespace (no new host routes needed):

```
POST /api/plugins/brandambassador.marketing/webhooks/rssapp
  → Validate webhook signature (RSS.app includes HMAC in headers)
  → Parse feed items from webhook payload
  → Run trend scoring pipeline
  → Store scored items in plugin state "trends:active"
  → Emit "trends-updated" stream event (Discover view auto-refreshes)
```

### Trend Scoring Pipeline

Adapted from MemecoinInvestor2026's `socialSignalQuality.ts`:

```ts
interface ScoredTrend {
  id: string;
  title: string;
  description: string;
  url: string;
  platform: Platform | "web";
  score: number;                   // 0-100 composite
  sentiment: "positive" | "negative" | "neutral";
  velocity: "rising" | "stable" | "falling";
  firstSeen: string;
  lastUpdated: string;
  mentionCount: number;
  sourceFeeds: string[];
  dismissed: boolean;
}
```

**Scoring factors:** Recency (decay over 24h), velocity (rising frequency = boost), cross-source confirmation, relevance to brand settings, spam filtering + deduplication.

### Discover View UI Updates

- Filter bar adds: source filter (RSS.app, Twitter, Reddit, Web)
- Trend cards show: velocity indicator, mention count, source badges
- "Configure Sources" link → brand settings Platform Connections
- Empty state: "No trend sources configured. Add keywords and platforms in Brand Settings."

---

## Part 8: Real Engagement Data

### Engagement Polling

`engagement-check` background job runs every 30 minutes (configurable):

```
For each card: status === "published" AND platformPostRef !== null
  → adapter.getEngagement(platformPostRef)
  → Store snapshot in "engagement:history:{cardId}"
  → Update card's latest metrics
  → Check notification thresholds
```

### Data Model

```ts
interface EngagementMetrics {
  likes: number;
  comments: number;
  shares: number;
  impressions: number;
  platform: Platform;
  fetchedAt: string;
}

interface EngagementSnapshot {
  cardId: string;
  metrics: EngagementMetrics;
  timestamp: string;
}

interface EngagementAlerts {
  viralThreshold: number;          // e.g., 1000 likes
  engagementDropPercent: number;   // e.g., 50% drop in 24h
  enabled: boolean;
}
```

### Platform Metric Mapping

| Metric | Twitter | Reddit | Telegram |
|--------|---------|--------|----------|
| likes | favorite_count | ups | reaction count |
| comments | reply_count | num_comments | N/A (channels) |
| shares | retweet_count + quote_count | crossposts | forward count |
| impressions | impression_count | N/A | view count |

Missing fields default to `0`.

### Viral Detection

```
Compare latest metrics to previous snapshot
  → likes crossed viralThreshold → emit "engagement-alert" stream event
  → engagement dropped > threshold in 24h → emit alert
  → Alerts surface as: toast, Paperclip activity feed entry, agent tool response flags
```

### Monitor View UI Updates

- Real metrics with platform icons
- Trend indicators (up/down arrows since last poll)
- "View on Platform" link
- Sort: total engagement (default), recent growth, publish date
- Filter by platform
- Alert badges: fire icon (viral), warning icon (drop)

### Engagement Settings (in Brand Settings)

- Toggle alerts on/off
- Viral threshold (default: 500)
- Drop alert percentage (default: 50%)
- Poll interval override (default: 30 min)

### Graceful Degradation

- No `platformPostRef`: "No platform metrics — content not published to live platform"
- Adapter unhealthy: shows last known metrics with timestamp warning
- New publish: "Gathering metrics..." until first poll

---

## Part 9: Analytics Dashboard

### Sidebar Section

Analytics becomes the 5th sidebar section: Pipeline, Create, Discover, Monitor, **Analytics**.

### Chart.js Integration

`chart.js` + `react-chartjs-2`. Tree-shaken imports — only chart types and scales used.

### Dashboard Layout

2x2 grid (stacks single-column on narrow viewports), scrollable canvas:

**Card 1: Engagement Over Time (Line Chart)**
- X: dates. Y: total engagement. One line per platform.
- Date range selector: 7d / 30d / 90d / custom.
- Data: `engagement:history:*` aggregated by day.

**Card 2: Platform Comparison (Bar Chart)**
- Grouped bars per platform: likes, shares, comments.
- Data: sum of latest engagement across published cards by platform.

**Card 3: Agent vs Human Performance (Doughnut + Stats)**
- Doughnut: content % by source. Stat row: avg engagement per source.
- Data: pipeline cards by `source`, cross-referenced with engagement.

**Card 4: Content Type Breakdown (Horizontal Bar)**
- Bars: text-only, image, video. Length = avg engagement per type.
- Data: pipeline cards by `mediaType`, cross-referenced with engagement.

### Dashboard Header

- Date range picker (global)
- Campaign filter
- Export button (CSV download)

### Data Aggregation

`analytics` data handler computes aggregations server-side:

```ts
// usePluginData("analytics") params:
{
  dateRange: { start: string; end: string };
  campaignId?: string;
  groupBy: "day" | "week" | "platform" | "source" | "mediaType";
}
```

### Agent Tool

`read-analytics` returns same aggregated data the charts consume. Agents use this for data-driven content decisions.

---

## Part 10: Content Templates

### Data Model

```ts
interface ContentTemplate {
  id: string;
  name: string;                // "DeFi Alpha Thread"
  description?: string;
  platform: Platform;
  variables: TemplateVariable[];
  captionTemplate: string;     // "{{topic}} is changing {{audience}}'s game..."
  tone?: string;
  mediaPrompt?: string;
  toolChain?: string[];        // suggested tool order
  createdFrom?: string;        // cardId saved from
  useCount: number;
  createdAt: string;
  updatedAt: string;
}

interface TemplateVariable {
  key: string;           // "topic"
  label: string;         // "Topic"
  type: "text" | "select";
  options?: string[];
  defaultValue?: string; // from brand settings
}
```

Stored in plugin state `templates:list`.

### Creating Templates

**From a successful post:** "Save as Template" in detail panel. Extracts caption → converts values to `{{variables}}`. User names and reviews before saving.

**From scratch:** "Templates" tab in Create Workshop tool palette. Form: name, platform, caption template with variable builder, optional media prompt, suggested tool chain.

### Using Templates

**UI:** Templates tab shows library as cards. Click → variable fill form → "Apply Template" → auto-populates tool chain. User can modify before running.

**Agents:** `manage-templates` tool with actions: list, get, apply, create. `apply` returns resolved caption + parameters for tool chain execution.

### Template Resolution

```
Template: "🔥 {{topic}} is changing the game for {{audience}}..."
Variables: { topic: "ETH staking", audience: "DeFi degens" }
Resolved: "🔥 ETH staking is changing the game for DeFi degens..."
```

---

## Part 11: Bulk Operations

### Selection Model

- Checkbox on each card (visible on hover, always visible in selection mode)
- "Select Mode" toggle in Pipeline header
- Shift+click range select, "Select All in Column" per column header
- Selection count badge: "4 selected"

### Bulk Action Bar

Floating bar at canvas bottom when cards selected:

```
[ 4 selected | Approve | Reject | Move to ▼ | Regenerate ▼ | Assign Campaign ▼ | Deselect All ]
```

**Actions:**
- **Approve** — selected review cards → approved
- **Reject** — selected review cards → draft
- **Move to** — dropdown with status options. Invalid transitions skipped.
- **Regenerate** — tool picker dropdown. Runs selected tool(s) on each card. Progress: "Regenerating 2/4..."
- **Assign Campaign** — dropdown of campaigns + "Uncategorized"

### Execution

Sequential per card (avoids overwhelming adapters/ComfyUI):

```ts
interface BulkResult {
  total: number;
  succeeded: number;
  failed: number;
  skipped: number;
  details: { cardId: string; status: "ok" | "failed" | "skipped"; reason?: string }[];
}
```

Toast summary on completion.

### Agent Tool

`bulk-operations`: accepts `action`, `cardIds[]`, `targetStatus?`, `toolsToRerun?[]`, `campaignId?`. Returns `BulkResult`.

---

## Part 12: A/B Variant Testing

### Data Model

```ts
interface VariantGroup {
  id: string;
  sourceCardId: string;
  topic: string;
  variantCardIds: string[];  // 2-3 cards
  winnerCardId?: string;
  createdAt: string;
}

// New fields on ContentCard:
variantGroupId: string | null;
variantLabel: string | null;  // "A", "B", "C"
```

Stored in plugin state `variants:groups`. Maximum 3 variants per group.

### Creating Variants

**From detail panel:** "Create Variant" on Draft/Review cards → Create Workshop pre-filled → new card linked to variant group.

**From Create Workshop:** After creating a post, toast offers "Create a variant?" → pre-filled creation.

**By agent:** `manage-variants` with `action: "create-variant"` + `sourceCardId` + modified parameters.

### Pipeline UI

- Variant group connector bar (colored left edge, same color per group)
- Variant label badge: "A", "B", "C"
- Hover highlights all group members across columns
- Filter: "Show Variant Groups" collapses non-variant cards

### Comparison View

Side-by-side cards in main canvas (replaces kanban temporarily):
- Caption, media preview, platform, tone, moderation score per variant
- Engagement metrics for published variants
- "Pick Winner" button → sets `winnerCardId`, winner gets crown badge
- "Back to Pipeline" returns to kanban

### Agent Tool

`manage-variants`: create-variant, list, compare, pick-winner. Compare returns all variant cards with engagement side-by-side.

---

## Part 13: V1 Bug Fixes

### Bug 1: React Key Warning (Medium)

**File:** `BrandAmbassador/ui/pages/marketing/Discover.tsx:101`
**Current:** `key={`${trend.title}-${i}`}` (index-based)
**Fix:** `key={trend.id}` — V2's `ScoredTrend` model has stable IDs.

### Bug 2: Brand Voice Sidebar Refresh (Low)

**File:** `BrandAmbassador/ui/pages/marketing/Sidebar.tsx:83-87`
**Root cause:** `refreshBrand()` races with state write propagation.
**Fix:** `saveBrand` action returns saved settings in response. UI optimistically updates from response instead of re-fetching.

### Bug 3: Generation Progress Streaming (Medium)

**Host side:** SSE endpoint works. **Gap:** Plugin worker never emits events.
**Fix:** In `execute-tool` action handler, when running `generate-media` or `generate-post`:
- Emit `{ stage: "queued" }` on start
- Poll ComfyUI `/prompt` status endpoint for progress
- Emit `{ stage: "generating", progress: 0.0-1.0 }` during generation
- Emit `{ stage: "complete", outputFile: "..." }` on finish
- Emit `{ stage: "error", message: "..." }` on failure

Uses existing `streamBus` — no host changes.

---

## Part 14: Data Flow & State

### New Plugin State Keys

| Key | Data | Access |
|-----|------|--------|
| `campaigns:list` | Campaign[] | `usePluginData("campaigns")` |
| `templates:list` | ContentTemplate[] | `usePluginData("templates")` |
| `variants:groups` | VariantGroup[] | `usePluginData("variants")` |
| `trends:feeds` | RSS.app feed IDs + metadata | Internal (feed reconciliation) |
| `trends:active` | ScoredTrend[] | `usePluginData("trends")` (enhanced) |
| `engagement:history:{cardId}` | EngagementSnapshot[] | `usePluginData("analytics")` (aggregated) |
| `engagement:alerts` | EngagementAlerts | Brand settings subsection |

### Content Card Field Additions (V2)

```ts
// Added to existing ContentCard:
campaignId: string | null;
scheduledAt: string | null;
scheduledStatus: "pending" | "publishing" | "failed" | null;
platformPostRef: PlatformPostRef | null;
publishError: string | null;
publishAttempts: number;
variantGroupId: string | null;
variantLabel: string | null;
```

### New Real-Time Streams

| Channel | Purpose | Consumer |
|---------|---------|----------|
| `engagement-alert` | Viral/drop threshold notifications | Monitor view toast |
| `schedule-fired` | Card auto-published by scheduler | Pipeline view refresh |

Added to existing V1 streams (`generation-progress`, `comfyui-status`, `trends-updated`, `content-published`).

---

## Part 15: External Service Summary

| Service | Purpose | Cost | Auth |
|---------|---------|------|------|
| TweetAPI.com | Twitter read/write/engagement | ~$17/mo | API key |
| RSS.app | Cross-platform trend aggregation | ~$16.64/mo | API key + secret |
| Reddit public JSON | Reddit reading (trends, engagement) | Free | None |
| Reddit OAuth | Reddit posting | Free | Client ID + secret + refresh token |
| Telegram Bot API | Telegram publish + engagement | Free | Bot token |
| ComfyUI | Media generation (existing) | Self-hosted | Local API |

**Total external service cost: ~$34/mo**

---

## Part 16: V3 Roadmap (Captured for Future)

### 1. A/B Testing Auto-Learning
- Automatic winner detection after configurable threshold (N hours or N impressions)
- Statistical significance calculation (minimum sample size before declaring winner)
- Pattern extraction: identify what winning variants have in common (tone, length, media type, posting time)
- Suggested brand setting updates based on winning patterns ("Your 'witty' tone posts get 2.3x more engagement — consider making this your default")
- Historical win/loss tracking per pattern for long-term learning
- Agent tool: `optimize-brand-settings` reads pattern history, proposes updates

### 2. Advanced Scheduling Intelligence
- Optimal posting time suggestions based on engagement history
- Agent-driven schedule optimization: auto-spread to avoid flooding
- Timezone-aware scheduling for multi-region audiences

### 3. Cross-Campaign Analytics
- Campaign comparison charts
- ROI tracking if cost data available
- Automated campaign retrospective summaries

### 4. Content Versioning
- Full edit history on cards
- Diff view between versions
- Rollback to previous version
