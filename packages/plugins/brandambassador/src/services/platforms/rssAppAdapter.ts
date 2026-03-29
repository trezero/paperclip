/**
 * RSS.app adapter — feed management, polling, webhook receiver, and trend scoring.
 *
 * RSS.app is a cross-platform monitoring layer, not a publishing platform.
 * It creates RSS feeds for configured keywords + platform URLs and pushes
 * updates via webhooks.
 */

import { resilientFetch } from "./resilientHttp.js";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const RSSAPP_API = "https://api.rss.app/v1";
const SERVICE_NAME = "rssapp";

// ---------------------------------------------------------------------------
// Credentials
// ---------------------------------------------------------------------------

export interface RssAppCredentials {
  apiKey: string;
  apiSecret: string;
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RssAppFeed {
  id: string;
  title: string;
  url: string;
  status: "active" | "paused" | "error";
  itemCount: number;
  lastFetchedAt: string | null;
}

export interface RssAppFeedItem {
  id: string;
  title: string;
  description: string;
  link: string;
  pubDate: string;
  source: string;
  categories: string[];
}

export interface ScoredTrend {
  id: string;
  title: string;
  description: string;
  url: string;
  platform: string;
  score: number;
  sentiment: "positive" | "negative" | "neutral";
  velocity: "rising" | "stable" | "falling";
  firstSeen: string;
  lastUpdated: string;
  mentionCount: number;
  sourceFeeds: string[];
  dismissed: boolean;
}

export interface WebhookPayload {
  feedId: string;
  items: RssAppFeedItem[];
  timestamp: string;
}

// ---------------------------------------------------------------------------
// Scoring pipeline
// ---------------------------------------------------------------------------

const RECENCY_DECAY_MS = 24 * 60 * 60 * 1000; // 24 hours
const SPAM_PATTERNS = [
  /buy now/i,
  /click here/i,
  /limited offer/i,
  /dm for/i,
  /send \d+ sol/i,
  /airdrop.*claim/i,
];

function detectPlatform(url: string): string {
  if (url.includes("twitter.com") || url.includes("x.com")) return "twitter";
  if (url.includes("reddit.com")) return "reddit";
  if (url.includes("t.me") || url.includes("telegram")) return "telegram";
  return "web";
}

function isSpam(text: string): boolean {
  return SPAM_PATTERNS.some((p) => p.test(text));
}

function computeRecencyBoost(pubDate: string): number {
  const ageMs = Date.now() - new Date(pubDate).getTime();
  if (ageMs < 0) return 1;
  // Linear decay from 1.0 to 0.0 over 24h
  return Math.max(0, 1 - ageMs / RECENCY_DECAY_MS);
}

export function scoreItems(
  items: RssAppFeedItem[],
  brandKeywords: string[],
): ScoredTrend[] {
  const keywordSet = new Set(brandKeywords.map((k) => k.toLowerCase()));

  return items
    .filter((item) => !isSpam(item.title + " " + item.description))
    .map((item) => {
      const text = `${item.title} ${item.description}`.toLowerCase();
      const platform = detectPlatform(item.link);

      // Base score from keyword relevance
      let score = 0;
      for (const kw of keywordSet) {
        if (text.includes(kw)) score += 20;
      }

      // Recency boost (0-30 points)
      score += Math.round(computeRecencyBoost(item.pubDate) * 30);

      // Cross-source bonus (applied later when merging)
      // Category bonus
      if (item.categories.some((c) => keywordSet.has(c.toLowerCase()))) {
        score += 10;
      }

      return {
        id: item.id || `rss-${Buffer.from(item.link).toString("base64").slice(0, 16)}`,
        title: item.title.slice(0, 200),
        description: item.description.slice(0, 500),
        url: item.link,
        platform,
        score: Math.min(100, Math.max(0, score)),
        sentiment: "neutral" as const,
        velocity: "stable" as const,
        firstSeen: item.pubDate,
        lastUpdated: new Date().toISOString(),
        mentionCount: 1,
        sourceFeeds: [item.source],
        dismissed: false,
      };
    })
    .sort((a, b) => b.score - a.score);
}

export function dedupeAndMerge(
  existing: ScoredTrend[],
  incoming: ScoredTrend[],
): ScoredTrend[] {
  const byUrl = new Map<string, ScoredTrend>();

  for (const t of existing) {
    byUrl.set(t.url, t);
  }

  for (const t of incoming) {
    const prev = byUrl.get(t.url);
    if (prev) {
      // Merge: bump mention count, keep higher score, union source feeds
      prev.mentionCount += 1;
      prev.score = Math.min(100, Math.max(prev.score, t.score) + 5); // cross-source bonus
      prev.lastUpdated = t.lastUpdated;
      const feedSet = new Set([...prev.sourceFeeds, ...t.sourceFeeds]);
      prev.sourceFeeds = Array.from(feedSet);
      if (prev.mentionCount > 3) prev.velocity = "rising";
    } else {
      byUrl.set(t.url, t);
    }
  }

  return Array.from(byUrl.values())
    .filter((t) => !t.dismissed)
    .sort((a, b) => b.score - a.score);
}

// ---------------------------------------------------------------------------
// Adapter
// ---------------------------------------------------------------------------

export class RssAppAdapter {
  private creds: RssAppCredentials | null;

