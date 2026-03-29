/**
 * Twitter adapter using TweetAPI.com as the posting/reading backend.
 *
 * Falls back to mock mode when TWEETAPI_API_KEY is not configured.
 */

import type {
  PlatformAdapter,
  PublishPayload,
  PublishResult,
  PlatformPostRef,
  EngagementMetrics,
  TrendQuery,
  TrendItem,
  AdapterHealth,
} from "./adapter.js";
import { mockPublishResult, mockEngagement } from "./adapter.js";
import { resilientFetch } from "./resilientHttp.js";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const TWEETAPI_BASE = "https://api.tweetapi.com/v1";
const SERVICE_NAME = "tweetapi";

// ---------------------------------------------------------------------------
// Response shapes
// ---------------------------------------------------------------------------

interface TweetApiPostResponse {
  data?: {
    id: string;
    text: string;
  };
  error?: string;
}

interface TweetApiTweetMetrics {
  public_metrics?: {
    like_count: number;
    reply_count: number;
    retweet_count: number;
    quote_count: number;
    impression_count: number;
  };
}

interface TweetApiSearchResult {
  data?: Array<{
    id: string;
    text: string;
    author_id: string;
    created_at: string;
    public_metrics?: {
      like_count: number;
      reply_count: number;
      retweet_count: number;
    };
  }>;
}

// ---------------------------------------------------------------------------
// Thread splitting
// ---------------------------------------------------------------------------

const TWITTER_MAX_CHARS = 280;

function splitThread(text: string): string[] {
  if (text.length <= TWITTER_MAX_CHARS) return [text];

  const sentences = text.match(/[^.!?]+[.!?]+\s*/g) ?? [text];
  const tweets: string[] = [];
  let current = "";

  for (const sentence of sentences) {
    const trimmed = sentence.trim();
    const candidate = current ? `${current} ${trimmed}` : trimmed;

    if (candidate.length <= TWITTER_MAX_CHARS) {
      current = candidate;
    } else {
      if (current) tweets.push(current);
      // If a single sentence exceeds limit, hard-split on word boundary
      if (trimmed.length > TWITTER_MAX_CHARS) {
        const words = trimmed.split(/\s+/);
        let chunk = "";
        for (const word of words) {
          const next = chunk ? `${chunk} ${word}` : word;
          if (next.length > TWITTER_MAX_CHARS) {
            if (chunk) tweets.push(chunk);
            chunk = word;
          } else {
            chunk = next;
          }
        }
        current = chunk;
      } else {
        current = trimmed;
      }
    }
  }
  if (current) tweets.push(current);
  return tweets;
}

// ---------------------------------------------------------------------------
// Adapter
// ---------------------------------------------------------------------------

export class TwitterAdapter implements PlatformAdapter {
  readonly platform = "twitter" as const;
  private apiKey: string | null;

  constructor(apiKey: string | null) {
    this.apiKey = apiKey;
  }

  updateCredentials(apiKey: string | null): void {
    this.apiKey = apiKey;
  }

  private get isMock(): boolean {
    return !this.apiKey;
  }

  private headers(): Record<string, string> {
    return {
      "Content-Type": "application/json",
      Authorization: `Bearer ${this.apiKey}`,
    };
  }

  // -----------------------------------------------------------------------
  // Publish
  // -----------------------------------------------------------------------

  async publish(payload: PublishPayload): Promise<PublishResult> {
    if (this.isMock) return mockPublishResult("twitter");

    const parts =
      payload.threadSplit !== false ? splitThread(payload.caption) : [payload.caption];

    let firstId = "";
    let replyToId: string | undefined;

    for (const text of parts) {
      const body: Record<string, unknown> = { text };
      if (replyToId) body.reply = { in_reply_to_tweet_id: replyToId };
      if (!replyToId && payload.mediaRef) {
        body.media = { media_ids: [payload.mediaRef] };
      }

      const res = await resilientFetch(
        `${TWEETAPI_BASE}/tweets`,
        { method: "POST", headers: this.headers(), body: JSON.stringify(body) },
        { serviceName: SERVICE_NAME, endpointKey: "POST /tweets", maxRetries: 1, timeoutMs: 10_000 },
      );

      const json = (await res.json()) as TweetApiPostResponse;
      if (json.error || !json.data) {
        return {
          success: false,
          platformPostId: "",
          platformUrl: "",
          error: json.error ?? "Unknown TweetAPI error",
        };
      }

      if (!firstId) firstId = json.data.id;
      replyToId = json.data.id;
    }

    return {
      success: true,
      platformPostId: firstId,
      platformUrl: `https://twitter.com/i/status/${firstId}`,
    };
  }

  // -----------------------------------------------------------------------
  // Engagement
  // -----------------------------------------------------------------------

  async getEngagement(ref: PlatformPostRef): Promise<EngagementMetrics> {
    if (this.isMock) return mockEngagement("twitter");

    const res = await resilientFetch(
      `${TWEETAPI_BASE}/tweets/${ref.postId}?tweet.fields=public_metrics`,
      { headers: this.headers() },
      { serviceName: SERVICE_NAME, endpointKey: "GET /tweets/:id", maxRetries: 1, timeoutMs: 8_000 },
    );

    const json = (await res.json()) as TweetApiTweetMetrics;
    const m = json.public_metrics;

    return {
      likes: m?.like_count ?? 0,
      comments: m?.reply_count ?? 0,
      shares: (m?.retweet_count ?? 0) + (m?.quote_count ?? 0),
      impressions: m?.impression_count ?? 0,
      platform: "twitter",
      fetchedAt: new Date().toISOString(),
    };
  }

  // -----------------------------------------------------------------------
  // Trends
  // -----------------------------------------------------------------------

  async discoverTrends(query: TrendQuery): Promise<TrendItem[]> {
    if (this.isMock) return [];

    const keywords = (query.keywords ?? []).join(" OR ");
    if (!keywords) return [];

    const limit = query.limit ?? 20;
    const url = `${TWEETAPI_BASE}/tweets/search/recent?query=${encodeURIComponent(keywords)}&max_results=${limit}&tweet.fields=created_at,public_metrics,author_id`;

    const res = await resilientFetch(
      url,
      { headers: this.headers() },
      { serviceName: SERVICE_NAME, endpointKey: "GET /search/recent", maxRetries: 1, timeoutMs: 10_000 },
    );

    const json = (await res.json()) as TweetApiSearchResult;
    if (!json.data) return [];

    return json.data.map((t) => ({
      id: t.id,
      title: t.text.slice(0, 120),
      content: t.text,
      author: t.author_id,
      url: `https://twitter.com/i/status/${t.id}`,
      score: (t.public_metrics?.like_count ?? 0) + (t.public_metrics?.retweet_count ?? 0) * 2,
      platform: "twitter" as const,
      timestamp: new Date(t.created_at).getTime(),
    }));
  }

  // -----------------------------------------------------------------------
  // Health
  // -----------------------------------------------------------------------

  async health(): Promise<AdapterHealth> {
    if (this.isMock) return { ok: false, reason: "TWEETAPI_API_KEY not configured" };

    try {
      const res = await resilientFetch(
        `${TWEETAPI_BASE}/users/me`,
        { headers: this.headers() },
        { serviceName: SERVICE_NAME, endpointKey: "GET /users/me", maxRetries: 0, timeoutMs: 5_000 },
      );
      return res.ok ? { ok: true } : { ok: false, reason: `Status ${res.status}` };
    } catch (err: any) {
      return { ok: false, reason: err.message };
    }
  }
}
