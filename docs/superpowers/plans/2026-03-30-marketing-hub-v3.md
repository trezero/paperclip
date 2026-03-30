# Marketing Hub V3 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the 4 V3 roadmap features for the Marketing Hub — A/B testing auto-learning with statistical significance, advanced scheduling intelligence with optimal-time recommendations, cross-campaign analytics with ROI tracking, and full content versioning with diff and rollback.

**Architecture:** Layer-by-layer approach. Phase 0 adds shared V3 types, a statistics utility module, and an engagement aggregation service. Phase 1 implements content versioning (independent of other features). Phase 2 builds A/B auto-learning on top of the existing variant infrastructure. Phase 3 adds scheduling intelligence using engagement history. Phase 4 creates cross-campaign analytics with comparison and ROI. Phase 5 wires new agent tools and registers V3 handlers. Phase 6 verifies everything compiles and passes.

**Tech Stack:** TypeScript, React 19, Chart.js + react-chartjs-2 (existing), Paperclip Plugin SDK (`usePluginData`, `usePluginAction`), `diff` npm package (content diffing). All V3 features extend the existing V2 handler/data/action patterns — no new frameworks.

**Spec:** `docs/superpowers/specs/2026-03-29-marketing-hub-v2-design.md` Part 16

**Plugin workspace:** `/home/winadmin/projects/BrandAmbassador/`

---

## File Structure

### New Files (BrandAmbassador plugin)

```
src/services/
  statistics.ts              — Statistical significance calculator (chi-squared, confidence intervals, minimum sample size)
  engagementAggregator.ts    — Time-bucketed engagement aggregation, audience pattern detection, peak-time analysis
  contentHistory.ts          — Version snapshot storage, diff computation, rollback logic
  patternExtractor.ts        — Winning variant pattern extraction (tone, length, media type, posting time correlations)
  scheduleOptimizer.ts       — Optimal posting time recommendations, auto-spread algorithm, timezone-aware scheduling

ui/pages/marketing/
  ContentHistory.tsx         — Version history panel with diff view and rollback button
  CampaignComparison.tsx     — Side-by-side campaign comparison charts (line + bar)
  ScheduleRecommendations.tsx — Optimal time suggestions panel, auto-spread preview

tests/
  services/
    statistics.test.ts       — Chi-squared, sample size, confidence interval tests
    engagementAggregator.test.ts — Bucketing, peak detection, pattern tests
    contentHistory.test.ts   — Snapshot, diff, rollback tests
    patternExtractor.test.ts — Pattern extraction from variant wins
    scheduleOptimizer.test.ts — Optimal time, spread, timezone tests
  handlers/
    contentHistory.test.ts   — Content history handler tests
    autoWinner.test.ts       — Auto-winner detection handler tests
    scheduleIntelligence.test.ts — Schedule intelligence handler tests
    campaignComparison.test.ts   — Cross-campaign comparison handler tests
```

### Modified Files

```
src/constants.ts            — Add V3 data keys, action keys, tool names, state keys
ui/pages/marketing/types.ts — Add ContentVersion, WinPattern, AudiencePattern, CampaignComparison, ScheduleRecommendation types
src/handlers/actions.ts     — Add: content-history, auto-pick-winner, suggest-schedule, compare-campaigns, optimize-brand-settings actions
src/handlers/data.ts        — Add: content-history, audience-patterns, campaign-comparison, schedule-recommendations data handlers
src/manifest.ts             — Add optimize-brand-settings agent tool
src/worker.ts               — Register V3 handlers, initialize services
src/jobs/engagement-check.ts — Add audience pattern aggregation after engagement polling
ui/pages/marketing/DetailPanel.tsx   — Add version history tab, schedule recommendation display
ui/pages/marketing/VariantComparison.tsx — Add auto-winner badge, significance indicator, pattern insights
ui/pages/marketing/Analytics.tsx     — Add campaign comparison tab, ROI columns
ui/pages/marketing/Calendar.tsx      — Add optimal time highlights, timezone selector
package.json                — Add: diff (content diffing)
```

---

## Phase 0: Foundation Types & Services

### Task 1: V3 Types and Constants

**Files:**
- Modify: `ui/pages/marketing/types.ts`
- Modify: `src/constants.ts`

- [ ] **Step 1: Add V3 types to types.ts**

Append these interfaces to `ui/pages/marketing/types.ts`:

```typescript
// ── V3: Content Versioning ──────────────────────────────────────────────────

export interface ContentVersion {
  id: string;
  cardId: string;
  caption: string;
  mediaRef?: string;
  mediaType?: "image" | "video";
  moderationScore?: number;
  reason: string; // "manual-edit" | "regenerate" | "template-apply" | "rollback"
  createdAt: string;
  createdBy: "human" | "agent";
}

// ── V3: A/B Auto-Learning ───────────────────────────────────────────────────

export interface SignificanceResult {
  isSignificant: boolean;
  confidence: number; // 0-1
  sampleSizeAdequate: boolean;
  minimumSampleNeeded: number;
  winnerCardId: string | null;
  scores: Record<string, number>; // cardId → composite engagement score
}

export interface WinPattern {
  id: string;
  dimension: "tone" | "length" | "mediaType" | "postingHour" | "platform";
  winningValue: string;
  winRate: number; // 0-1
  sampleSize: number;
  confidence: number;
  discoveredAt: string;
}

export interface BrandOptimizationSuggestion {
  id: string;
  pattern: WinPattern;
  currentValue: string;
  suggestedValue: string;
  expectedLift: string; // e.g. "2.3x more engagement"
  status: "pending" | "accepted" | "dismissed";
  createdAt: string;
}

// ── V3: Scheduling Intelligence ─────────────────────────────────────────────

export interface AudiencePattern {
  platform: Platform;
  dayOfWeek: number; // 0=Sunday, 6=Saturday
  hourUtc: number; // 0-23
  avgEngagement: number;
  postCount: number;
}

export interface ScheduleRecommendation {
  cardId: string;
  platform: Platform;
  suggestedTimes: Array<{
    datetime: string; // ISO 8601
    score: number; // 0-1 relative quality
    reason: string; // e.g. "Peak engagement hour for Twitter"
  }>;
  avoidTimes: Array<{
    datetime: string;
    reason: string; // e.g. "3 posts already scheduled within 2 hours"
  }>;
}

export interface TimezoneRegion {
  name: string; // e.g. "US East", "EU West"
  timezone: string; // e.g. "America/New_York"
  weight: number; // 0-1, audience fraction
}

// ── V3: Cross-Campaign Analytics ────────────────────────────────────────────

export interface CampaignComparisonData {
  campaigns: Array<{
    campaignId: string;
    campaignName: string;
    metrics: {
      totalPosts: number;
      totalLikes: number;
      totalComments: number;
      totalShares: number;
      totalImpressions: number;
      avgEngagementRate: number;
      costPerEngagement?: number;
    };
    dailyMetrics: Array<{
      date: string;
      likes: number;
      comments: number;
      shares: number;
      impressions: number;
    }>;
  }>;
}

export interface CampaignRetrospective {
  campaignId: string;
  campaignName: string;
  dateRange: { start: string; end: string };
  summary: string;
  topPerformingPosts: Array<{ cardId: string; topic: string; totalEngagement: number }>;
  platformBreakdown: Record<string, { posts: number; avgEngagement: number }>;
  winningPatterns: WinPattern[];
}
```

- [ ] **Step 2: Add V3 constants**

Add to `src/constants.ts`:

```typescript
// Inside TOOL_NAMES, add:
  optimizeBrandSettings: "optimize-brand-settings",

// Inside STATE_KEYS, add:
  contentHistory: "content-history", // per-card: content-history:{cardId}
  audiencePatterns: "audience-patterns",
  winPatterns: "win-patterns",
  brandSuggestions: "brand-suggestions",
  campaignCosts: "campaign-costs",

// Inside DATA_KEYS, add:
  contentHistory: "content-history",
  audiencePatterns: "audience-patterns",
  campaignComparison: "campaign-comparison",
  scheduleRecommendations: "schedule-recommendations",
  brandSuggestions: "brand-suggestions",

// Inside ACTION_KEYS, add:
  saveContentVersion: "save-content-version",
  rollbackContent: "rollback-content",
  autoPickWinner: "auto-pick-winner",
  suggestSchedule: "suggest-schedule",
  autoSpreadSchedule: "auto-spread-schedule",
  compareCampaigns: "compare-campaigns",
  generateRetrospective: "generate-retrospective",
  optimizeBrandSettings: "optimize-brand-settings",
  acceptBrandSuggestion: "accept-brand-suggestion",
  dismissBrandSuggestion: "dismiss-brand-suggestion",
  setCampaignCost: "set-campaign-cost",

// Add helper:
export const contentHistoryKey = (cardId: string) => `content-history:${cardId}`;
```

- [ ] **Step 3: Commit**

```bash
git add ui/pages/marketing/types.ts src/constants.ts
git commit -m "feat(v3): add V3 types and constants for versioning, auto-learning, scheduling, analytics"
```

---

### Task 2: Statistics Utility

**Files:**
- Create: `src/services/statistics.ts`
- Create: `tests/services/statistics.test.ts`

- [ ] **Step 1: Write failing tests for statistics module**

Create `tests/services/statistics.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import {
  chiSquaredSignificance,
  computeCompositeScore,
  isMinimumSampleMet,
  evaluateVariantGroup,
} from "../../src/services/statistics.js";

describe("statistics", () => {
  describe("computeCompositeScore", () => {
    it("weights likes, comments, shares, impressions", () => {
      const score = computeCompositeScore({
        likes: 100,
        comments: 50,
        shares: 30,
        impressions: 10000,
      });
      // likes*1 + comments*2 + shares*3 + impressions*0.01 = 100+100+90+100 = 390
      expect(score).toBe(390);
    });

    it("returns 0 for empty metrics", () => {
      expect(computeCompositeScore({ likes: 0, comments: 0, shares: 0, impressions: 0 })).toBe(0);
    });
  });

  describe("isMinimumSampleMet", () => {
    it("returns true when impressions exceed minimum", () => {
      expect(isMinimumSampleMet(1000, 100)).toBe(true);
    });

    it("returns false when impressions below minimum", () => {
      expect(isMinimumSampleMet(50, 100)).toBe(false);
    });

    it("uses default minimum of 200", () => {
      expect(isMinimumSampleMet(199)).toBe(false);
      expect(isMinimumSampleMet(200)).toBe(true);
    });
  });

  describe("chiSquaredSignificance", () => {
    it("detects significant difference between variant engagement rates", () => {
      // Variant A: 200 engagements out of 1000 impressions (20%)
      // Variant B: 300 engagements out of 1000 impressions (30%)
      const result = chiSquaredSignificance(
        [{ engagements: 200, impressions: 1000 }, { engagements: 300, impressions: 1000 }],
      );
      expect(result.isSignificant).toBe(true);
      expect(result.confidence).toBeGreaterThan(0.95);
    });

    it("returns not significant for similar rates", () => {
      const result = chiSquaredSignificance(
        [{ engagements: 200, impressions: 1000 }, { engagements: 205, impressions: 1000 }],
      );
      expect(result.isSignificant).toBe(false);
    });

    it("handles three variants", () => {
      const result = chiSquaredSignificance([
        { engagements: 100, impressions: 1000 },
        { engagements: 300, impressions: 1000 },
        { engagements: 150, impressions: 1000 },
      ]);
      expect(result.isSignificant).toBe(true);
    });
  });

  describe("evaluateVariantGroup", () => {
    it("returns winner when significant", () => {
      const variants = [
        { cardId: "a", metrics: { likes: 50, comments: 20, shares: 10, impressions: 1000 } },
        { cardId: "b", metrics: { likes: 150, comments: 60, shares: 30, impressions: 1000 } },
      ];
      const result = evaluateVariantGroup(variants);
      expect(result.isSignificant).toBe(true);
      expect(result.winnerCardId).toBe("b");
      expect(result.sampleSizeAdequate).toBe(true);
    });

    it("returns null winner when not significant", () => {
      const variants = [
        { cardId: "a", metrics: { likes: 50, comments: 20, shares: 10, impressions: 100 } },
        { cardId: "b", metrics: { likes: 52, comments: 21, shares: 10, impressions: 100 } },
      ];
      const result = evaluateVariantGroup(variants);
      expect(result.winnerCardId).toBeNull();
    });

    it("reports inadequate sample size", () => {
      const variants = [
        { cardId: "a", metrics: { likes: 5, comments: 2, shares: 1, impressions: 30 } },
        { cardId: "b", metrics: { likes: 15, comments: 6, shares: 3, impressions: 30 } },
      ];
      const result = evaluateVariantGroup(variants);
      expect(result.sampleSizeAdequate).toBe(false);
      expect(result.minimumSampleNeeded).toBe(200);
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /home/winadmin/projects/BrandAmbassador && npx vitest run tests/services/statistics.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement statistics module**

Create `src/services/statistics.ts`:

```typescript
/**
 * Statistical significance utilities for A/B variant testing.
 *
 * Uses chi-squared test for proportional data (engagement rate per variant).
 * Composite scoring weights: likes*1, comments*2, shares*3, impressions*0.01.
 */

export interface VariantMetrics {
  likes: number;
  comments: number;
  shares: number;
  impressions: number;
}

export interface VariantInput {
  cardId: string;
  metrics: VariantMetrics;
}

export interface ChiSquaredInput {
  engagements: number;
  impressions: number;
}

export interface ChiSquaredResult {
  isSignificant: boolean;
  confidence: number;
  chiSquared: number;
}

export interface EvaluationResult {
  isSignificant: boolean;
  confidence: number;
  sampleSizeAdequate: boolean;
  minimumSampleNeeded: number;
  winnerCardId: string | null;
  scores: Record<string, number>;
}

const COMPOSITE_WEIGHTS = { likes: 1, comments: 2, shares: 3, impressions: 0.01 };
const DEFAULT_MIN_SAMPLE = 200;
// Chi-squared critical values for p < 0.05 by degrees of freedom (df 1-5)
const CHI_SQUARED_CRITICAL: Record<number, number> = { 1: 3.841, 2: 5.991, 3: 7.815, 4: 9.488, 5: 11.07 };

export function computeCompositeScore(m: VariantMetrics): number {
  return (
    m.likes * COMPOSITE_WEIGHTS.likes +
    m.comments * COMPOSITE_WEIGHTS.comments +
    m.shares * COMPOSITE_WEIGHTS.shares +
    m.impressions * COMPOSITE_WEIGHTS.impressions
  );
}

export function isMinimumSampleMet(impressions: number, minimum: number = DEFAULT_MIN_SAMPLE): boolean {
  return impressions >= minimum;
}

export function chiSquaredSignificance(variants: ChiSquaredInput[]): ChiSquaredResult {
  const n = variants.length;
  if (n < 2) return { isSignificant: false, confidence: 0, chiSquared: 0 };

  const totalEngagements = variants.reduce((s, v) => s + v.engagements, 0);
  const totalImpressions = variants.reduce((s, v) => s + v.impressions, 0);

  if (totalImpressions === 0) return { isSignificant: false, confidence: 0, chiSquared: 0 };

  const overallRate = totalEngagements / totalImpressions;

  let chiSq = 0;
  for (const v of variants) {
    const expectedEngaged = v.impressions * overallRate;
    const expectedNotEngaged = v.impressions * (1 - overallRate);

    if (expectedEngaged > 0) {
      chiSq += Math.pow(v.engagements - expectedEngaged, 2) / expectedEngaged;
    }
    if (expectedNotEngaged > 0) {
      const notEngaged = v.impressions - v.engagements;
      chiSq += Math.pow(notEngaged - expectedNotEngaged, 2) / expectedNotEngaged;
    }
  }

  const df = n - 1;
  const critical = CHI_SQUARED_CRITICAL[df] ?? CHI_SQUARED_CRITICAL[5]!;
  const isSignificant = chiSq >= critical;

  // Approximate confidence from chi-squared value relative to critical
  const confidence = isSignificant ? Math.min(0.99, 0.95 + (chiSq - critical) / (critical * 10)) : Math.min(0.95, chiSq / critical * 0.95);

  return { isSignificant, confidence, chiSquared: chiSq };
}