  constructor(creds: RssAppCredentials | null) {
    this.creds = creds;
  }

  updateCredentials(creds: RssAppCredentials | null): void {
    this.creds = creds;
  }

  get isConfigured(): boolean {
    return !!this.creds;
  }

  private headers(): Record<string, string> {
    return {
      "Content-Type": "application/json",
      Authorization: `Bearer ${this.creds!.apiKey}`,
    };
  }

  // -----------------------------------------------------------------------
  // Feed management
  // -----------------------------------------------------------------------

  async listFeeds(): Promise<RssAppFeed[]> {
    if (!this.creds) return [];

    const res = await resilientFetch(
      `${RSSAPP_API}/feeds`,
      { headers: this.headers() },
      { serviceName: SERVICE_NAME, endpointKey: "GET /feeds", maxRetries: 1, timeoutMs: 8_000 },
    );

    const json = (await res.json()) as { data?: RssAppFeed[] };
    return json.data ?? [];
  }

  async createFeed(title: string, url: string): Promise<RssAppFeed | null> {
    if (!this.creds) return null;

    const res = await resilientFetch(
      `${RSSAPP_API}/feeds`,
      {
        method: "POST",
        headers: this.headers(),
        body: JSON.stringify({ title, url }),
      },
      { serviceName: SERVICE_NAME, endpointKey: "POST /feeds", maxRetries: 1, timeoutMs: 10_000 },
    );

    const json = (await res.json()) as { data?: RssAppFeed; error?: string };
    return json.data ?? null;
  }

  async deleteFeed(feedId: string): Promise<boolean> {
    if (!this.creds) return false;

    try {
      await resilientFetch(
        `${RSSAPP_API}/feeds/${feedId}`,
        { method: "DELETE", headers: this.headers() },
        { serviceName: SERVICE_NAME, endpointKey: "DELETE /feeds/:id", maxRetries: 1, timeoutMs: 8_000 },
      );
      return true;
    } catch {
      return false;
    }
  }

  async getFeedItems(feedId: string, limit = 20): Promise<RssAppFeedItem[]> {
    if (!this.creds) return [];

    const res = await resilientFetch(
      `${RSSAPP_API}/feeds/${feedId}/items?limit=${limit}`,
      { headers: this.headers() },
      { serviceName: SERVICE_NAME, endpointKey: "GET /feeds/:id/items", maxRetries: 1, timeoutMs: 8_000 },
    );

    const json = (await res.json()) as { data?: RssAppFeedItem[] };
    return json.data ?? [];
  }

