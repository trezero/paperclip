/**
 * Reddit adapter — public JSON for reading, OAuth2 for publishing.
 *
 * Ported from MemeCoinInvestor2026/server/services/social/redditAdapter.ts
 * with added publishing + engagement + mock mode for the Paperclip plugin.
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

const PUBLIC_BASE = "https://www.reddit.com";
const OAUTH_BASE = "https://oauth.reddit.com";
const SERVICE_NAME = "reddit";
const USER_AGENT = "BrandAmbassador/0.1.0 (Paperclip Plugin)";

// ---------------------------------------------------------------------------
// Credentials
// ---------------------------------------------------------------------------

export interface RedditCredentials {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
}

// ---------------------------------------------------------------------------
// Response types
// ---------------------------------------------------------------------------

interface RedditChild {
  data: {
    id: string;
    title: string;
    selftext: string;
    author: string;
    created_utc: number;
    permalink: string;
    ups: number;
    num_comments: number;
    subreddit: string;
    total_awards_received?: number;
    num_crossposts?: number;
  };
}

interface RedditListing {
  data: {
    children: RedditChild[];
  };
}

interface RedditSubmitResponse {
  json?: {
    data?: {
      id: string;
      name: string;
      url: string;
    };
    errors?: string[][];
  };
}

// ---------------------------------------------------------------------------
// Adapter
// ---------------------------------------------------------------------------

export class RedditAdapter implements PlatformAdapter {
  readonly platform = "reddit" as const;
  private creds: RedditCredentials | null;
  private accessToken: string | null = null;
  private tokenExpiresAt = 0;

  constructor(creds: RedditCredentials | null) {
    this.creds = creds;
  }

  updateCredentials(creds: RedditCredentials | null): void {
    this.creds = creds;
    this.accessToken = null;
    this.tokenExpiresAt = 0;
  }

  private get isMock(): boolean {
    return !this.creds;
  }

  // -----------------------------------------------------------------------
  // OAuth token management
  // -----------------------------------------------------------------------

  private async ensureAccessToken(): Promise<string> {
    if (this.accessToken && Date.now() < this.tokenExpiresAt) {
      return this.accessToken;
    }

    if (!this.creds) throw new Error("Reddit credentials not configured");

    const auth = Buffer.from(`${this.creds.clientId}:${this.creds.clientSecret}`).toString("base64");
    const res = await resilientFetch(
      "https://www.reddit.com/api/v1/access_token",
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${auth}`,
          "Content-Type": "application/x-www-form-urlencoded",
          "User-Agent": USER_AGENT,
        },
        body: `grant_type=refresh_token&refresh_token=${this.creds.refreshToken}`,
      },
      { serviceName: SERVICE_NAME, endpointKey: "/api/v1/access_token", maxRetries: 1, timeoutMs: 8_000 },
    );

    const json = (await res.json()) as { access_token: string; expires_in: number; error?: string };
    if (json.error) throw new Error(`Reddit OAuth error: ${json.error}`);

    this.accessToken = json.access_token;
    // Refresh 60s before actual expiry
    this.tokenExpiresAt = Date.now() + (json.expires_in - 60) * 1000;
    return this.accessToken;
  }

  private async oauthHeaders(): Promise<Record<string, string>> {
    const token = await this.ensureAccessToken();
    return {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": USER_AGENT,
    };
  }

  // -----------------------------------------------------------------------
  // Internal: public JSON read helpers
  // -----------------------------------------------------------------------

  private mapChildren(children: RedditChild[]): TrendItem[] {
    return children.map(({ data: p }) => ({
      id: p.id,
      title: p.title,
      content: p.selftext,
      author: p.author,
      url: `https://reddit.com${p.permalink}`,
      score: p.ups,
      platform: "reddit" as const,
      timestamp: p.created_utc * 1000,
    }));
  }

  private async publicGet(path: string, endpointKey: string): Promise<RedditListing | null> {
    try {
      const res = await resilientFetch(
        `${PUBLIC_BASE}${path}`,
        { headers: { "User-Agent": USER_AGENT } },
        { serviceName: SERVICE_NAME, endpointKey, maxRetries: 1, timeoutMs: 8_000, circuitFailureThreshold: 6, circuitOpenMs: 30_000 },
      );
      if (!res.ok) return null;
      return (await res.json()) as RedditListing;
    } catch {
      return null;
    }
  }

  // -----------------------------------------------------------------------
  // Publish (OAuth required)
  // -----------------------------------------------------------------------

  async publish(payload: PublishPayload): Promise<PublishResult> {
    if (this.isMock) return mockPublishResult("reddit");

    const headers = await this.oauthHeaders();

    // Determine post type: link with image or self-text
    const params = new URLSearchParams({
      api_type: "json",
      kind: payload.mediaRef ? "link" : "self",
      sr: "cryptocurrency", // default subreddit — would come from brand settings
      title: payload.caption.split("\n")[0]?.slice(0, 300) ?? "New post",
    });

    if (payload.mediaRef) {
      params.set("url", payload.mediaRef);
    } else {
      params.set("text", payload.caption);
    }

    const res = await resilientFetch(
      `${OAUTH_BASE}/api/submit`,
      { method: "POST", headers, body: params.toString() },
      { serviceName: SERVICE_NAME, endpointKey: "POST /api/submit", maxRetries: 1, timeoutMs: 10_000 },
    );

    const json = (await res.json()) as RedditSubmitResponse;
    const data = json.json?.data;
    const errors = json.json?.errors;

    if (errors && errors.length > 0) {
      return {
        success: false,
        platformPostId: "",
        platformUrl: "",
        error: errors.map((e) => e.join(": ")).join("; "),
      };
    }

    return {
      success: true,
      platformPostId: data?.id ?? "",
      platformUrl: data?.url ?? "",
    };
  }

  // -----------------------------------------------------------------------
  // Engagement
  // -----------------------------------------------------------------------

  async getEngagement(ref: PlatformPostRef): Promise<EngagementMetrics> {
    if (this.isMock) return mockEngagement("reddit");

    // Use public JSON to fetch post details by URL
    const listing = await this.publicGet(
      `/api/info.json?id=t3_${ref.postId}`,
      "/api/info.json",
    );

    const post = listing?.data?.children?.[0]?.data;

    return {
      likes: post?.ups ?? 0,
      comments: post?.num_comments ?? 0,
      shares: post?.num_crossposts ?? 0,
      impressions: 0, // Reddit doesn't expose impressions publicly
      platform: "reddit",
      fetchedAt: new Date().toISOString(),
    };
  }

  // -----------------------------------------------------------------------
  // Trends (public JSON — no auth needed)
  // -----------------------------------------------------------------------

  async discoverTrends(query: TrendQuery): Promise<TrendItem[]> {
    const results: TrendItem[] = [];
    const limit = query.limit ?? 10;

    // Keyword search
    if (query.keywords?.length) {
      const q = query.keywords.join(" OR ");
      const listing = await this.publicGet(
        `/search.json?q=${encodeURIComponent(q)}&sort=new&limit=${limit}`,
        "/search.json",
      );
      if (listing?.data?.children) {
        results.push(...this.mapChildren(listing.data.children));
      }
    }

    // Hot posts from specific subreddits
    if (query.subreddits?.length) {
      for (const sub of query.subreddits) {
        const listing = await this.publicGet(
          `/r/${sub}/hot.json?limit=${Math.min(limit, 10)}`,
          `/r/${sub}/hot.json`,
        );
        if (listing?.data?.children) {
          results.push(...this.mapChildren(listing.data.children));
        }
      }
    }

    return results;
  }

  // -----------------------------------------------------------------------
  // Health
  // -----------------------------------------------------------------------

  async health(): Promise<AdapterHealth> {
    if (this.isMock) return { ok: false, reason: "Reddit credentials not configured" };

    try {
      const headers = await this.oauthHeaders();
      const res = await resilientFetch(
        `${OAUTH_BASE}/api/v1/me`,
        { headers },
        { serviceName: SERVICE_NAME, endpointKey: "/api/v1/me", maxRetries: 0, timeoutMs: 5_000 },
      );
      return res.ok ? { ok: true } : { ok: false, reason: `Status ${res.status}` };
    } catch (err: any) {
      return { ok: false, reason: err.message };
    }
  }
}