export function evaluateVariantGroup(variants: VariantInput[]): EvaluationResult {
  const scores: Record<string, number> = {};
  for (const v of variants) {
    scores[v.cardId] = computeCompositeScore(v.metrics);
  }

  const allAdequate = variants.every((v) => isMinimumSampleMet(v.metrics.impressions));

  const chiInput: ChiSquaredInput[] = variants.map((v) => ({
    engagements: v.metrics.likes + v.metrics.comments + v.metrics.shares,
    impressions: v.metrics.impressions,
  }));

  const chiResult = chiSquaredSignificance(chiInput);

  let winnerCardId: string | null = null;
  if (chiResult.isSignificant) {
    // Winner is the variant with highest composite score
    let maxScore = -1;
    for (const [cardId, score] of Object.entries(scores)) {
      if (score > maxScore) {
        maxScore = score;
        winnerCardId = cardId;
      }
    }
  }

  return {
    isSignificant: chiResult.isSignificant,
    confidence: chiResult.confidence,
    sampleSizeAdequate: allAdequate,
    minimumSampleNeeded: DEFAULT_MIN_SAMPLE,
    winnerCardId,
    scores,
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd /home/winadmin/projects/BrandAmbassador && npx vitest run tests/services/statistics.test.ts`
Expected: All 9 tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/services/statistics.ts tests/services/statistics.test.ts
git commit -m "feat(v3): add statistics utility with chi-squared significance and composite scoring"
```

---

### Task 3: Engagement Aggregation Service

**Files:**
- Create: `src/services/engagementAggregator.ts`
- Create: `tests/services/engagementAggregator.test.ts`

- [ ] **Step 1: Write failing tests for engagement aggregator**

Create `tests/services/engagementAggregator.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import {
  buildAudiencePatterns,
  findPeakHours,
  detectFatiguePeriods,
} from "../../src/services/engagementAggregator.js";
import type { AudiencePattern } from "../../ui/pages/marketing/types.js";

describe("engagementAggregator", () => {
  describe("buildAudiencePatterns", () => {
    it("aggregates engagement by platform, day, hour", () => {
      const posts = [
        {
          platform: "twitter",
          publishedAt: "2026-03-25T14:00:00Z", // Tuesday 14:00 UTC
          engagement: { likes: 100, comments: 20, shares: 10, impressions: 1000 },
        },
        {
          platform: "twitter",
          publishedAt: "2026-03-25T14:30:00Z", // Tuesday 14:00 UTC (same hour)
          engagement: { likes: 200, comments: 40, shares: 20, impressions: 2000 },
        },
      ];
      const patterns = buildAudiencePatterns(posts);
      const twitterTuesday14 = patterns.find(
        (p) => p.platform === "twitter" && p.dayOfWeek === 2 && p.hourUtc === 14,
      );
      expect(twitterTuesday14).toBeDefined();
      expect(twitterTuesday14!.avgEngagement).toBe(195); // (130+260)/2
      expect(twitterTuesday14!.postCount).toBe(2);
    });

    it("returns empty for no posts", () => {
      expect(buildAudiencePatterns([])).toEqual([]);
    });

    it("handles multiple platforms separately", () => {
      const posts = [
        {
          platform: "twitter",
          publishedAt: "2026-03-25T10:00:00Z",
          engagement: { likes: 50, comments: 10, shares: 5, impressions: 500 },
        },
        {
          platform: "reddit",
          publishedAt: "2026-03-25T10:00:00Z",
          engagement: { likes: 100, comments: 20, shares: 10, impressions: 1000 },
        },
      ];
      const patterns = buildAudiencePatterns(posts);
      const twitter = patterns.filter((p) => p.platform === "twitter");
      const reddit = patterns.filter((p) => p.platform === "reddit");
      expect(twitter.length).toBe(1);
      expect(reddit.length).toBe(1);
      expect(twitter[0]!.avgEngagement).not.toBe(reddit[0]!.avgEngagement);
    });
  });

  describe("findPeakHours", () => {
    it("returns top N hours by avg engagement", () => {
      const patterns: AudiencePattern[] = [
        { platform: "twitter", dayOfWeek: 1, hourUtc: 9, avgEngagement: 50, postCount: 5 },
        { platform: "twitter", dayOfWeek: 1, hourUtc: 14, avgEngagement: 200, postCount: 5 },
        { platform: "twitter", dayOfWeek: 1, hourUtc: 20, avgEngagement: 150, postCount: 5 },
        { platform: "twitter", dayOfWeek: 2, hourUtc: 10, avgEngagement: 120, postCount: 5 },
      ];
      const peaks = findPeakHours(patterns, "twitter", 2);
      expect(peaks).toHaveLength(2);
      expect(peaks[0]!.hourUtc).toBe(14);
      expect(peaks[1]!.hourUtc).toBe(20);
    });

    it("filters by platform", () => {
      const patterns: AudiencePattern[] = [
        { platform: "twitter", dayOfWeek: 1, hourUtc: 14, avgEngagement: 200, postCount: 5 },
        { platform: "reddit", dayOfWeek: 1, hourUtc: 14, avgEngagement: 300, postCount: 5 },
      ];
      const peaks = findPeakHours(patterns, "twitter", 5);
      expect(peaks).toHaveLength(1);
      expect(peaks[0]!.platform).toBe("twitter");
    });
  });

  describe("detectFatiguePeriods", () => {
    it("flags time windows with too many scheduled posts", () => {
      const scheduled = [
        { scheduledAt: "2026-03-25T14:00:00Z", platform: "twitter" },
        { scheduledAt: "2026-03-25T14:30:00Z", platform: "twitter" },
        { scheduledAt: "2026-03-25T15:00:00Z", platform: "twitter" },
      ];
      const fatigue = detectFatiguePeriods(scheduled, "twitter", 2); // max 2 per 2-hour window
      expect(fatigue.length).toBeGreaterThan(0);
      expect(fatigue[0]!.reason).toContain("posts already scheduled");
    });

    it("returns empty when under threshold", () => {
      const scheduled = [
        { scheduledAt: "2026-03-25T14:00:00Z", platform: "twitter" },
      ];
      const fatigue = detectFatiguePeriods(scheduled, "twitter", 2);
      expect(fatigue).toEqual([]);
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /home/winadmin/projects/BrandAmbassador && npx vitest run tests/services/engagementAggregator.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement engagement aggregator**

Create `src/services/engagementAggregator.ts`:

```typescript
import type { AudiencePattern, Platform } from "../../ui/pages/marketing/types.js";
import { computeCompositeScore } from "./statistics.js";

interface PostData {
  platform: string;
  publishedAt: string;
  engagement: { likes: number; comments: number; shares: number; impressions: number };
}

interface ScheduledPost {
  scheduledAt: string;
  platform: string;
}

interface FatiguePeriod {
  datetime: string;
  reason: string;
}

/**
 * Aggregate historical engagement data into audience patterns.
 * Groups by (platform, dayOfWeek, hourUtc) and computes average engagement.
 */
export function buildAudiencePatterns(posts: PostData[]): AudiencePattern[] {
  if (posts.length === 0) return [];

  const buckets = new Map<string, { total: number; count: number; platform: string; dow: number; hour: number }>();

  for (const post of posts) {
    const dt = new Date(post.publishedAt);
    const dow = dt.getUTCDay();
    const hour = dt.getUTCHours();
    const key = `${post.platform}:${dow}:${hour}`;

    const score = computeCompositeScore({
      likes: post.engagement.likes,
      comments: post.engagement.comments,
      shares: post.engagement.shares,
      impressions: post.engagement.impressions,
    });

    const bucket = buckets.get(key);
    if (bucket) {
      bucket.total += score;
      bucket.count += 1;
    } else {
      buckets.set(key, { total: score, count: 1, platform: post.platform, dow, hour });
    }
  }

  const patterns: AudiencePattern[] = [];
  for (const b of buckets.values()) {
    patterns.push({
      platform: b.platform as Platform,
      dayOfWeek: b.dow,
      hourUtc: b.hour,
      avgEngagement: Math.round(b.total / b.count),
      postCount: b.count,
    });
  }

  return patterns;
}

/**
 * Return the top N peak hours for a given platform, sorted by avg engagement descending.
 */
export function findPeakHours(
  patterns: AudiencePattern[],
  platform: string,
  topN: number,
): AudiencePattern[] {
  return patterns
    .filter((p) => p.platform === platform)
    .sort((a, b) => b.avgEngagement - a.avgEngagement)
    .slice(0, topN);
}

/**
 * Detect time windows where scheduling another post would exceed the
 * fatigue threshold (too many posts in a 2-hour window for same platform).
 */
export function detectFatiguePeriods(
  scheduled: ScheduledPost[],
  platform: string,
  maxPerWindow: number,
  windowHours: number = 2,
): FatiguePeriod[] {
  const platformPosts = scheduled
    .filter((s) => s.platform === platform)
    .map((s) => new Date(s.scheduledAt).getTime())
    .sort((a, b) => a - b);

  const windowMs = windowHours * 60 * 60 * 1000;
  const fatigue: FatiguePeriod[] = [];
  const seen = new Set<string>();

  for (let i = 0; i < platformPosts.length; i++) {
    const windowStart = platformPosts[i]!;
    const windowEnd = windowStart + windowMs;
    const count = platformPosts.filter((t) => t >= windowStart && t <= windowEnd).length;

    if (count > maxPerWindow) {
      const key = new Date(windowStart).toISOString().slice(0, 13); // dedup by hour
      if (!seen.has(key)) {
        seen.add(key);
        fatigue.push({
          datetime: new Date(windowStart).toISOString(),
          reason: `${count} posts already scheduled within ${windowHours}-hour window`,
        });
      }
    }
  }

  return fatigue;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd /home/winadmin/projects/BrandAmbassador && npx vitest run tests/services/engagementAggregator.test.ts`
Expected: All 6 tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/services/engagementAggregator.ts tests/services/engagementAggregator.test.ts
git commit -m "feat(v3): add engagement aggregation with audience patterns and fatigue detection"
```

---

### Task 4: Content History Service

**Files:**
- Create: `src/services/contentHistory.ts`
- Create: `tests/services/contentHistory.test.ts`

- [ ] **Step 1: Write failing tests for content history**

Create `tests/services/contentHistory.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import {
  createSnapshot,
  computeDiff,
  applyRollback,
} from "../../src/services/contentHistory.js";

describe("contentHistory", () => {
  describe("createSnapshot", () => {
    it("captures card state into a version snapshot", () => {
      const card = {
        id: "card-1",
        caption: "Hello world",
        mediaRef: "img.png",
        mediaType: "image" as const,
        moderationScore: 0.9,
      };
      const snap = createSnapshot(card, "manual-edit", "human");
      expect(snap.cardId).toBe("card-1");
      expect(snap.caption).toBe("Hello world");
      expect(snap.mediaRef).toBe("img.png");
      expect(snap.reason).toBe("manual-edit");
      expect(snap.createdBy).toBe("human");
      expect(snap.id).toBeTruthy();
      expect(snap.createdAt).toBeTruthy();
    });
  });

  describe("computeDiff", () => {
    it("returns line-level diff between two captions", () => {
      const diff = computeDiff("Hello world", "Hello beautiful world");
      expect(diff.length).toBeGreaterThan(0);
      expect(diff.some((d) => d.type === "removed")).toBe(true);
      expect(diff.some((d) => d.type === "added")).toBe(true);
    });

    it("returns empty diff for identical captions", () => {
      const diff = computeDiff("Same text", "Same text");
      const changes = diff.filter((d) => d.type !== "unchanged");
      expect(changes.length).toBe(0);
    });

    it("handles empty strings", () => {
      const diff = computeDiff("", "New content");
      expect(diff.some((d) => d.type === "added")).toBe(true);
    });
  });

  describe("applyRollback", () => {
    it("creates new card fields from a version snapshot", () => {
      const version = {
        id: "v-1",
        cardId: "card-1",
        caption: "Old caption",
        mediaRef: "old.png",
        mediaType: "image" as const,
        moderationScore: 0.85,
        reason: "manual-edit" as const,
        createdAt: "2026-03-20T00:00:00Z",
        createdBy: "human" as const,
      };
      const result = applyRollback(version);
      expect(result.caption).toBe("Old caption");
      expect(result.mediaRef).toBe("old.png");
      expect(result.mediaType).toBe("image");
      expect(result.moderationScore).toBe(0.85);
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /home/winadmin/projects/BrandAmbassador && npx vitest run tests/services/contentHistory.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement content history service**

Create `src/services/contentHistory.ts`:

```typescript
export interface ContentVersion {
  id: string;
  cardId: string;
  caption: string;
  mediaRef?: string;
  mediaType?: "image" | "video";
  moderationScore?: number;
  reason: string;
  createdAt: string;
  createdBy: "human" | "agent";
}

export interface DiffLine {
  type: "added" | "removed" | "unchanged";
  text: string;
}

interface CardSnapshot {
  id: string;
  caption: string;
  mediaRef?: string;
  mediaType?: "image" | "video";
  moderationScore?: number;
}

/**
 * Create a version snapshot from the current card state.
 */
export function createSnapshot(
  card: CardSnapshot,
  reason: string,
  createdBy: "human" | "agent",
): ContentVersion {
  return {
    id: crypto.randomUUID(),
    cardId: card.id,
    caption: card.caption,
    mediaRef: card.mediaRef,
    mediaType: card.mediaType,
    moderationScore: card.moderationScore,
    reason,
    createdAt: new Date().toISOString(),
    createdBy,
  };
}

/**
 * Compute a simple word-level diff between two caption strings.
 * Returns an array of DiffLine entries (added/removed/unchanged).
 */
export function computeDiff(oldText: string, newText: string): DiffLine[] {
  const oldWords = oldText.split(/(\s+)/);
  const newWords = newText.split(/(\s+)/);

  // Simple LCS-based diff on word tokens
  const m = oldWords.length;
  const n = newWords.length;

  // Build LCS table
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (oldWords[i - 1] === newWords[j - 1]) {
        dp[i]![j] = dp[i - 1]![j - 1]! + 1;
      } else {
        dp[i]![j] = Math.max(dp[i - 1]![j]!, dp[i]![j - 1]!);
      }
    }
  }

  // Backtrack to build diff
  const result: DiffLine[] = [];
  let i = m;
  let j = n;

  const stack: DiffLine[] = [];
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && oldWords[i - 1] === newWords[j - 1]) {
      stack.push({ type: "unchanged", text: oldWords[i - 1]! });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i]![j - 1]! >= dp[i - 1]![j]!)) {
      stack.push({ type: "added", text: newWords[j - 1]! });
      j--;
    } else {
      stack.push({ type: "removed", text: oldWords[i - 1]! });
      i--;
    }
  }

  // Reverse since we backtracked
  for (let k = stack.length - 1; k >= 0; k--) {
    result.push(stack[k]!);
  }

  return result;
}

/**
 * Extract the rollback fields from a version snapshot.
 * These get merged back onto the card.
 */