  // -----------------------------------------------------------------------
  // Feed reconciliation — sync feeds to match brand settings
  // -----------------------------------------------------------------------

  async reconcileFeeds(
    brandKeywords: string[],
    platforms: string[],
  ): Promise<{ created: string[]; deleted: string[] }> {
    if (!this.creds) return { created: [], deleted: [] };

    const existing = await this.listFeeds();
    const existingTitles = new Set(existing.map((f) => f.title));

    const desiredFeeds: { title: string; url: string }[] = [];

    // Keyword-based feeds
    for (const kw of brandKeywords) {
      const title = `kw:${kw}`;
      if (!existingTitles.has(title)) {
        // RSS.app keyword feed URLs
        desiredFeeds.push({ title, url: `https://rss.app/feeds/keyword/${encodeURIComponent(kw)}` });
      }
    }

    // Platform-specific feeds
    for (const platform of platforms) {
      for (const kw of brandKeywords) {
        const title = `${platform}:${kw}`;
        if (existingTitles.has(title)) continue;

        switch (platform) {
          case "twitter":
            desiredFeeds.push({
              title,
              url: `https://rss.app/feeds/twitter/search/${encodeURIComponent(kw)}`,
            });
            break;
          case "reddit":
            desiredFeeds.push({
              title,
              url: `https://rss.app/feeds/reddit/search/${encodeURIComponent(kw)}`,
            });
            break;
          case "telegram":
            // Telegram feeds require specific channel URLs — skip keyword feeds
            break;
        }
      }
    }

    // Create new feeds
    const created: string[] = [];
    for (const feed of desiredFeeds) {
      const result = await this.createFeed(feed.title, feed.url);
      if (result) created.push(result.id);
    }

    // Delete feeds whose keywords have been removed
    const desiredTitles = new Set([
      ...brandKeywords.map((kw) => `kw:${kw}`),
      ...platforms.flatMap((p) => brandKeywords.map((kw) => `${p}:${kw}`)),
    ]);

    const deleted: string[] = [];
    for (const feed of existing) {
      // Only delete feeds we previously created (prefixed titles)
      if ((feed.title.startsWith("kw:") || feed.title.includes(":")) && !desiredTitles.has(feed.title)) {
        const ok = await this.deleteFeed(feed.id);
        if (ok) deleted.push(feed.id);
      }
    }

    return { created, deleted };
  }

  // -----------------------------------------------------------------------
  // Webhook processing
  // -----------------------------------------------------------------------

  processWebhook(
    payload: WebhookPayload,
    brandKeywords: string[],
  ): ScoredTrend[] {
    return scoreItems(payload.items, brandKeywords);
  }

  // -----------------------------------------------------------------------
  // Polling (fallback when webhooks not configured)
  // -----------------------------------------------------------------------

  async pollAllFeeds(brandKeywords: string[]): Promise<ScoredTrend[]> {
    if (!this.creds) return [];

    const feeds = await this.listFeeds();
    const allItems: RssAppFeedItem[] = [];

    for (const feed of feeds) {
      const items = await this.getFeedItems(feed.id);
      allItems.push(...items);
    }

    return scoreItems(allItems, brandKeywords);
  }

  // -----------------------------------------------------------------------
  // Health
  // -----------------------------------------------------------------------

  async health(): Promise<{ ok: boolean; reason?: string }> {
    if (!this.creds) return { ok: false, reason: "RSS.app credentials not configured" };

    try {
      const res = await resilientFetch(
        `${RSSAPP_API}/feeds?limit=1`,
        { headers: this.headers() },
        { serviceName: SERVICE_NAME, endpointKey: "health", maxRetries: 0, timeoutMs: 5_000 },
      );
      return res.ok ? { ok: true } : { ok: false, reason: `Status ${res.status}` };
    } catch (err: any) {
      return { ok: false, reason: err.message };
    }
  }
}