export function applyRollback(version: ContentVersion): {
  caption: string;
  mediaRef?: string;
  mediaType?: "image" | "video";
  moderationScore?: number;
} {
  return {
    caption: version.caption,
    mediaRef: version.mediaRef,
    mediaType: version.mediaType,
    moderationScore: version.moderationScore,
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd /home/winadmin/projects/BrandAmbassador && npx vitest run tests/services/contentHistory.test.ts`
Expected: All 6 tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/services/contentHistory.ts tests/services/contentHistory.test.ts
git commit -m "feat(v3): add content history service with snapshots, word-level diff, and rollback"
```

---

## Phase 1: Content Versioning

> **Depends on:** Phase 0 (Task 4 — contentHistory service, Task 1 — types/constants)

### Task 5: Content History Handlers

**Files:**
- Modify: `src/handlers/actions.ts`
- Create: `tests/handlers/contentHistory.test.ts`

- [ ] **Step 1: Write failing tests for content history handlers**

Create `tests/handlers/contentHistory.test.ts`:

```typescript
import { describe, it, expect, vi } from "vitest";
import {
  handleSaveContentVersion,
  handleRollbackContent,
  handleGetContentHistory,
} from "../../src/handlers/actions.js";

function mockCtx(stateMap: Map<string, unknown> = new Map()) {
  return {
    state: {
      get: vi.fn(async (key: { scopeKind: string; scopeId?: string; namespace?: string; stateKey: string }) => {
        const flat = [key.scopeKind, key.scopeId, key.namespace, key.stateKey].filter(Boolean).join(":");
        return stateMap.get(flat) ?? null;
      }),
      set: vi.fn(async (key: { scopeKind: string; scopeId?: string; namespace?: string; stateKey: string }, val: unknown) => {
        const flat = [key.scopeKind, key.scopeId, key.namespace, key.stateKey].filter(Boolean).join(":");
        stateMap.set(flat, val);
      }),
    },
  };
}

describe("content history handlers", () => {
  const companyId = "comp-1";

  describe("handleSaveContentVersion", () => {
    it("saves a snapshot of the current card state", async () => {
      const state = new Map<string, unknown>();
      state.set(
        "company:comp-1:pipeline:cards",
        [{ id: "card-1", caption: "Hello", mediaRef: "img.png", mediaType: "image", moderationScore: 0.9 }],
      );
      const ctx = mockCtx(state);

      const result = await handleSaveContentVersion(ctx as any, companyId, {
        cardId: "card-1",
        reason: "manual-edit",
        createdBy: "human",
      });

      expect(result.ok).toBe(true);
      expect(result.version.caption).toBe("Hello");
      expect(result.version.reason).toBe("manual-edit");

      // Check history was saved
      const history = state.get("company:comp-1:content-history:content-history:card-1");
      expect(Array.isArray(history)).toBe(true);
      expect((history as any[]).length).toBe(1);
    });

    it("throws if card not found", async () => {
      const ctx = mockCtx(new Map([["company:comp-1:pipeline:cards", []]]));
      await expect(
        handleSaveContentVersion(ctx as any, companyId, { cardId: "nope", reason: "edit", createdBy: "human" }),
      ).rejects.toThrow("not found");
    });
  });

  describe("handleGetContentHistory", () => {
    it("returns all versions for a card", async () => {
      const versions = [
        { id: "v1", cardId: "card-1", caption: "V1", reason: "manual-edit", createdAt: "2026-03-01", createdBy: "human" },
        { id: "v2", cardId: "card-1", caption: "V2", reason: "regenerate", createdAt: "2026-03-02", createdBy: "agent" },
      ];
      const state = new Map<string, unknown>();
      state.set("company:comp-1:content-history:content-history:card-1", versions);
      const ctx = mockCtx(state);

      const result = await handleGetContentHistory(ctx as any, companyId, { cardId: "card-1" });
      expect(result.versions).toHaveLength(2);
      expect(result.versions[0].caption).toBe("V1");
    });

    it("returns empty for card with no history", async () => {
      const ctx = mockCtx(new Map());
      const result = await handleGetContentHistory(ctx as any, companyId, { cardId: "card-1" });
      expect(result.versions).toEqual([]);
    });
  });

  describe("handleRollbackContent", () => {
    it("restores card caption from a version", async () => {
      const state = new Map<string, unknown>();
      state.set("company:comp-1:pipeline:cards", [
        { id: "card-1", caption: "Current", mediaRef: "new.png" },
      ]);
      state.set("company:comp-1:content-history:content-history:card-1", [
        { id: "v1", cardId: "card-1", caption: "Old caption", mediaRef: "old.png", mediaType: "image", reason: "manual-edit", createdAt: "2026-03-01", createdBy: "human" },
      ]);
      const ctx = mockCtx(state);

      const result = await handleRollbackContent(ctx as any, companyId, {
        cardId: "card-1",
        versionId: "v1",
      });

      expect(result.ok).toBe(true);
      expect(result.card.caption).toBe("Old caption");
      expect(result.card.mediaRef).toBe("old.png");

      // Check a rollback snapshot was also saved
      const history = state.get("company:comp-1:content-history:content-history:card-1") as any[];
      const rollbackVersion = history.find((v: any) => v.reason === "rollback");
      expect(rollbackVersion).toBeDefined();
    });

    it("throws if version not found", async () => {
      const state = new Map<string, unknown>();
      state.set("company:comp-1:pipeline:cards", [{ id: "card-1", caption: "Current" }]);
      state.set("company:comp-1:content-history:content-history:card-1", []);
      const ctx = mockCtx(state);

      await expect(
        handleRollbackContent(ctx as any, companyId, { cardId: "card-1", versionId: "nope" }),
      ).rejects.toThrow("not found");
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /home/winadmin/projects/BrandAmbassador && npx vitest run tests/handlers/contentHistory.test.ts`
Expected: FAIL — functions not exported

- [ ] **Step 3: Implement content history handlers**

Add to `src/handlers/actions.ts` (after the bulk operations handler, before `registerActionHandlers`):

```typescript
// ---------------------------------------------------------------------------
// Content history handlers (exported for testing)
// ---------------------------------------------------------------------------

import { createSnapshot, applyRollback } from "../services/contentHistory.js";
import type { ContentVersion } from "../services/contentHistory.js";

export async function handleSaveContentVersion(
  ctx: any,
  companyId: string,
  params: { cardId: string; reason: string; createdBy: "human" | "agent" },
): Promise<{ ok: true; version: ContentVersion }> {
  if (!companyId) throw new Error("companyId required");
  if (!params.cardId) throw new Error("cardId required");

  const cards: any[] = (await ctx.state.get({
    scopeKind: "company",
    scopeId: companyId,
    namespace: "pipeline",
    stateKey: "cards",
  })) ?? [];

  const card = cards.find((c: any) => c.id === params.cardId);
  if (!card) throw new Error(`Card ${params.cardId} not found`);

  const version = createSnapshot(card, params.reason, params.createdBy);

  const historyKey = `content-history:${params.cardId}`;
  const history: ContentVersion[] = (await ctx.state.get({
    scopeKind: "company",
    scopeId: companyId,
    namespace: "content-history",
    stateKey: historyKey,
  })) ?? [];

  history.push(version);
  // Keep max 50 versions per card
  if (history.length > 50) history.splice(0, history.length - 50);

  await ctx.state.set(
    { scopeKind: "company", scopeId: companyId, namespace: "content-history", stateKey: historyKey },
    history,
  );

  return { ok: true, version };
}

export async function handleGetContentHistory(
  ctx: any,
  companyId: string,
  params: { cardId: string },
): Promise<{ versions: ContentVersion[] }> {
  const historyKey = `content-history:${params.cardId}`;
  const history: ContentVersion[] = (await ctx.state.get({
    scopeKind: "company",
    scopeId: companyId,
    namespace: "content-history",
    stateKey: historyKey,
  })) ?? [];

  return { versions: history };
}

export async function handleRollbackContent(
  ctx: any,
  companyId: string,
  params: { cardId: string; versionId: string },
): Promise<{ ok: true; card: any }> {
  if (!companyId) throw new Error("companyId required");

  const cards: any[] = (await ctx.state.get({
    scopeKind: "company",
    scopeId: companyId,
    namespace: "pipeline",
    stateKey: "cards",
  })) ?? [];

  const cardIndex = cards.findIndex((c: any) => c.id === params.cardId);
  if (cardIndex === -1) throw new Error(`Card ${params.cardId} not found`);

  const historyKey = `content-history:${params.cardId}`;
  const history: ContentVersion[] = (await ctx.state.get({
    scopeKind: "company",
    scopeId: companyId,
    namespace: "content-history",
    stateKey: historyKey,
  })) ?? [];

  const version = history.find((v) => v.id === params.versionId);
  if (!version) throw new Error(`Version ${params.versionId} not found`);

  // Save current state as a rollback snapshot before restoring
  const currentCard = cards[cardIndex]!;
  const rollbackSnap = createSnapshot(currentCard, "rollback", "human");
  history.push(rollbackSnap);

  // Apply the rollback
  const rollbackFields = applyRollback(version);
  const updatedCard = {
    ...currentCard,
    ...rollbackFields,
    updatedAt: new Date().toISOString(),
  };
  cards[cardIndex] = updatedCard;

  await ctx.state.set(
    { scopeKind: "company", scopeId: companyId, namespace: "pipeline", stateKey: "cards" },
    cards,
  );
  await ctx.state.set(
    { scopeKind: "company", scopeId: companyId, namespace: "content-history", stateKey: historyKey },
    history,
  );

  return { ok: true, card: updatedCard };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd /home/winadmin/projects/BrandAmbassador && npx vitest run tests/handlers/contentHistory.test.ts`
Expected: All 6 tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/handlers/actions.ts tests/handlers/contentHistory.test.ts
git commit -m "feat(v3): add content history handlers — save version, get history, rollback"
```

---

### Task 6: Content History Data Handler & Action Wiring

**Files:**
- Modify: `src/handlers/data.ts`
- Modify: `src/handlers/actions.ts` (inside `registerActionHandlers`)

- [ ] **Step 1: Register content-history data handler**

Add to `src/handlers/data.ts` inside `registerDataHandlers`, after the analytics handler:

```typescript
  // ── content-history ──────────────────────────────────────────────────────
  ctx.data.register("content-history", async (params) => {
    const companyId = (params as { companyId?: string; cardId?: string }).companyId;
    const cardId = (params as { cardId?: string }).cardId;
    if (!companyId || !cardId) return { versions: [] };

    const historyKey = `content-history:${cardId}`;
    const history = await ctx.state.get({
      scopeKind: "company",
      scopeId: companyId,
      namespace: "content-history",
      stateKey: historyKey,
    });

    return { versions: (history as unknown[] | null) ?? [] };
  });
```

- [ ] **Step 2: Register content version actions**

Add to `src/handlers/actions.ts` inside `registerActionHandlers`, after `test-platform-connection`:

```typescript
  // ── save-content-version ─────────────────────────────────────────────────
  ctx.actions.register("save-content-version", async (params) => {
    const p = params as { companyId: string; cardId: string; reason: string; createdBy?: "human" | "agent" };
    if (!p.companyId) return { error: "companyId is required" };
    if (!p.cardId) return { error: "cardId is required" };
    return handleSaveContentVersion(ctx, p.companyId, {
      cardId: p.cardId,
      reason: p.reason ?? "manual-edit",
      createdBy: p.createdBy ?? "human",
    });
  });

  // ── rollback-content ─────────────────────────────────────────────────────
  ctx.actions.register("rollback-content", async (params) => {
    const p = params as { companyId: string; cardId: string; versionId: string };
    if (!p.companyId) return { error: "companyId is required" };
    if (!p.cardId) return { error: "cardId is required" };
    if (!p.versionId) return { error: "versionId is required" };
    return handleRollbackContent(ctx, p.companyId, { cardId: p.cardId, versionId: p.versionId });
  });
```

- [ ] **Step 3: Commit**

```bash
git add src/handlers/data.ts src/handlers/actions.ts
git commit -m "feat(v3): wire content history data handler and action registrations"
```

---

### Task 7: Content History UI

**Files:**
- Create: `ui/pages/marketing/ContentHistory.tsx`
- Modify: `ui/pages/marketing/DetailPanel.tsx`

- [ ] **Step 1: Create ContentHistory component**

Create `ui/pages/marketing/ContentHistory.tsx`:

```tsx
import React, { useState, useMemo } from "react";
import { usePluginData, usePluginAction } from "@paperclipai/plugin-sdk/ui";
import type { ContentVersion, ContentCard } from "./types.js";

interface ContentHistoryProps {
  card: ContentCard;
  companyId: string;
  onRollback: () => void;
}

interface DiffLine {
  type: "added" | "removed" | "unchanged";
  text: string;
}

function simpleDiff(oldText: string, newText: string): DiffLine[] {
  const oldWords = oldText.split(/\s+/);
  const newWords = newText.split(/\s+/);
  const result: DiffLine[] = [];

  const maxLen = Math.max(oldWords.length, newWords.length);
  for (let i = 0; i < maxLen; i++) {
    const oldW = oldWords[i];
    const newW = newWords[i];
    if (oldW === newW) {
      result.push({ type: "unchanged", text: oldW ?? "" });
    } else {
      if (oldW) result.push({ type: "removed", text: oldW });
      if (newW) result.push({ type: "added", text: newW });
    }
  }
  return result;
}

export function ContentHistory({ card, companyId, onRollback }: ContentHistoryProps) {
  const { data } = usePluginData<{ versions: ContentVersion[] }>("content-history", {
    companyId,
    cardId: card.id,
  });
  const rollbackAction = usePluginAction("rollback-content");
  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(null);
  const [showDiff, setShowDiff] = useState(false);

  const versions = data?.versions ?? [];
  const selectedVersion = versions.find((v) => v.id === selectedVersionId);

  const diffLines = useMemo(() => {
    if (!selectedVersion) return [];
    return simpleDiff(selectedVersion.caption, card.caption);
  }, [selectedVersion, card.caption]);

  const handleRollback = async () => {
    if (!selectedVersionId) return;
    await rollbackAction.execute({
      companyId,
      cardId: card.id,
      versionId: selectedVersionId,
    });
    onRollback();
  };

  if (versions.length === 0) {
    return <div style={{ padding: 12, color: "#888" }}>No version history yet.</div>;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: 12 }}>
      <div style={{ fontWeight: 600, marginBottom: 4 }}>Version History ({versions.length})</div>

      <div style={{ maxHeight: 200, overflowY: "auto", display: "flex", flexDirection: "column", gap: 4 }}>
        {versions.slice().reverse().map((v) => (
          <div
            key={v.id}
            onClick={() => { setSelectedVersionId(v.id); setShowDiff(false); }}
            style={{
              padding: "6px 10px",
              borderRadius: 6,
              cursor: "pointer",
              background: selectedVersionId === v.id ? "#e8f0fe" : "#f5f5f5",
              border: selectedVersionId === v.id ? "1px solid #4a90d9" : "1px solid transparent",
              fontSize: 13,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ fontWeight: 500 }}>{v.reason}</span>
              <span style={{ color: "#888", fontSize: 11 }}>{v.createdBy}</span>
            </div>
            <div style={{ color: "#666", fontSize: 11 }}>
              {new Date(v.createdAt).toLocaleString()}
            </div>
          </div>
        ))}
      </div>

      {selectedVersion && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 8 }}>
          {!showDiff ? (
            <div style={{ padding: 8, background: "#f9f9f9", borderRadius: 6, fontSize: 13 }}>
              <div style={{ fontWeight: 500, marginBottom: 4 }}>Caption at this version:</div>
              <div style={{ whiteSpace: "pre-wrap" }}>{selectedVersion.caption}</div>
            </div>
          ) : (
            <div style={{ padding: 8, background: "#f9f9f9", borderRadius: 6, fontSize: 13, fontFamily: "monospace" }}>
              <div style={{ fontWeight: 500, marginBottom: 4 }}>Diff (version vs current):</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 2 }}>
                {diffLines.map((line, i) => (
                  <span
                    key={i}
                    style={{
                      background: line.type === "added" ? "#d4edda" : line.type === "removed" ? "#f8d7da" : "transparent",
                      textDecoration: line.type === "removed" ? "line-through" : "none",
                      padding: "0 2px",
                    }}
                  >
                    {line.text}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div style={{ display: "flex", gap: 6 }}>
            <button
              onClick={() => setShowDiff(!showDiff)}
              style={{ padding: "4px 10px", borderRadius: 4, border: "1px solid #ccc", background: "#fff", cursor: "pointer", fontSize: 12 }}
            >
              {showDiff ? "Show Full" : "Show Diff"}
            </button>
            <button
              onClick={handleRollback}
              style={{ padding: "4px 10px", borderRadius: 4, border: "none", background: "#e74c3c", color: "#fff", cursor: "pointer", fontSize: 12 }}
            >
              Rollback to This Version
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Integrate into DetailPanel**

In `ui/pages/marketing/DetailPanel.tsx`, add the history tab. Find the section where tabs are rendered and add a "History" tab that renders `<ContentHistory>`:

```tsx
// Add import at top:
import { ContentHistory } from "./ContentHistory.js";

// In the tab bar section (where schedule/variant tabs are), add:
<button
  onClick={() => setActiveTab("history")}
  style={{
    padding: "6px 12px",
    borderRadius: 4,
    border: activeTab === "history" ? "2px solid #4a90d9" : "1px solid #ccc",
    background: activeTab === "history" ? "#e8f0fe" : "#fff",
    cursor: "pointer",
    fontSize: 12,
  }}
>
  History
</button>

// In the tab content section, add:
{activeTab === "history" && card && (
  <ContentHistory
    card={card}
    companyId={companyId}
    onRollback={() => refreshPipeline?.()}
  />
)}
```

- [ ] **Step 3: Auto-save version on card caption edit**

In the existing `update-card-status` action handler in `src/handlers/actions.ts`, add a version snapshot before status changes. Find the handler and insert before the card update:

```typescript
// Inside the update-card-status handler, before updating the card:
// Save a version snapshot when the card caption was edited
if (currentCard.caption !== updatedCard.caption) {
  try {
    await handleSaveContentVersion(ctx, p.companyId, {
      cardId: p.cardId,
      reason: "status-change",
      createdBy: "human",
    });
  } catch { /* best-effort versioning */ }
}
```

- [ ] **Step 4: Commit**

```bash
git add ui/pages/marketing/ContentHistory.tsx ui/pages/marketing/DetailPanel.tsx src/handlers/actions.ts
git commit -m "feat(v3): add content history UI with diff view, rollback, and auto-versioning"
```

---

## Phase 2: A/B Testing Auto-Learning

> **Depends on:** Phase 0 (Task 2 — statistics, Task 3 — engagement aggregator), existing V2 variant infrastructure

### Task 8: Pattern Extractor Service

**Files:**
- Create: `src/services/patternExtractor.ts`
- Create: `tests/services/patternExtractor.test.ts`

- [ ] **Step 1: Write failing tests for pattern extractor**

Create `tests/services/patternExtractor.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { extractWinPatterns } from "../../src/services/patternExtractor.js";

describe("patternExtractor", () => {
  it("identifies tone as a winning pattern", () => {
    const history = [
      { winnerTone: "witty", loserTones: ["formal"], dimension: "tone" as const },
      { winnerTone: "witty", loserTones: ["casual"], dimension: "tone" as const },
      { winnerTone: "witty", loserTones: ["formal"], dimension: "tone" as const },
    ];
    const patterns = extractWinPatterns(history);
    const tonePattern = patterns.find((p) => p.dimension === "tone");
    expect(tonePattern).toBeDefined();
    expect(tonePattern!.winningValue).toBe("witty");
    expect(tonePattern!.winRate).toBe(1); // 3/3
    expect(tonePattern!.sampleSize).toBe(3);
  });

  it("identifies media type patterns", () => {
    const history = [
      { winnerMediaType: "image", loserMediaTypes: ["video"], dimension: "mediaType" as const },
      { winnerMediaType: "image", loserMediaTypes: ["video"], dimension: "mediaType" as const },
      { winnerMediaType: "video", loserMediaTypes: ["image"], dimension: "mediaType" as const },
    ];
    const patterns = extractWinPatterns(history);
    const mediaPattern = patterns.find((p) => p.dimension === "mediaType");
    expect(mediaPattern).toBeDefined();
    expect(mediaPattern!.winningValue).toBe("image");
    expect(mediaPattern!.winRate).toBeCloseTo(0.667, 1);
  });

  it("identifies posting hour patterns", () => {
    const history = [
      { winnerHour: 14, loserHours: [9], dimension: "postingHour" as const },
      { winnerHour: 14, loserHours: [20], dimension: "postingHour" as const },
      { winnerHour: 9, loserHours: [14], dimension: "postingHour" as const },
      { winnerHour: 14, loserHours: [9], dimension: "postingHour" as const },
    ];
    const patterns = extractWinPatterns(history);
    const hourPattern = patterns.find((p) => p.dimension === "postingHour");
    expect(hourPattern).toBeDefined();
    expect(hourPattern!.winningValue).toBe("14");
    expect(hourPattern!.winRate).toBe(0.75);
  });

  it("identifies caption length patterns", () => {
    const history = [
      { winnerLength: "short", loserLengths: ["long"], dimension: "length" as const },
      { winnerLength: "short", loserLengths: ["medium"], dimension: "length" as const },
    ];
    const patterns = extractWinPatterns(history);
    const lengthPattern = patterns.find((p) => p.dimension === "length");
    expect(lengthPattern).toBeDefined();
    expect(lengthPattern!.winningValue).toBe("short");
  });

  it("requires minimum 3 samples to report a pattern", () => {
    const history = [
      { winnerTone: "witty", loserTones: ["formal"], dimension: "tone" as const },
    ];
    const patterns = extractWinPatterns(history);
    expect(patterns).toEqual([]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /home/winadmin/projects/BrandAmbassador && npx vitest run tests/services/patternExtractor.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement pattern extractor**

Create `src/services/patternExtractor.ts`:

```typescript
export type PatternDimension = "tone" | "length" | "mediaType" | "postingHour" | "platform";

export interface WinRecord {
  dimension: PatternDimension;
  // Each record carries the winning value and losing values for that dimension.
  // Use the appropriate field based on dimension:
  winnerTone?: string;
  loserTones?: string[];
  winnerMediaType?: string;
  loserMediaTypes?: string[];
  winnerHour?: number;
  loserHours?: number[];
  winnerLength?: string;
  loserLengths?: string[];
  winnerPlatform?: string;
  loserPlatforms?: string[];
}

export interface WinPattern {
  id: string;
  dimension: PatternDimension;
  winningValue: string;
  winRate: number;
  sampleSize: number;
  confidence: number;
  discoveredAt: string;
}

const MIN_SAMPLES = 3;

/**
 * Analyze win/loss history across variant tests and extract patterns.
 * A pattern is reported when a single value wins >= MIN_SAMPLES times
 * in a dimension with a win rate > 50%.
 */
export function extractWinPatterns(history: WinRecord[]): WinPattern[] {
  // Group by dimension
  const byDimension = new Map<PatternDimension, WinRecord[]>();
  for (const rec of history) {
    const existing = byDimension.get(rec.dimension) ?? [];
    existing.push(rec);
    byDimension.set(rec.dimension, existing);
  }

  const patterns: WinPattern[] = [];

  for (const [dimension, records] of byDimension) {
    // Count wins per value
    const winCounts = new Map<string, number>();
    let total = 0;

    for (const rec of records) {
      const winVal = getWinnerValue(rec);
      if (winVal !== null) {
        winCounts.set(winVal, (winCounts.get(winVal) ?? 0) + 1);
        total++;
      }
    }

    if (total < MIN_SAMPLES) continue;

    // Find the value with highest win count
    let bestValue = "";
    let bestCount = 0;
    for (const [val, count] of winCounts) {
      if (count > bestCount) {
        bestCount = count;
        bestValue = val;
      }
    }

    const winRate = bestCount / total;
    if (winRate <= 0.5) continue;

    // Confidence: higher with more samples and higher win rate
    const confidence = Math.min(0.99, winRate * Math.min(1, total / 10));

    patterns.push({
      id: crypto.randomUUID(),
      dimension,
      winningValue: bestValue,
      winRate,
      sampleSize: total,
      confidence,
      discoveredAt: new Date().toISOString(),
    });
  }

  return patterns;
}

function getWinnerValue(rec: WinRecord): string | null {
  switch (rec.dimension) {
    case "tone": return rec.winnerTone ?? null;
    case "mediaType": return rec.winnerMediaType ?? null;
    case "postingHour": return rec.winnerHour?.toString() ?? null;
    case "length": return rec.winnerLength ?? null;
    case "platform": return rec.winnerPlatform ?? null;
    default: return null;
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd /home/winadmin/projects/BrandAmbassador && npx vitest run tests/services/patternExtractor.test.ts`
Expected: All 5 tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/services/patternExtractor.ts tests/services/patternExtractor.test.ts
git commit -m "feat(v3): add pattern extractor for A/B variant win analysis"
```

---

### Task 9: Auto-Winner Detection Handler

**Files:**
- Modify: `src/handlers/actions.ts`
- Create: `tests/handlers/autoWinner.test.ts`

- [ ] **Step 1: Write failing tests for auto-winner handler**

Create `tests/handlers/autoWinner.test.ts`:

```typescript
import { describe, it, expect, vi } from "vitest";
import { handleAutoPickWinner } from "../../src/handlers/actions.js";

function mockCtx(stateMap: Map<string, unknown> = new Map()) {
  return {
    state: {
      get: vi.fn(async (key: { scopeKind: string; scopeId?: string; namespace?: string; stateKey: string }) => {
        const flat = [key.scopeKind, key.scopeId, key.namespace, key.stateKey].filter(Boolean).join(":");
        return stateMap.get(flat) ?? null;
      }),
      set: vi.fn(async (key: { scopeKind: string; scopeId?: string; namespace?: string; stateKey: string }, val: unknown) => {
        const flat = [key.scopeKind, key.scopeId, key.namespace, key.stateKey].filter(Boolean).join(":");
        stateMap.set(flat, val);
      }),
    },
  };
}

describe("handleAutoPickWinner", () => {
  const companyId = "comp-1";

  it("auto-picks winner when statistically significant", async () => {
    const state = new Map<string, unknown>();
    const group = {
      id: "g1",
      sourceCardId: "card-a",
      topic: "Test",
      variantCardIds: ["card-a", "card-b"],
      createdAt: "2026-03-01",
    };
    state.set("company:comp-1:variants:groups", [group]);
    state.set("company:comp-1:pipeline:cards", [
      {
        id: "card-a",
        status: "published",
        caption: "Short witty post",
        latestEngagement: { likes: 50, comments: 10, shares: 5, impressions: 1000, platform: "twitter", fetchedAt: "2026-03-25" },
      },
      {
        id: "card-b",
        status: "published",
        caption: "A much longer and more detailed post about the same topic with formal tone",
        latestEngagement: { likes: 200, comments: 60, shares: 30, impressions: 1000, platform: "twitter", fetchedAt: "2026-03-25" },
      },
    ]);

    const ctx = mockCtx(state);
    const result = await handleAutoPickWinner(ctx as any, companyId, { groupId: "g1" });

    expect(result.ok).toBe(true);
    expect(result.significance.isSignificant).toBe(true);
    expect(result.significance.winnerCardId).toBe("card-b");

    // Group should be updated with winner
    const groups = state.get("company:comp-1:variants:groups") as any[];
    expect(groups[0].winnerCardId).toBe("card-b");
  });

  it("returns not-significant when engagement is similar", async () => {
    const state = new Map<string, unknown>();
    const group = {
      id: "g1",
      sourceCardId: "card-a",
      topic: "Test",
      variantCardIds: ["card-a", "card-b"],
      createdAt: "2026-03-01",
    };
    state.set("company:comp-1:variants:groups", [group]);
    state.set("company:comp-1:pipeline:cards", [
      {
        id: "card-a",
        status: "published",
        latestEngagement: { likes: 100, comments: 20, shares: 10, impressions: 1000, platform: "twitter", fetchedAt: "2026-03-25" },
      },
      {
        id: "card-b",
        status: "published",
        latestEngagement: { likes: 102, comments: 21, shares: 10, impressions: 1000, platform: "twitter", fetchedAt: "2026-03-25" },
      },
    ]);

    const ctx = mockCtx(state);
    const result = await handleAutoPickWinner(ctx as any, companyId, { groupId: "g1" });

    expect(result.ok).toBe(true);
    expect(result.significance.isSignificant).toBe(false);
    expect(result.significance.winnerCardId).toBeNull();

    // Group should NOT have winner set
    const groups = state.get("company:comp-1:variants:groups") as any[];
    expect(groups[0].winnerCardId).toBeUndefined();
  });

  it("reports sample size inadequate for low-impression variants", async () => {
    const state = new Map<string, unknown>();
    const group = {
      id: "g1",
      sourceCardId: "card-a",
      topic: "Test",
      variantCardIds: ["card-a", "card-b"],
      createdAt: "2026-03-01",
    };
    state.set("company:comp-1:variants:groups", [group]);
    state.set("company:comp-1:pipeline:cards", [
      {
        id: "card-a",
        status: "published",
        latestEngagement: { likes: 5, comments: 1, shares: 0, impressions: 50, platform: "twitter", fetchedAt: "2026-03-25" },
      },
      {
        id: "card-b",
        status: "published",
        latestEngagement: { likes: 10, comments: 3, shares: 1, impressions: 50, platform: "twitter", fetchedAt: "2026-03-25" },
      },
    ]);

    const ctx = mockCtx(state);
    const result = await handleAutoPickWinner(ctx as any, companyId, { groupId: "g1" });

    expect(result.significance.sampleSizeAdequate).toBe(false);
  });

  it("throws if group not found", async () => {
    const state = new Map<string, unknown>();
    state.set("company:comp-1:variants:groups", []);
    state.set("company:comp-1:pipeline:cards", []);
    const ctx = mockCtx(state);

    await expect(
      handleAutoPickWinner(ctx as any, companyId, { groupId: "nope" }),
    ).rejects.toThrow("not found");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /home/winadmin/projects/BrandAmbassador && npx vitest run tests/handlers/autoWinner.test.ts`
Expected: FAIL — function not exported

- [ ] **Step 3: Implement auto-winner handler**

Add to `src/handlers/actions.ts` (after content history handlers):

```typescript
// ---------------------------------------------------------------------------
// Auto-winner detection handler (exported for testing)
// ---------------------------------------------------------------------------

import { evaluateVariantGroup } from "../services/statistics.js";
import type { EvaluationResult } from "../services/statistics.js";

export async function handleAutoPickWinner(
  ctx: any,
  companyId: string,
  params: { groupId: string },
): Promise<{ ok: true; significance: EvaluationResult }> {
  if (!companyId) throw new Error("companyId required");
  if (!params.groupId) throw new Error("groupId required");

  const groups: any[] = (await ctx.state.get({
    scopeKind: "company",
    scopeId: companyId,
    namespace: "variants",
    stateKey: "groups",
  })) ?? [];

  const groupIndex = groups.findIndex((g: any) => g.id === params.groupId);
  if (groupIndex === -1) throw new Error(`Group ${params.groupId} not found`);

  const group = groups[groupIndex]!;

  const cards: any[] = (await ctx.state.get({
    scopeKind: "company",
    scopeId: companyId,
    namespace: "pipeline",
    stateKey: "cards",
  })) ?? [];

  const variantCards = cards.filter((c: any) => group.variantCardIds.includes(c.id));

  const variants = variantCards.map((c: any) => ({
    cardId: c.id as string,
    metrics: {
      likes: c.latestEngagement?.likes ?? 0,
      comments: c.latestEngagement?.comments ?? 0,
      shares: c.latestEngagement?.shares ?? 0,
      impressions: c.latestEngagement?.impressions ?? 0,
    },
  }));

  const result = evaluateVariantGroup(variants);

  // If significant, auto-set winner on the group
  if (result.isSignificant && result.winnerCardId) {
    groups[groupIndex] = { ...group, winnerCardId: result.winnerCardId };
    await ctx.state.set(
      { scopeKind: "company", scopeId: companyId, namespace: "variants", stateKey: "groups" },
      groups,
    );
  }

  return { ok: true, significance: result };
}
```

- [ ] **Step 4: Register the action**

Add inside `registerActionHandlers` in `src/handlers/actions.ts`:

```typescript
  // ── auto-pick-winner ─────────────────────────────────────────────────────
  ctx.actions.register("auto-pick-winner", async (params) => {
    const p = params as { companyId: string; groupId: string };
    if (!p.companyId) return { error: "companyId is required" };
    if (!p.groupId) return { error: "groupId is required" };
    return handleAutoPickWinner(ctx, p.companyId, { groupId: p.groupId });
  });
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd /home/winadmin/projects/BrandAmbassador && npx vitest run tests/handlers/autoWinner.test.ts`
Expected: All 4 tests PASS

- [ ] **Step 6: Commit**

```bash
git add src/handlers/actions.ts tests/handlers/autoWinner.test.ts
git commit -m "feat(v3): add auto-winner detection with statistical significance evaluation"
```

---

### Task 10: Brand Settings Optimization Handler

**Files:**
- Modify: `src/handlers/actions.ts`
- Modify: `src/handlers/data.ts`

- [ ] **Step 1: Implement brand optimization suggestion handler**

Add to `src/handlers/actions.ts` (after auto-winner handler):

```typescript
// ---------------------------------------------------------------------------
// Brand settings optimization handler (exported for testing)
// ---------------------------------------------------------------------------

import { extractWinPatterns } from "../services/patternExtractor.js";
import type { WinRecord } from "../services/patternExtractor.js";

export async function handleOptimizeBrandSettings(
  ctx: any,
  companyId: string,
): Promise<{ ok: true; suggestions: any[] }> {
  if (!companyId) throw new Error("companyId required");

  // Read win pattern history
  const winHistory: WinRecord[] = (await ctx.state.get({
    scopeKind: "company",
    scopeId: companyId,
    namespace: "variants",
    stateKey: "win-history",
  })) ?? [];

  const patterns = extractWinPatterns(winHistory);

  // Read current brand settings
  const brandSettings: Record<string, unknown> = (await ctx.state.get({
    scopeKind: "company",
    scopeId: companyId,
    namespace: "brand",
    stateKey: "settings",
  })) ?? {};

  // Generate suggestions based on patterns vs current settings
  const suggestions: any[] = [];
  for (const pattern of patterns) {
    if (pattern.dimension === "tone" && brandSettings.tone !== pattern.winningValue) {
      suggestions.push({
        id: crypto.randomUUID(),
        pattern,
        currentValue: (brandSettings.tone as string) ?? "not set",
        suggestedValue: pattern.winningValue,
        expectedLift: `${(pattern.winRate * 100).toFixed(0)}% win rate in A/B tests`,
        status: "pending",
        createdAt: new Date().toISOString(),
      });
    }
  }

  // Store suggestions
  await ctx.state.set(
    { scopeKind: "company", scopeId: companyId, namespace: "brand", stateKey: "optimization-suggestions" },
    suggestions,
  );

  return { ok: true, suggestions };
}

export async function handleAcceptBrandSuggestion(
  ctx: any,
  companyId: string,
  params: { suggestionId: string },
): Promise<{ ok: true }> {
  const suggestions: any[] = (await ctx.state.get({
    scopeKind: "company",
    scopeId: companyId,
    namespace: "brand",
    stateKey: "optimization-suggestions",
  })) ?? [];

  const idx = suggestions.findIndex((s: any) => s.id === params.suggestionId);
  if (idx === -1) throw new Error(`Suggestion ${params.suggestionId} not found`);

  const suggestion = suggestions[idx]!;
  suggestion.status = "accepted";

  // Apply the suggestion to brand settings
  const settings: Record<string, unknown> = (await ctx.state.get({
    scopeKind: "company",
    scopeId: companyId,
    namespace: "brand",
    stateKey: "settings",
  })) ?? {};

  if (suggestion.pattern.dimension === "tone") {
    settings.tone = suggestion.suggestedValue;
  }

  await ctx.state.set(
    { scopeKind: "company", scopeId: companyId, namespace: "brand", stateKey: "settings" },
    settings,
  );
  await ctx.state.set(
    { scopeKind: "company", scopeId: companyId, namespace: "brand", stateKey: "optimization-suggestions" },
    suggestions,
  );

  return { ok: true };
}

export async function handleDismissBrandSuggestion(
  ctx: any,
  companyId: string,
  params: { suggestionId: string },
): Promise<{ ok: true }> {
  const suggestions: any[] = (await ctx.state.get({
    scopeKind: "company",
    scopeId: companyId,
    namespace: "brand",
    stateKey: "optimization-suggestions",
  })) ?? [];

  const idx = suggestions.findIndex((s: any) => s.id === params.suggestionId);
  if (idx === -1) throw new Error(`Suggestion ${params.suggestionId} not found`);

  suggestions[idx]!.status = "dismissed";

  await ctx.state.set(
    { scopeKind: "company", scopeId: companyId, namespace: "brand", stateKey: "optimization-suggestions" },
    suggestions,
  );

  return { ok: true };
}
```

- [ ] **Step 2: Register actions and data handler**

Add inside `registerActionHandlers`:

```typescript
  // ── optimize-brand-settings ──────────────────────────────────────────────
  ctx.actions.register("optimize-brand-settings", async (params) => {
    const p = params as { companyId: string };
    if (!p.companyId) return { error: "companyId is required" };
    return handleOptimizeBrandSettings(ctx, p.companyId);
  });

  // ── accept-brand-suggestion ──────────────────────────────────────────────
  ctx.actions.register("accept-brand-suggestion", async (params) => {
    const p = params as { companyId: string; suggestionId: string };
    if (!p.companyId) return { error: "companyId is required" };
    if (!p.suggestionId) return { error: "suggestionId is required" };
    return handleAcceptBrandSuggestion(ctx, p.companyId, { suggestionId: p.suggestionId });
  });

  // ── dismiss-brand-suggestion ─────────────────────────────────────────────
  ctx.actions.register("dismiss-brand-suggestion", async (params) => {
    const p = params as { companyId: string; suggestionId: string };
    if (!p.companyId) return { error: "companyId is required" };
    if (!p.suggestionId) return { error: "suggestionId is required" };
    return handleDismissBrandSuggestion(ctx, p.companyId, { suggestionId: p.suggestionId });
  });
```

Add in `registerDataHandlers` in `src/handlers/data.ts`:

```typescript
  // ── brand-suggestions ────────────────────────────────────────────────────
  ctx.data.register("brand-suggestions", async (params) => {
    const companyId = (params as { companyId?: string }).companyId;
    if (!companyId) return { suggestions: [] };

    const suggestions = await ctx.state.get({
      scopeKind: "company",
      scopeId: companyId,
      namespace: "brand",
      stateKey: "optimization-suggestions",
    });

    return { suggestions: (suggestions as unknown[] | null) ?? [] };
  });
```

- [ ] **Step 3: Add win-history recording to auto-pick-winner**

In `handleAutoPickWinner`, after setting the winner on the group, add pattern history recording:

```typescript
  // After: if (result.isSignificant && result.winnerCardId) { ... }
  // Record win/loss patterns for pattern extraction
  if (result.isSignificant && result.winnerCardId) {
    const winnerCard = variantCards.find((c: any) => c.id === result.winnerCardId);
    const loserCards = variantCards.filter((c: any) => c.id !== result.winnerCardId);

    const winHistory: WinRecord[] = (await ctx.state.get({
      scopeKind: "company",
      scopeId: companyId,
      namespace: "variants",
      stateKey: "win-history",
    })) ?? [];

    // Record tone pattern (if tone metadata available via brand settings)
    const captionLength = (text: string) => text.length < 100 ? "short" : text.length < 280 ? "medium" : "long";
    winHistory.push({
      dimension: "length",
      winnerLength: captionLength(winnerCard?.caption ?? ""),
      loserLengths: loserCards.map((c: any) => captionLength(c.caption ?? "")),
    });

    // Record media type pattern
    if (winnerCard?.mediaType) {
      winHistory.push({
        dimension: "mediaType",
        winnerMediaType: winnerCard.mediaType,
        loserMediaTypes: loserCards.map((c: any) => c.mediaType ?? "text").filter(Boolean),
      });
    }

    // Keep max 200 records
    if (winHistory.length > 200) winHistory.splice(0, winHistory.length - 200);

    await ctx.state.set(
      { scopeKind: "company", scopeId: companyId, namespace: "variants", stateKey: "win-history" },
      winHistory,
    );
  }
```

- [ ] **Step 4: Commit**

```bash
git add src/handlers/actions.ts src/handlers/data.ts
git commit -m "feat(v3): add brand optimization suggestions with pattern-based feedback loop"
```

---

### Task 11: A/B Auto-Learning UI Enhancements

**Files:**
- Modify: `ui/pages/marketing/VariantComparison.tsx`

- [ ] **Step 1: Add auto-winner and significance display to VariantComparison**

Modify `ui/pages/marketing/VariantComparison.tsx` to add:
1. An "Auto-Evaluate" button that calls `auto-pick-winner`
2. A significance indicator showing confidence level
3. Win pattern insights section

```tsx
// Add imports at top:
import { usePluginAction, usePluginData } from "@paperclipai/plugin-sdk/ui";
import type { SignificanceResult, WinPattern, BrandOptimizationSuggestion } from "./types.js";

// Inside the component, add state and actions:
const autoPickAction = usePluginAction("auto-pick-winner");
const optimizeAction = usePluginAction("optimize-brand-settings");
const { data: suggestionsData } = usePluginData<{ suggestions: BrandOptimizationSuggestion[] }>("brand-suggestions", { companyId });
const acceptAction = usePluginAction("accept-brand-suggestion");
const dismissAction = usePluginAction("dismiss-brand-suggestion");

const [significance, setSignificance] = useState<SignificanceResult | null>(null);
const [evaluating, setEvaluating] = useState(false);

const handleAutoEvaluate = async () => {
  if (!group) return;
  setEvaluating(true);
  try {
    const result = await autoPickAction.execute({ companyId, groupId: group.id });
    setSignificance(result.significance);
  } finally {
    setEvaluating(false);
  }
};

// Add after the existing "Pick Winner" button:
{!group.winnerCardId && (
  <button
    onClick={handleAutoEvaluate}
    disabled={evaluating}
    style={{
      padding: "6px 14px",
      borderRadius: 6,
      border: "none",
      background: "#2196f3",
      color: "#fff",
      cursor: "pointer",
      fontSize: 13,
    }}
  >
    {evaluating ? "Evaluating..." : "Auto-Evaluate"}
  </button>
)}

// Add significance display after the button:
{significance && (
  <div style={{
    padding: 10,
    borderRadius: 6,
    background: significance.isSignificant ? "#d4edda" : "#fff3cd",
    border: `1px solid ${significance.isSignificant ? "#c3e6cb" : "#ffc107"}`,
    marginTop: 8,
    fontSize: 13,
  }}>
    <div style={{ fontWeight: 600 }}>
      {significance.isSignificant ? "Statistically Significant" : "Not Yet Significant"}
    </div>
    <div>Confidence: {(significance.confidence * 100).toFixed(1)}%</div>
    {!significance.sampleSizeAdequate && (
      <div style={{ color: "#856404" }}>
        Need {significance.minimumSampleNeeded} impressions per variant (sample too small)
      </div>
    )}
    {significance.winnerCardId && (
      <div style={{ marginTop: 4 }}>
        Winner: Variant {variants.find((c) => c.id === significance.winnerCardId)?.variantLabel ?? "?"}
      </div>
    )}
  </div>
)}

// Add brand optimization suggestions section at bottom:
{suggestionsData?.suggestions?.filter((s) => s.status === "pending").length > 0 && (
  <div style={{ marginTop: 12, padding: 10, background: "#e8f5e9", borderRadius: 6 }}>
    <div style={{ fontWeight: 600, marginBottom: 6 }}>Brand Optimization Suggestions</div>
    {suggestionsData.suggestions.filter((s) => s.status === "pending").map((s) => (
      <div key={s.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "4px 0" }}>
        <div style={{ fontSize: 13 }}>
          Change <b>{s.pattern.dimension}</b> from "{s.currentValue}" to "{s.suggestedValue}" — {s.expectedLift}
        </div>
        <div style={{ display: "flex", gap: 4 }}>
          <button onClick={() => acceptAction.execute({ companyId, suggestionId: s.id })} style={{ padding: "2px 8px", borderRadius: 4, border: "none", background: "#4caf50", color: "#fff", cursor: "pointer", fontSize: 11 }}>Accept</button>
          <button onClick={() => dismissAction.execute({ companyId, suggestionId: s.id })} style={{ padding: "2px 8px", borderRadius: 4, border: "1px solid #ccc", background: "#fff", cursor: "pointer", fontSize: 11 }}>Dismiss</button>
        </div>
      </div>
    ))}
  </div>
)}
```

- [ ] **Step 2: Commit**

```bash
git add ui/pages/marketing/VariantComparison.tsx
git commit -m "feat(v3): add auto-evaluate, significance display, and brand optimization suggestions to variant comparison"
```

---

## Phase 3: Scheduling Intelligence

> **Depends on:** Phase 0 (Task 3 — engagement aggregator), existing V2 scheduling infrastructure

### Task 12: Schedule Optimizer Service

**Files:**
- Create: `src/services/scheduleOptimizer.ts`
- Create: `tests/services/scheduleOptimizer.test.ts`

- [ ] **Step 1: Write failing tests for schedule optimizer**

Create `tests/services/scheduleOptimizer.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import {
  recommendScheduleTimes,
  autoSpreadSchedule,
  adjustForTimezone,
} from "../../src/services/scheduleOptimizer.js";
import type { AudiencePattern } from "../../ui/pages/marketing/types.js";

describe("scheduleOptimizer", () => {
  const patterns: AudiencePattern[] = [
    { platform: "twitter", dayOfWeek: 2, hourUtc: 14, avgEngagement: 200, postCount: 10 },
    { platform: "twitter", dayOfWeek: 2, hourUtc: 9, avgEngagement: 150, postCount: 8 },
    { platform: "twitter", dayOfWeek: 2, hourUtc: 20, avgEngagement: 100, postCount: 6 },
    { platform: "twitter", dayOfWeek: 3, hourUtc: 14, avgEngagement: 180, postCount: 10 },
  ];

  describe("recommendScheduleTimes", () => {
    it("suggests top-engagement time slots for platform", () => {
      const recs = recommendScheduleTimes(
        patterns,
        "twitter",
        "2026-04-01", // A Tuesday in UTC
        [],
        3,
      );
      expect(recs.length).toBe(3);
      // First recommendation should be the best hour
      expect(recs[0]!.score).toBeGreaterThanOrEqual(recs[1]!.score);
      expect(recs[0]!.reason).toContain("Peak");
    });

    it("avoids time slots with existing scheduled posts", () => {
      const existing = [
        { scheduledAt: "2026-04-01T14:00:00Z", platform: "twitter" },
        { scheduledAt: "2026-04-01T14:30:00Z", platform: "twitter" },
        { scheduledAt: "2026-04-01T15:00:00Z", platform: "twitter" },
      ];
      const recs = recommendScheduleTimes(patterns, "twitter", "2026-04-01", existing, 3);
      // The 14:00 slot should have lower score or be flagged
      const slot14 = recs.find((r) => r.datetime.includes("T14:"));
      if (slot14) {
        expect(slot14.score).toBeLessThan(1);
      }
    });
  });

  describe("autoSpreadSchedule", () => {
    it("spaces posts at least N hours apart", () => {
      const cardIds = ["c1", "c2", "c3"];
      const spread = autoSpreadSchedule(cardIds, patterns, "twitter", "2026-04-01", 3);
      expect(spread).toHaveLength(3);

      // Verify minimum spacing of 3 hours
      for (let i = 1; i < spread.length; i++) {
        const prev = new Date(spread[i - 1]!.scheduledAt).getTime();
        const curr = new Date(spread[i]!.scheduledAt).getTime();
        expect(curr - prev).toBeGreaterThanOrEqual(3 * 60 * 60 * 1000);
      }
    });

    it("assigns best time slots to first cards", () => {
      const spread = autoSpreadSchedule(["c1", "c2"], patterns, "twitter", "2026-04-01", 3);
      // First card should get the best slot (hour 14)
      expect(new Date(spread[0]!.scheduledAt).getUTCHours()).toBe(14);
    });
  });

  describe("adjustForTimezone", () => {
    it("converts UTC hour to target timezone offset", () => {
      // UTC 14:00 in America/New_York (UTC-4 in March) = 10:00 local
      const adjusted = adjustForTimezone("2026-04-01T14:00:00Z", -4);
      expect(new Date(adjusted).getUTCHours()).toBe(18); // 14 + 4 = 18 UTC to show 14 in -4
    });

    it("handles positive offsets", () => {
      // UTC 14:00 → UTC+9 (Tokyo) wants 14:00 local = 05:00 UTC
      const adjusted = adjustForTimezone("2026-04-01T14:00:00Z", 9);
      expect(new Date(adjusted).getUTCHours()).toBe(5);
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /home/winadmin/projects/BrandAmbassador && npx vitest run tests/services/scheduleOptimizer.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement schedule optimizer**

Create `src/services/scheduleOptimizer.ts`:

```typescript
import type { AudiencePattern } from "../../ui/pages/marketing/types.js";

interface ScheduledPost {
  scheduledAt: string;
  platform: string;
}

interface TimeRecommendation {
  datetime: string;
  score: number;
  reason: string;
}

interface SpreadResult {
  cardId: string;
  scheduledAt: string;
}

/**
 * Recommend optimal schedule times for a given platform and date.
 * Uses audience patterns (engagement history) and avoids crowded time slots.
 */
export function recommendScheduleTimes(
  patterns: AudiencePattern[],
  platform: string,
  dateStr: string, // YYYY-MM-DD
  existingScheduled: ScheduledPost[],
  topN: number,
): TimeRecommendation[] {
  const targetDate = new Date(dateStr + "T00:00:00Z");
  const dow = targetDate.getUTCDay();

  // Get patterns for this platform and day of week
  const dayPatterns = patterns
    .filter((p) => p.platform === platform && p.dayOfWeek === dow)
    .sort((a, b) => b.avgEngagement - a.avgEngagement);

  // If no patterns for this specific day, use all patterns for this platform
  const usePatterns = dayPatterns.length > 0
    ? dayPatterns
    : patterns.filter((p) => p.platform === platform).sort((a, b) => b.avgEngagement - a.avgEngagement);

  if (usePatterns.length === 0) {
    // Fallback: generic business hours
    return [9, 12, 14, 17, 20].slice(0, topN).map((h, i) => ({
      datetime: `${dateStr}T${h.toString().padStart(2, "0")}:00:00Z`,
      score: 1 - i * 0.15,
      reason: "Default business hour (no engagement history)",
    }));
  }

  const maxEngagement = usePatterns[0]!.avgEngagement;
  const sameDayScheduled = existingScheduled.filter((s) => {
    return s.platform === platform && s.scheduledAt.startsWith(dateStr);
  });

  const recommendations: TimeRecommendation[] = [];

  for (const pattern of usePatterns) {
    const hour = pattern.hourUtc;
    const datetime = `${dateStr}T${hour.toString().padStart(2, "0")}:00:00Z`;

    // Penalize crowded time windows (within 2 hours)
    const nearbyCount = sameDayScheduled.filter((s) => {
      const sHour = new Date(s.scheduledAt).getUTCHours();
      return Math.abs(sHour - hour) <= 2;
    }).length;

    const engagementScore = pattern.avgEngagement / maxEngagement;
    const crowdingPenalty = nearbyCount * 0.2;
    const score = Math.max(0, engagementScore - crowdingPenalty);

    const reason = nearbyCount > 0
      ? `Peak engagement hour for ${platform} (${nearbyCount} nearby posts, reduced score)`
      : `Peak engagement hour for ${platform}`;

    recommendations.push({ datetime, score, reason });
  }

  return recommendations
    .sort((a, b) => b.score - a.score)
    .slice(0, topN);
}

/**
 * Auto-spread N cards across optimal time slots with minimum spacing.
 */
export function autoSpreadSchedule(
  cardIds: string[],
  patterns: AudiencePattern[],
  platform: string,
  dateStr: string,
  minSpacingHours: number,
): SpreadResult[] {
  // Get all candidate hours sorted by engagement
  const targetDate = new Date(dateStr + "T00:00:00Z");
  const dow = targetDate.getUTCDay();

  const dayPatterns = patterns
    .filter((p) => p.platform === platform && (p.dayOfWeek === dow || patterns.filter((pp) => pp.platform === platform && pp.dayOfWeek === dow).length === 0))
    .sort((a, b) => b.avgEngagement - a.avgEngagement);

  const candidateHours = dayPatterns.length > 0
    ? dayPatterns.map((p) => p.hourUtc)
    : [9, 11, 14, 17, 20]; // fallback

  const results: SpreadResult[] = [];
  const usedHours: number[] = [];

  for (const cardId of cardIds) {
    // Find the best available hour that respects minimum spacing
    let bestHour: number | null = null;
    for (const hour of candidateHours) {
      const tooClose = usedHours.some((h) => Math.abs(h - hour) < minSpacingHours);
      if (!tooClose) {
        bestHour = hour;
        break;
      }
    }

    // If no slot respects spacing, find the most distant slot
    if (bestHour === null) {
      let maxMinDist = -1;
      for (let h = 6; h <= 23; h++) {
        const minDist = usedHours.length > 0
          ? Math.min(...usedHours.map((uh) => Math.abs(uh - h)))
          : 24;
        if (minDist > maxMinDist) {
          maxMinDist = minDist;
          bestHour = h;
        }
      }
    }

    bestHour = bestHour ?? 12;
    usedHours.push(bestHour);
    results.push({
      cardId,
      scheduledAt: `${dateStr}T${bestHour.toString().padStart(2, "0")}:00:00Z`,
    });
  }

  return results;
}

/**
 * Adjust a UTC datetime so it represents the same local hour in a target timezone.
 * offsetHours: target timezone offset from UTC (e.g., -4 for EDT, +9 for JST).
 * Returns a new UTC ISO string that, when displayed in UTC, shows what the user wants in their local timezone.
 */
export function adjustForTimezone(utcDatetime: string, offsetHours: number): string {
  const dt = new Date(utcDatetime);
  // Shift the time backwards by the offset so the "local" time becomes the desired UTC equivalent
  dt.setUTCHours(dt.getUTCHours() - offsetHours);
  return dt.toISOString();
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd /home/winadmin/projects/BrandAmbassador && npx vitest run tests/services/scheduleOptimizer.test.ts`
Expected: All 6 tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/services/scheduleOptimizer.ts tests/services/scheduleOptimizer.test.ts
git commit -m "feat(v3): add schedule optimizer with optimal times, auto-spread, and timezone support"
```

---

### Task 13: Scheduling Intelligence Handlers

**Files:**
- Modify: `src/handlers/actions.ts`
- Modify: `src/handlers/data.ts`
- Create: `tests/handlers/scheduleIntelligence.test.ts`

- [ ] **Step 1: Write failing tests for schedule intelligence handlers**

Create `tests/handlers/scheduleIntelligence.test.ts`:

```typescript
import { describe, it, expect, vi } from "vitest";
import {
  handleSuggestSchedule,
  handleAutoSpreadSchedule,
} from "../../src/handlers/actions.js";

function mockCtx(stateMap: Map<string, unknown> = new Map()) {
  return {
    state: {
      get: vi.fn(async (key: { scopeKind: string; scopeId?: string; namespace?: string; stateKey: string }) => {
        const flat = [key.scopeKind, key.scopeId, key.namespace, key.stateKey].filter(Boolean).join(":");
        return stateMap.get(flat) ?? null;
      }),
      set: vi.fn(async (key: { scopeKind: string; scopeId?: string; namespace?: string; stateKey: string }, val: unknown) => {
        const flat = [key.scopeKind, key.scopeId, key.namespace, key.stateKey].filter(Boolean).join(":");
        stateMap.set(flat, val);
      }),
    },
  };
}

describe("schedule intelligence handlers", () => {
  const companyId = "comp-1";

  describe("handleSuggestSchedule", () => {
    it("returns time recommendations based on audience patterns", async () => {
      const state = new Map<string, unknown>();
      state.set("company:comp-1:analytics:audience-patterns", [
        { platform: "twitter", dayOfWeek: 2, hourUtc: 14, avgEngagement: 200, postCount: 10 },
        { platform: "twitter", dayOfWeek: 2, hourUtc: 9, avgEngagement: 100, postCount: 8 },
      ]);
      state.set("company:comp-1:pipeline:cards", [
        { id: "card-1", platform: "twitter", status: "approved" },
      ]);
      const ctx = mockCtx(state);

      const result = await handleSuggestSchedule(ctx as any, companyId, {
        cardId: "card-1",
        date: "2026-03-31", // a Tuesday
      });

      expect(result.ok).toBe(true);
      expect(result.recommendations.length).toBeGreaterThan(0);
      expect(result.recommendations[0]!.score).toBeGreaterThan(0);
    });

    it("throws if card not found", async () => {
      const state = new Map<string, unknown>();
      state.set("company:comp-1:pipeline:cards", []);
      const ctx = mockCtx(state);

      await expect(
        handleSuggestSchedule(ctx as any, companyId, { cardId: "nope", date: "2026-03-31" }),
      ).rejects.toThrow("not found");
    });
  });

  describe("handleAutoSpreadSchedule", () => {
    it("schedules multiple cards with spacing", async () => {
      const state = new Map<string, unknown>();
      state.set("company:comp-1:analytics:audience-patterns", [
        { platform: "twitter", dayOfWeek: 2, hourUtc: 14, avgEngagement: 200, postCount: 10 },
        { platform: "twitter", dayOfWeek: 2, hourUtc: 9, avgEngagement: 150, postCount: 8 },
        { platform: "twitter", dayOfWeek: 2, hourUtc: 20, avgEngagement: 100, postCount: 6 },
      ]);
      state.set("company:comp-1:pipeline:cards", [
        { id: "c1", platform: "twitter", status: "approved" },
        { id: "c2", platform: "twitter", status: "approved" },
      ]);
      const ctx = mockCtx(state);

      const result = await handleAutoSpreadSchedule(ctx as any, companyId, {
        cardIds: ["c1", "c2"],
        date: "2026-03-31",
        minSpacingHours: 3,
      });

      expect(result.ok).toBe(true);
      expect(result.scheduled).toHaveLength(2);

      // Check cards were updated
      const cards = state.get("company:comp-1:pipeline:cards") as any[];
      const c1 = cards.find((c: any) => c.id === "c1");
      const c2 = cards.find((c: any) => c.id === "c2");
      expect(c1.scheduledAt).toBeTruthy();
      expect(c2.scheduledAt).toBeTruthy();
      expect(c1.scheduledStatus).toBe("pending");
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /home/winadmin/projects/BrandAmbassador && npx vitest run tests/handlers/scheduleIntelligence.test.ts`
Expected: FAIL — functions not exported

- [ ] **Step 3: Implement schedule intelligence handlers**

Add to `src/handlers/actions.ts`:

```typescript
// ---------------------------------------------------------------------------
// Schedule intelligence handlers (exported for testing)
// ---------------------------------------------------------------------------

import { recommendScheduleTimes, autoSpreadSchedule } from "../services/scheduleOptimizer.js";

export async function handleSuggestSchedule(
  ctx: any,
  companyId: string,
  params: { cardId: string; date: string },
): Promise<{ ok: true; recommendations: any[] }> {
  if (!companyId) throw new Error("companyId required");

  const cards: any[] = (await ctx.state.get({
    scopeKind: "company",
    scopeId: companyId,
    namespace: "pipeline",
    stateKey: "cards",
  })) ?? [];

  const card = cards.find((c: any) => c.id === params.cardId);
  if (!card) throw new Error(`Card ${params.cardId} not found`);

  const patterns: any[] = (await ctx.state.get({
    scopeKind: "company",
    scopeId: companyId,
    namespace: "analytics",
    stateKey: "audience-patterns",
  })) ?? [];

  // Get existing scheduled posts for this date
  const scheduled = cards
    .filter((c: any) => c.scheduledAt && c.scheduledAt.startsWith(params.date))
    .map((c: any) => ({ scheduledAt: c.scheduledAt, platform: c.platform }));

  const recommendations = recommendScheduleTimes(
    patterns,
    card.platform,
    params.date,
    scheduled,
    5,
  );

  return { ok: true, recommendations };
}

export async function handleAutoSpreadSchedule(
  ctx: any,
  companyId: string,
  params: { cardIds: string[]; date: string; minSpacingHours?: number },
): Promise<{ ok: true; scheduled: any[] }> {
  if (!companyId) throw new Error("companyId required");

  const cards: any[] = (await ctx.state.get({
    scopeKind: "company",
    scopeId: companyId,
    namespace: "pipeline",
    stateKey: "cards",
  })) ?? [];

  const patterns: any[] = (await ctx.state.get({
    scopeKind: "company",
    scopeId: companyId,
    namespace: "analytics",
    stateKey: "audience-patterns",
  })) ?? [];

  // Determine platform from first card
  const firstCard = cards.find((c: any) => params.cardIds.includes(c.id));
  const platform = firstCard?.platform ?? "twitter";

  const spread = autoSpreadSchedule(
    params.cardIds,
    patterns,
    platform,
    params.date,
    params.minSpacingHours ?? 3,
  );

  // Apply schedules to cards
  for (const entry of spread) {
    const idx = cards.findIndex((c: any) => c.id === entry.cardId);
    if (idx !== -1) {
      cards[idx] = {
        ...cards[idx]!,
        scheduledAt: entry.scheduledAt,
        scheduledStatus: "pending",
        updatedAt: new Date().toISOString(),
      };
    }
  }

  await ctx.state.set(
    { scopeKind: "company", scopeId: companyId, namespace: "pipeline", stateKey: "cards" },
    cards,
  );

  return { ok: true, scheduled: spread };
}
```

- [ ] **Step 4: Register actions and data handlers**

Add inside `registerActionHandlers`:

```typescript
  // ── suggest-schedule ─────────────────────────────────────────────────────
  ctx.actions.register("suggest-schedule", async (params) => {
    const p = params as { companyId: string; cardId: string; date: string };
    if (!p.companyId) return { error: "companyId is required" };
    if (!p.cardId) return { error: "cardId is required" };
    return handleSuggestSchedule(ctx, p.companyId, { cardId: p.cardId, date: p.date });
  });

  // ── auto-spread-schedule ─────────────────────────────────────────────────
  ctx.actions.register("auto-spread-schedule", async (params) => {
    const p = params as { companyId: string; cardIds: string[]; date: string; minSpacingHours?: number };
    if (!p.companyId) return { error: "companyId is required" };
    if (!p.cardIds?.length) return { error: "cardIds is required" };
    return handleAutoSpreadSchedule(ctx, p.companyId, {
      cardIds: p.cardIds,
      date: p.date,
      minSpacingHours: p.minSpacingHours,
    });
  });
```

Add in `registerDataHandlers` in `src/handlers/data.ts`:

```typescript
  // ── audience-patterns ────────────────────────────────────────────────────
  ctx.data.register("audience-patterns", async (params) => {
    const companyId = (params as { companyId?: string }).companyId;
    if (!companyId) return { patterns: [] };

    const patterns = await ctx.state.get({
      scopeKind: "company",
      scopeId: companyId,
      namespace: "analytics",
      stateKey: "audience-patterns",
    });

    return { patterns: (patterns as unknown[] | null) ?? [] };
  });

  // ── schedule-recommendations ─────────────────────────────────────────────
  ctx.data.register("schedule-recommendations", async (params) => {
    const { companyId, cardId, date } = params as { companyId?: string; cardId?: string; date?: string };
    if (!companyId || !cardId) return { recommendations: [] };

    const cards: any[] = (await ctx.state.get({
      scopeKind: "company", scopeId: companyId, namespace: "pipeline", stateKey: "cards",
    })) ?? [];

    const patterns: any[] = (await ctx.state.get({
      scopeKind: "company", scopeId: companyId, namespace: "analytics", stateKey: "audience-patterns",
    })) ?? [];

    const card = cards.find((c: any) => c.id === cardId);
    if (!card) return { recommendations: [] };

    const scheduled = cards
      .filter((c: any) => c.scheduledAt && date && c.scheduledAt.startsWith(date))
      .map((c: any) => ({ scheduledAt: c.scheduledAt, platform: c.platform }));

    const { recommendScheduleTimes } = await import("../services/scheduleOptimizer.js");
    const recommendations = recommendScheduleTimes(patterns, card.platform, date ?? new Date().toISOString().slice(0, 10), scheduled, 5);

    return { recommendations };
  });
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd /home/winadmin/projects/BrandAmbassador && npx vitest run tests/handlers/scheduleIntelligence.test.ts`
Expected: All 3 tests PASS

- [ ] **Step 6: Commit**

```bash
git add src/handlers/actions.ts src/handlers/data.ts tests/handlers/scheduleIntelligence.test.ts
git commit -m "feat(v3): add schedule intelligence handlers with optimal time suggestions and auto-spread"
```

---

### Task 14: Audience Pattern Aggregation in Engagement Check Job

**Files:**
- Modify: `src/jobs/engagement-check.ts`

- [ ] **Step 1: Add audience pattern aggregation after engagement polling**

In `src/jobs/engagement-check.ts`, after the `for (const company of companies)` loop processes cards, add audience pattern aggregation. Insert before `await ctx.metrics.write(...)`:

```typescript
      // ── V3: Build audience patterns from published cards with engagement ─────
      const publishedWithEngagement = cards.filter(
        (c: any) => c.status === "published" && c.platformPostRef && c.latestEngagement,
      );

      if (publishedWithEngagement.length > 0) {
        const { buildAudiencePatterns } = await import("../services/engagementAggregator.js");
        const postData = publishedWithEngagement.map((c: any) => ({
          platform: c.platform as string,
          publishedAt: c.platformPostRef.publishedAt as string,
          engagement: {
            likes: c.latestEngagement.likes ?? 0,
            comments: c.latestEngagement.comments ?? 0,
            shares: c.latestEngagement.shares ?? 0,
            impressions: c.latestEngagement.impressions ?? 0,
          },
        }));

        const patterns = buildAudiencePatterns(postData);

        await ctx.state.set({
          scopeKind: "company",
          scopeId: company.id,
          namespace: "analytics",
          stateKey: "audience-patterns",
        }, patterns);
      }
```

- [ ] **Step 2: Commit**

```bash
git add src/jobs/engagement-check.ts
git commit -m "feat(v3): add audience pattern aggregation to engagement check job"
```

---

### Task 15: Schedule Recommendations UI

**Files:**
- Create: `ui/pages/marketing/ScheduleRecommendations.tsx`
- Modify: `ui/pages/marketing/DetailPanel.tsx`
- Modify: `ui/pages/marketing/Calendar.tsx`

- [ ] **Step 1: Create ScheduleRecommendations component**

Create `ui/pages/marketing/ScheduleRecommendations.tsx`:

```tsx
import React, { useState } from "react";
import { usePluginAction, usePluginData } from "@paperclipai/plugin-sdk/ui";
import type { ScheduleRecommendation } from "./types.js";

interface ScheduleRecommendationsProps {
  cardId: string;
  platform: string;
  companyId: string;
  onSchedule: () => void;
}

export function ScheduleRecommendations({ cardId, platform, companyId, onSchedule }: ScheduleRecommendationsProps) {
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const suggestAction = usePluginAction("suggest-schedule");
  const scheduleAction = usePluginAction("schedule-content");
  const [recommendations, setRecommendations] = useState<Array<{ datetime: string; score: number; reason: string }>>([]);
  const [loading, setLoading] = useState(false);

  const handleSuggest = async () => {
    setLoading(true);
    try {
      const result = await suggestAction.execute({ companyId, cardId, date });
      setRecommendations(result.recommendations ?? []);
    } finally {
      setLoading(false);
    }
  };

  const handleScheduleAt = async (datetime: string) => {
    await scheduleAction.execute({ companyId, cardId, scheduledAt: datetime });
    onSchedule();
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: 8 }}>
      <div style={{ fontWeight: 600, fontSize: 13 }}>Optimal Schedule Times</div>

      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          style={{ padding: "4px 8px", borderRadius: 4, border: "1px solid #ccc", fontSize: 12 }}
        />
        <button
          onClick={handleSuggest}
          disabled={loading}
          style={{ padding: "4px 10px", borderRadius: 4, border: "none", background: "#4a90d9", color: "#fff", cursor: "pointer", fontSize: 12 }}
        >
          {loading ? "Analyzing..." : "Get Suggestions"}
        </button>
      </div>

      {recommendations.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {recommendations.map((rec, i) => (
            <div
              key={i}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "6px 8px",
                background: i === 0 ? "#e8f5e9" : "#f5f5f5",
                borderRadius: 4,
                fontSize: 12,
              }}
            >
              <div>
                <div style={{ fontWeight: 500 }}>
                  {new Date(rec.datetime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  {" "}
                  <span style={{
                    background: `hsl(${rec.score * 120}, 70%, 85%)`,
                    padding: "1px 6px",
                    borderRadius: 3,
                    fontSize: 10,
                  }}>
                    {(rec.score * 100).toFixed(0)}%
                  </span>
                </div>
                <div style={{ color: "#666", fontSize: 11 }}>{rec.reason}</div>
              </div>
              <button
                onClick={() => handleScheduleAt(rec.datetime)}
                style={{ padding: "3px 8px", borderRadius: 3, border: "1px solid #4caf50", background: "#fff", color: "#4caf50", cursor: "pointer", fontSize: 11 }}
              >
                Schedule
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Integrate into DetailPanel**

In `ui/pages/marketing/DetailPanel.tsx`, add the schedule recommendations to the schedule tab:

```tsx
// Add import:
import { ScheduleRecommendations } from "./ScheduleRecommendations.js";

// In the schedule tab section, below the existing schedule datetime picker, add:
{card.status === "approved" && !card.scheduledAt && (
  <ScheduleRecommendations
    cardId={card.id}
    platform={card.platform}
    companyId={companyId}
    onSchedule={() => refreshPipeline?.()}
  />
)}
```

- [ ] **Step 3: Add optimal time highlights to Calendar**

In `ui/pages/marketing/Calendar.tsx`, add visual indicators for recommended posting times. Find the day cell rendering and add a glow for peak hours:

```tsx
// Add import:
import { usePluginData } from "@paperclipai/plugin-sdk/ui";
import type { AudiencePattern } from "./types.js";

// Inside the Calendar component, add:
const { data: patternsData } = usePluginData<{ patterns: AudiencePattern[] }>("audience-patterns", { companyId });

// In the day cell render, add a "best time" indicator:
{patternsData?.patterns?.some((p) =>
  p.dayOfWeek === dayOfWeek && p.avgEngagement > 150
) && (
  <div style={{ fontSize: 9, color: "#4caf50", marginTop: 2 }}>
    Peak: {patternsData.patterns
      .filter((p) => p.dayOfWeek === dayOfWeek && p.platform === selectedPlatform)
      .sort((a, b) => b.avgEngagement - a.avgEngagement)
      .slice(0, 1)
      .map((p) => `${p.hourUtc}:00 UTC`)
      .join(", ")}
  </div>
)}
```

- [ ] **Step 4: Commit**

```bash
git add ui/pages/marketing/ScheduleRecommendations.tsx ui/pages/marketing/DetailPanel.tsx ui/pages/marketing/Calendar.tsx
git commit -m "feat(v3): add schedule recommendations UI with optimal time suggestions and calendar peak indicators"
```

---

## Phase 4: Cross-Campaign Analytics

> **Depends on:** Phase 0 (Task 1 — types), existing V2 analytics infrastructure

### Task 16: Campaign Comparison Handler

**Files:**
- Modify: `src/handlers/actions.ts`
- Modify: `src/handlers/data.ts`
- Create: `tests/handlers/campaignComparison.test.ts`

- [ ] **Step 1: Write failing tests for campaign comparison**

Create `tests/handlers/campaignComparison.test.ts`:

```typescript
import { describe, it, expect, vi } from "vitest";
import {
  handleCompareCampaigns,
  handleGenerateRetrospective,
  handleSetCampaignCost,
} from "../../src/handlers/actions.js";

function mockCtx(stateMap: Map<string, unknown> = new Map()) {
  return {
    state: {
      get: vi.fn(async (key: { scopeKind: string; scopeId?: string; namespace?: string; stateKey: string }) => {
        const flat = [key.scopeKind, key.scopeId, key.namespace, key.stateKey].filter(Boolean).join(":");
        return stateMap.get(flat) ?? null;
      }),
      set: vi.fn(async (key: { scopeKind: string; scopeId?: string; namespace?: string; stateKey: string }, val: unknown) => {
        const flat = [key.scopeKind, key.scopeId, key.namespace, key.stateKey].filter(Boolean).join(":");
        stateMap.set(flat, val);
      }),
    },
  };
}

describe("campaign comparison handlers", () => {
  const companyId = "comp-1";

  describe("handleCompareCampaigns", () => {
    it("returns side-by-side metrics for two campaigns", async () => {
      const state = new Map<string, unknown>();
      state.set("company:comp-1:campaigns:list", [
        { id: "camp-a", name: "Campaign A" },
        { id: "camp-b", name: "Campaign B" },
      ]);
      state.set("company:comp-1:pipeline:cards", [
        { id: "c1", campaignId: "camp-a", status: "published", platform: "twitter", createdAt: "2026-03-20", latestEngagement: { likes: 100, comments: 20, shares: 10, impressions: 1000 } },
        { id: "c2", campaignId: "camp-a", status: "published", platform: "twitter", createdAt: "2026-03-21", latestEngagement: { likes: 200, comments: 40, shares: 20, impressions: 2000 } },
        { id: "c3", campaignId: "camp-b", status: "published", platform: "reddit", createdAt: "2026-03-20", latestEngagement: { likes: 50, comments: 10, shares: 5, impressions: 500 } },
      ]);

      const ctx = mockCtx(state);
      const result = await handleCompareCampaigns(ctx as any, companyId, {
        campaignIds: ["camp-a", "camp-b"],
      });

      expect(result.ok).toBe(true);
      expect(result.comparison.campaigns).toHaveLength(2);

      const campA = result.comparison.campaigns.find((c: any) => c.campaignId === "camp-a");
      expect(campA!.metrics.totalPosts).toBe(2);
      expect(campA!.metrics.totalLikes).toBe(300);

      const campB = result.comparison.campaigns.find((c: any) => c.campaignId === "camp-b");
      expect(campB!.metrics.totalPosts).toBe(1);
      expect(campB!.metrics.totalLikes).toBe(50);
    });

    it("includes daily metrics breakdown", async () => {
      const state = new Map<string, unknown>();
      state.set("company:comp-1:campaigns:list", [{ id: "camp-a", name: "Campaign A" }]);
      state.set("company:comp-1:pipeline:cards", [
        { id: "c1", campaignId: "camp-a", status: "published", createdAt: "2026-03-20T10:00:00Z", latestEngagement: { likes: 100, comments: 20, shares: 10, impressions: 1000 } },
        { id: "c2", campaignId: "camp-a", status: "published", createdAt: "2026-03-20T15:00:00Z", latestEngagement: { likes: 50, comments: 10, shares: 5, impressions: 500 } },
      ]);

      const ctx = mockCtx(state);
      const result = await handleCompareCampaigns(ctx as any, companyId, {
        campaignIds: ["camp-a"],
      });

      const campA = result.comparison.campaigns[0]!;
      expect(campA.dailyMetrics.length).toBeGreaterThan(0);
      const dayEntry = campA.dailyMetrics.find((d: any) => d.date === "2026-03-20");
      expect(dayEntry).toBeDefined();
      expect(dayEntry!.likes).toBe(150);
    });
  });

  describe("handleSetCampaignCost", () => {
    it("stores cost for a campaign", async () => {
      const state = new Map<string, unknown>();
      const ctx = mockCtx(state);

      const result = await handleSetCampaignCost(ctx as any, companyId, {
        campaignId: "camp-a",
        cost: 500,
      });

      expect(result.ok).toBe(true);
      const costs = state.get("company:comp-1:campaigns:costs") as any;
      expect(costs["camp-a"]).toBe(500);
    });
  });

  describe("handleGenerateRetrospective", () => {
    it("generates a summary for a completed campaign", async () => {
      const state = new Map<string, unknown>();
      state.set("company:comp-1:campaigns:list", [
        { id: "camp-a", name: "Launch Campaign", dateRange: { start: "2026-03-01", end: "2026-03-15" } },
      ]);
      state.set("company:comp-1:pipeline:cards", [
        { id: "c1", campaignId: "camp-a", status: "published", topic: "Launch Post 1", platform: "twitter", createdAt: "2026-03-05", latestEngagement: { likes: 500, comments: 100, shares: 50, impressions: 5000 } },
        { id: "c2", campaignId: "camp-a", status: "published", topic: "Launch Post 2", platform: "reddit", createdAt: "2026-03-10", latestEngagement: { likes: 200, comments: 50, shares: 20, impressions: 2000 } },
      ]);

      const ctx = mockCtx(state);
      const result = await handleGenerateRetrospective(ctx as any, companyId, {
        campaignId: "camp-a",
      });

      expect(result.ok).toBe(true);
      expect(result.retrospective.campaignName).toBe("Launch Campaign");
      expect(result.retrospective.topPerformingPosts).toHaveLength(2);
      expect(result.retrospective.topPerformingPosts[0]!.topic).toBe("Launch Post 1");
      expect(result.retrospective.platformBreakdown.twitter).toBeDefined();
      expect(result.retrospective.summary).toContain("2 posts");
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /home/winadmin/projects/BrandAmbassador && npx vitest run tests/handlers/campaignComparison.test.ts`
Expected: FAIL — functions not exported

- [ ] **Step 3: Implement campaign comparison handlers**

Add to `src/handlers/actions.ts`:

```typescript
// ---------------------------------------------------------------------------
// Cross-campaign analytics handlers (exported for testing)
// ---------------------------------------------------------------------------

export async function handleCompareCampaigns(
  ctx: any,
  companyId: string,
  params: { campaignIds: string[] },
): Promise<{ ok: true; comparison: any }> {
  if (!companyId) throw new Error("companyId required");

  const campaigns: any[] = (await ctx.state.get({
    scopeKind: "company",
    scopeId: companyId,
    namespace: "campaigns",
    stateKey: "list",
  })) ?? [];

  const cards: any[] = (await ctx.state.get({
    scopeKind: "company",
    scopeId: companyId,
    namespace: "pipeline",
    stateKey: "cards",
  })) ?? [];

  const costs: Record<string, number> = (await ctx.state.get({
    scopeKind: "company",
    scopeId: companyId,
    namespace: "campaigns",
    stateKey: "costs",
  })) ?? {};

  const comparisonCampaigns = params.campaignIds.map((campId) => {
    const campaign = campaigns.find((c: any) => c.id === campId);
    const campCards = cards.filter((c: any) => c.campaignId === campId && c.status === "published");

    let totalLikes = 0, totalComments = 0, totalShares = 0, totalImpressions = 0;
    const dailyBuckets = new Map<string, { likes: number; comments: number; shares: number; impressions: number }>();

    for (const card of campCards) {
      const eng = card.latestEngagement ?? {};
      totalLikes += eng.likes ?? 0;
      totalComments += eng.comments ?? 0;
      totalShares += eng.shares ?? 0;
      totalImpressions += eng.impressions ?? 0;

      const day = (card.createdAt as string)?.slice(0, 10) ?? "unknown";
      const bucket = dailyBuckets.get(day) ?? { likes: 0, comments: 0, shares: 0, impressions: 0 };
      bucket.likes += eng.likes ?? 0;
      bucket.comments += eng.comments ?? 0;
      bucket.shares += eng.shares ?? 0;
      bucket.impressions += eng.impressions ?? 0;
      dailyBuckets.set(day, bucket);
    }

    const totalEngagement = totalLikes + totalComments + totalShares;
    const avgEngagementRate = totalImpressions > 0 ? totalEngagement / totalImpressions : 0;
    const cost = costs[campId];
    const costPerEngagement = cost && totalEngagement > 0 ? cost / totalEngagement : undefined;

    return {
      campaignId: campId,
      campaignName: campaign?.name ?? campId,
      metrics: {
        totalPosts: campCards.length,
        totalLikes,
        totalComments,
        totalShares,
        totalImpressions,
        avgEngagementRate,
        costPerEngagement,
      },
      dailyMetrics: Array.from(dailyBuckets.entries())
        .map(([date, m]) => ({ date, ...m }))
        .sort((a, b) => a.date.localeCompare(b.date)),
    };
  });

  return { ok: true, comparison: { campaigns: comparisonCampaigns } };
}

export async function handleSetCampaignCost(
  ctx: any,
  companyId: string,
  params: { campaignId: string; cost: number },
): Promise<{ ok: true }> {
  if (!companyId) throw new Error("companyId required");

  const costs: Record<string, number> = (await ctx.state.get({
    scopeKind: "company",
    scopeId: companyId,
    namespace: "campaigns",
    stateKey: "costs",
  })) ?? {};

  costs[params.campaignId] = params.cost;

  await ctx.state.set(
    { scopeKind: "company", scopeId: companyId, namespace: "campaigns", stateKey: "costs" },
    costs,
  );

  return { ok: true };
}

export async function handleGenerateRetrospective(
  ctx: any,
  companyId: string,
  params: { campaignId: string },
): Promise<{ ok: true; retrospective: any }> {
  if (!companyId) throw new Error("companyId required");

  const campaigns: any[] = (await ctx.state.get({
    scopeKind: "company",
    scopeId: companyId,
    namespace: "campaigns",
    stateKey: "list",
  })) ?? [];

  const campaign = campaigns.find((c: any) => c.id === params.campaignId);
  if (!campaign) throw new Error(`Campaign ${params.campaignId} not found`);

  const cards: any[] = (await ctx.state.get({
    scopeKind: "company",
    scopeId: companyId,
    namespace: "pipeline",
    stateKey: "cards",
  })) ?? [];

  const campCards = cards
    .filter((c: any) => c.campaignId === params.campaignId && c.status === "published")
    .map((c: any) => ({
      cardId: c.id,
      topic: c.topic,
      platform: c.platform,
      totalEngagement: (c.latestEngagement?.likes ?? 0) + (c.latestEngagement?.comments ?? 0) + (c.latestEngagement?.shares ?? 0),
      engagement: c.latestEngagement,
    }));

  // Sort by total engagement descending
  campCards.sort((a: any, b: any) => b.totalEngagement - a.totalEngagement);

  // Platform breakdown
  const platformBreakdown: Record<string, { posts: number; avgEngagement: number }> = {};
  for (const card of campCards) {
    const p = card.platform as string;
    if (!platformBreakdown[p]) platformBreakdown[p] = { posts: 0, avgEngagement: 0 };
    platformBreakdown[p]!.posts += 1;
    platformBreakdown[p]!.avgEngagement += card.totalEngagement;
  }
  for (const key of Object.keys(platformBreakdown)) {
    const entry = platformBreakdown[key]!;
    entry.avgEngagement = entry.posts > 0 ? Math.round(entry.avgEngagement / entry.posts) : 0;
  }

  const totalEngagement = campCards.reduce((s: number, c: any) => s + c.totalEngagement, 0);

  return {
    ok: true,
    retrospective: {
      campaignId: params.campaignId,
      campaignName: campaign.name,
      dateRange: campaign.dateRange,
      summary: `${campCards.length} posts published, ${totalEngagement} total engagements across ${Object.keys(platformBreakdown).length} platform(s).`,
      topPerformingPosts: campCards.slice(0, 5).map((c: any) => ({ cardId: c.cardId, topic: c.topic, totalEngagement: c.totalEngagement })),
      platformBreakdown,
      winningPatterns: [], // Populated when win-history has data
    },
  };
}
```

- [ ] **Step 4: Register actions and data handler**

Add inside `registerActionHandlers`:

```typescript
  // ── compare-campaigns ────────────────────────────────────────────────────
  ctx.actions.register("compare-campaigns", async (params) => {
    const p = params as { companyId: string; campaignIds: string[] };
    if (!p.companyId) return { error: "companyId is required" };
    if (!p.campaignIds?.length) return { error: "campaignIds is required" };
    return handleCompareCampaigns(ctx, p.companyId, { campaignIds: p.campaignIds });
  });

  // ── generate-retrospective ───────────────────────────────────────────────
  ctx.actions.register("generate-retrospective", async (params) => {
    const p = params as { companyId: string; campaignId: string };
    if (!p.companyId) return { error: "companyId is required" };
    if (!p.campaignId) return { error: "campaignId is required" };
    return handleGenerateRetrospective(ctx, p.companyId, { campaignId: p.campaignId });
  });

  // ── set-campaign-cost ────────────────────────────────────────────────────
  ctx.actions.register("set-campaign-cost", async (params) => {
    const p = params as { companyId: string; campaignId: string; cost: number };
    if (!p.companyId) return { error: "companyId is required" };
    if (!p.campaignId) return { error: "campaignId is required" };
    return handleSetCampaignCost(ctx, p.companyId, { campaignId: p.campaignId, cost: p.cost });
  });
```

Add in `registerDataHandlers`:

```typescript
  // ── campaign-comparison ──────────────────────────────────────────────────
  ctx.data.register("campaign-comparison", async (params) => {
    const { companyId, campaignIds } = params as { companyId?: string; campaignIds?: string[] };
    if (!companyId || !campaignIds?.length) return { campaigns: [] };

    const { handleCompareCampaigns } = await import("./actions.js");
    const result = await handleCompareCampaigns(ctx, companyId, { campaignIds });
    return result.comparison;
  });
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd /home/winadmin/projects/BrandAmbassador && npx vitest run tests/handlers/campaignComparison.test.ts`
Expected: All 4 tests PASS

- [ ] **Step 6: Commit**

```bash
git add src/handlers/actions.ts src/handlers/data.ts tests/handlers/campaignComparison.test.ts
git commit -m "feat(v3): add cross-campaign comparison, ROI tracking, and retrospective generation"
```

---

### Task 17: Campaign Comparison UI

**Files:**
- Create: `ui/pages/marketing/CampaignComparison.tsx`
- Modify: `ui/pages/marketing/Analytics.tsx`

- [ ] **Step 1: Create CampaignComparison component**

Create `ui/pages/marketing/CampaignComparison.tsx`:

```tsx
import React, { useState, useMemo } from "react";
import { usePluginData, usePluginAction } from "@paperclipai/plugin-sdk/ui";
import { Line, Bar } from "react-chartjs-2";
import type { Campaign, CampaignComparisonData } from "./types.js";

interface CampaignComparisonProps {
  companyId: string;
  campaigns: Campaign[];
}

const COLORS = ["#4a90d9", "#e74c3c", "#2ecc71", "#f39c12", "#9b59b6"];

export function CampaignComparison({ companyId, campaigns }: CampaignComparisonProps) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const compareAction = usePluginAction("compare-campaigns");
  const retrospectiveAction = usePluginAction("generate-retrospective");
  const setCostAction = usePluginAction("set-campaign-cost");
  const [comparison, setComparison] = useState<CampaignComparisonData | null>(null);
  const [retrospective, setRetrospective] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const toggleCampaign = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id].slice(0, 5),
    );
  };

  const handleCompare = async () => {
    if (selectedIds.length < 1) return;
    setLoading(true);
    try {
      const result = await compareAction.execute({ companyId, campaignIds: selectedIds });
      setComparison(result.comparison);
    } finally {
      setLoading(false);
    }
  };

  const handleRetrospective = async (campaignId: string) => {
    const result = await retrospectiveAction.execute({ companyId, campaignId });
    setRetrospective(result.retrospective);
  };

  const lineData = useMemo(() => {
    if (!comparison) return null;
    const allDates = new Set<string>();
    for (const camp of comparison.campaigns) {
      for (const d of camp.dailyMetrics) allDates.add(d.date);
    }
    const labels = Array.from(allDates).sort();

    return {
      labels,
      datasets: comparison.campaigns.map((camp, i) => ({
        label: camp.campaignName,
        data: labels.map((date) => {
          const day = camp.dailyMetrics.find((d) => d.date === date);
          return day ? day.likes + day.comments + day.shares : 0;
        }),
        borderColor: COLORS[i % COLORS.length],
        tension: 0.3,
        fill: false,
      })),
    };
  }, [comparison]);

  const barData = useMemo(() => {
    if (!comparison) return null;
    return {
      labels: comparison.campaigns.map((c) => c.campaignName),
      datasets: [
        {
          label: "Likes",
          data: comparison.campaigns.map((c) => c.metrics.totalLikes),
          backgroundColor: "#4a90d9",
        },
        {
          label: "Comments",
          data: comparison.campaigns.map((c) => c.metrics.totalComments),
          backgroundColor: "#2ecc71",
        },
        {
          label: "Shares",
          data: comparison.campaigns.map((c) => c.metrics.totalShares),
          backgroundColor: "#f39c12",
        },
      ],
    };
  }, [comparison]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ fontWeight: 600, fontSize: 15 }}>Campaign Comparison</div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {campaigns.map((c) => (
          <button
            key={c.id}
            onClick={() => toggleCampaign(c.id)}
            style={{
              padding: "4px 10px",
              borderRadius: 4,
              border: selectedIds.includes(c.id) ? "2px solid #4a90d9" : "1px solid #ccc",
              background: selectedIds.includes(c.id) ? "#e8f0fe" : "#fff",
              cursor: "pointer",
              fontSize: 12,
            }}
          >
            {c.name}
          </button>
        ))}
      </div>

      <button
        onClick={handleCompare}
        disabled={selectedIds.length < 1 || loading}
        style={{ padding: "6px 14px", borderRadius: 6, border: "none", background: "#4a90d9", color: "#fff", cursor: "pointer", alignSelf: "flex-start", fontSize: 13 }}
      >
        {loading ? "Comparing..." : `Compare ${selectedIds.length} Campaign(s)`}
      </button>

      {comparison && (
        <>
          {/* Metrics Table */}
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead>
              <tr style={{ borderBottom: "2px solid #ddd" }}>
                <th style={{ textAlign: "left", padding: 6 }}>Campaign</th>
                <th style={{ textAlign: "right", padding: 6 }}>Posts</th>
                <th style={{ textAlign: "right", padding: 6 }}>Likes</th>
                <th style={{ textAlign: "right", padding: 6 }}>Comments</th>
                <th style={{ textAlign: "right", padding: 6 }}>Shares</th>
                <th style={{ textAlign: "right", padding: 6 }}>Eng. Rate</th>
                <th style={{ textAlign: "right", padding: 6 }}>Cost/Eng.</th>
                <th style={{ padding: 6 }}></th>
              </tr>
            </thead>
            <tbody>
              {comparison.campaigns.map((c) => (
                <tr key={c.campaignId} style={{ borderBottom: "1px solid #eee" }}>
                  <td style={{ padding: 6, fontWeight: 500 }}>{c.campaignName}</td>
                  <td style={{ textAlign: "right", padding: 6 }}>{c.metrics.totalPosts}</td>
                  <td style={{ textAlign: "right", padding: 6 }}>{c.metrics.totalLikes}</td>
                  <td style={{ textAlign: "right", padding: 6 }}>{c.metrics.totalComments}</td>
                  <td style={{ textAlign: "right", padding: 6 }}>{c.metrics.totalShares}</td>
                  <td style={{ textAlign: "right", padding: 6 }}>{(c.metrics.avgEngagementRate * 100).toFixed(1)}%</td>
                  <td style={{ textAlign: "right", padding: 6 }}>{c.metrics.costPerEngagement != null ? `$${c.metrics.costPerEngagement.toFixed(2)}` : "—"}</td>
                  <td style={{ padding: 6 }}>
                    <button
                      onClick={() => handleRetrospective(c.campaignId)}
                      style={{ padding: "2px 6px", borderRadius: 3, border: "1px solid #ccc", background: "#fff", cursor: "pointer", fontSize: 10 }}
                    >
                      Retro
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Charts */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            {lineData && (
              <div style={{ background: "#fff", padding: 12, borderRadius: 8, border: "1px solid #eee" }}>
                <div style={{ fontWeight: 500, marginBottom: 8, fontSize: 13 }}>Engagement Over Time</div>
                <Line data={lineData} options={{ responsive: true, plugins: { legend: { position: "bottom" } } }} />
              </div>
            )}
            {barData && (
              <div style={{ background: "#fff", padding: 12, borderRadius: 8, border: "1px solid #eee" }}>
                <div style={{ fontWeight: 500, marginBottom: 8, fontSize: 13 }}>Total Engagement</div>
                <Bar data={barData} options={{ responsive: true, plugins: { legend: { position: "bottom" } } }} />
              </div>
            )}
          </div>
        </>
      )}

      {/* Retrospective Panel */}
      {retrospective && (
        <div style={{ background: "#f8f9fa", padding: 12, borderRadius: 8, border: "1px solid #ddd" }}>
          <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 8 }}>{retrospective.campaignName} — Retrospective</div>
          <p style={{ margin: "4px 0", fontSize: 13 }}>{retrospective.summary}</p>

          <div style={{ fontWeight: 500, marginTop: 8, fontSize: 13 }}>Top Performing Posts:</div>
          <ol style={{ margin: "4px 0", paddingLeft: 20, fontSize: 12 }}>
            {retrospective.topPerformingPosts.map((p: any) => (
              <li key={p.cardId}>{p.topic} — {p.totalEngagement} engagements</li>
            ))}
          </ol>

          <div style={{ fontWeight: 500, marginTop: 8, fontSize: 13 }}>Platform Breakdown:</div>
          <div style={{ display: "flex", gap: 12, marginTop: 4 }}>
            {Object.entries(retrospective.platformBreakdown).map(([platform, data]: [string, any]) => (
              <div key={platform} style={{ padding: "4px 10px", background: "#fff", borderRadius: 4, border: "1px solid #eee", fontSize: 12 }}>
                <div style={{ fontWeight: 500 }}>{platform}</div>
                <div>{data.posts} posts, avg {data.avgEngagement} eng.</div>
              </div>
            ))}
          </div>

          <button
            onClick={() => setRetrospective(null)}
            style={{ marginTop: 8, padding: "4px 10px", borderRadius: 4, border: "1px solid #ccc", background: "#fff", cursor: "pointer", fontSize: 12 }}
          >
            Close
          </button>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Add Campaign Comparison tab to Analytics**

In `ui/pages/marketing/Analytics.tsx`, add a "Compare" tab that renders `<CampaignComparison>`:

```tsx
// Add import:
import { CampaignComparison } from "./CampaignComparison.js";
import type { Campaign } from "./types.js";

// Add props:
interface AnalyticsProps {
  companyId: string;
  campaigns?: Campaign[];
}

// Add a "Compare" tab button alongside existing chart tabs:
<button
  onClick={() => setActiveView("compare")}
  style={{
    padding: "6px 12px",
    borderRadius: 4,
    border: activeView === "compare" ? "2px solid #4a90d9" : "1px solid #ccc",
    background: activeView === "compare" ? "#e8f0fe" : "#fff",
    cursor: "pointer",
    fontSize: 12,
  }}
>
  Compare Campaigns
</button>

// Add the comparison view:
{activeView === "compare" && (
  <CampaignComparison
    companyId={companyId}
    campaigns={campaigns ?? []}
  />
)}
```

- [ ] **Step 3: Commit**

```bash
git add ui/pages/marketing/CampaignComparison.tsx ui/pages/marketing/Analytics.tsx
git commit -m "feat(v3): add campaign comparison UI with charts, metrics table, and retrospective panel"
```

---

## Phase 5: Agent Tools & Wiring

> **Depends on:** Phases 1-4 (all feature handlers implemented)

### Task 18: Register optimize-brand-settings Agent Tool

**Files:**
- Modify: `src/manifest.ts`

- [ ] **Step 1: Add optimize-brand-settings to manifest tools**

In `src/manifest.ts`, add to the `tools` array:

```typescript
    {
      name: "optimize-brand-settings",
      displayName: "Optimize Brand Settings",
      description: "Analyze A/B test win patterns and suggest brand setting optimizations based on which content attributes consistently win.",
      parametersSchema: {
        type: "object",
        properties: {
          companyId: { type: "string", description: "Company ID" },
        },
        required: ["companyId"],
      },
    },
```

- [ ] **Step 2: Commit**

```bash
git add src/manifest.ts
git commit -m "feat(v3): register optimize-brand-settings agent tool in manifest"
```

---

### Task 19: Update Constants for V3 Data/Action Keys

**Files:**
- Modify: `src/constants.ts`

This task ensures all V3 keys from Task 1 are actually added to the constants file. If Task 1 was implemented correctly, verify the keys exist. If not, add them now.

- [ ] **Step 1: Verify and complete V3 constants**

Verify `src/constants.ts` contains all V3 additions from Task 1 Step 2. If any are missing, add them:

```typescript
// In TOOL_NAMES:
  optimizeBrandSettings: "optimize-brand-settings",

// In STATE_KEYS:
  contentHistory: "content-history",
  audiencePatterns: "audience-patterns",
  winPatterns: "win-patterns",
  brandSuggestions: "brand-suggestions",
  campaignCosts: "campaign-costs",

// In DATA_KEYS:
  contentHistory: "content-history",
  audiencePatterns: "audience-patterns",
  campaignComparison: "campaign-comparison",
  scheduleRecommendations: "schedule-recommendations",
  brandSuggestions: "brand-suggestions",

// In ACTION_KEYS:
  saveContentVersion: "save-content-version",
  rollbackContent: "rollback-content",
  autoPickWinner: "auto-pick-winner",
  suggestSchedule: "suggest-schedule",
  autoSpreadSchedule: "auto-spread-schedule",
  compareCampaigns: "compare-campaigns",
  generateRetrospective: "generate-retrospective",
  optimizeBrandSettings: "optimize-brand-settings",
  acceptBrandSuggestion: "accept-brand-suggestion",
  dismissBrandSuggestion: "dismiss-brand-suggestion",
  setCampaignCost: "set-campaign-cost",

// Helper:
export const contentHistoryKey = (cardId: string) => `content-history:${cardId}`;
```

- [ ] **Step 2: Commit**

```bash
git add src/constants.ts
git commit -m "feat(v3): finalize V3 constants — all data keys, action keys, state keys, tool names"
```

---

## Phase 6: Verification

> **Depends on:** All previous phases

### Task 20: TypeScript Verification & Full Test Run

**Files:**
- None (verification only)

- [ ] **Step 1: TypeScript compilation check**

Run: `cd /home/winadmin/projects/BrandAmbassador && npx tsc --noEmit`
Expected: 0 errors

If there are errors, fix them. Common issues:
- Missing imports for new types
- Import path mismatches (`.js` extensions required for ESM)
- Type mismatches between handler return types and action registrations

- [ ] **Step 2: Run full test suite**

Run: `cd /home/winadmin/projects/BrandAmbassador && npx vitest run`
Expected: All tests pass (existing 80 + new ~30 = ~110 tests)

New test files:
- `tests/services/statistics.test.ts` (9 tests)
- `tests/services/engagementAggregator.test.ts` (6 tests)
- `tests/services/contentHistory.test.ts` (6 tests)
- `tests/services/patternExtractor.test.ts` (5 tests)
- `tests/services/scheduleOptimizer.test.ts` (6 tests)
- `tests/handlers/contentHistory.test.ts` (6 tests)
- `tests/handlers/autoWinner.test.ts` (4 tests)
- `tests/handlers/scheduleIntelligence.test.ts` (3 tests)
- `tests/handlers/campaignComparison.test.ts` (4 tests)

If any tests fail, diagnose and fix.

- [ ] **Step 3: Verify no regressions in existing tests**

Run: `cd /home/winadmin/projects/BrandAmbassador && npx vitest run tests/handlers/campaigns.test.ts tests/handlers/scheduling.test.ts tests/handlers/variants.test.ts tests/handlers/templates.test.ts tests/handlers/bulkOps.test.ts`
Expected: All existing tests still pass

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "feat(v3): Marketing Hub V3 complete — auto-learning, scheduling intelligence, cross-campaign analytics, content versioning"
```

---

## Summary

| Phase | Tasks | New Files | New Tests |
|-------|-------|-----------|-----------|
| Phase 0: Foundation | 4 | 4 services, 4 test files | ~26 |
| Phase 1: Content Versioning | 3 | 1 UI component, 1 test file | ~6 |
| Phase 2: A/B Auto-Learning | 4 | 1 service, 2 test files | ~9 |
| Phase 3: Scheduling Intelligence | 4 | 2 UI components, 2 test files | ~9 |
| Phase 4: Cross-Campaign Analytics | 2 | 1 UI component, 1 test file | ~4 |
| Phase 5: Agent Tools | 2 | 0 | 0 |
| Phase 6: Verification | 1 | 0 | 0 |
| **Total** | **20** | **9 new + 11 modified** | **~49 new tests** |
