/**
 * Platform Adapter interface and shared types.
 *
 * Every social platform implements this interface so the worker can
 * publish content, read engagement, and discover trends through a
 * uniform API.
 */

import type { Platform } from "../../constants.js";

// ---------------------------------------------------------------------------
// Publishing
// ---------------------------------------------------------------------------

export interface PublishPayload {
  caption: string;
  platform: Platform;
  mediaRef?: string;
  mediaType?: "image" | "video";
  /** Twitter: auto-split >280 chars into a thread */
  threadSplit?: boolean;
  /** Telegram: supports markdown formatting */
  formatting?: "markdown" | "plain";
}

export interface PublishResult {
  success: boolean;
  platformPostId: string;
  platformUrl: string;
  error?: string;
}

// ---------------------------------------------------------------------------
// Engagement
// ---------------------------------------------------------------------------

export interface PlatformPostRef {
  platform: Platform;
  postId: string;
  url: string;
  publishedAt: string;
}

export interface EngagementMetrics {
  likes: number;
  comments: number;
  shares: number;
  impressions: number;
  platform: Platform;
  fetchedAt: string;
}

// ---------------------------------------------------------------------------
// Trends
// ---------------------------------------------------------------------------

export interface TrendQuery {
  keywords?: string[];
  subreddits?: string[];
  limit?: number;
}

export interface TrendItem {
  id: string;
  title: string;
  content: string;
  author: string;
  url: string;
  score: number;
  platform: Platform | "web";
  timestamp: number;
}

// ---------------------------------------------------------------------------
// Health
// ---------------------------------------------------------------------------

export interface AdapterHealth {
  ok: boolean;
  reason?: string;
}

// ---------------------------------------------------------------------------
// Adapter interface
// ---------------------------------------------------------------------------

export interface PlatformAdapter {
  readonly platform: Platform;

  /** Publish content to this platform. */
  publish(payload: PublishPayload): Promise<PublishResult>;

  /** Fetch engagement metrics for a published post. */
  getEngagement(ref: PlatformPostRef): Promise<EngagementMetrics>;

  /** Discover trending content (optional — not all platforms support this). */
  discoverTrends?(query: TrendQuery): Promise<TrendItem[]>;

  /** Check whether the adapter is configured and reachable. */
  health(): Promise<AdapterHealth>;
}

// ---------------------------------------------------------------------------
// Mock helpers (shared by all adapters when credentials missing)
// ---------------------------------------------------------------------------

export function mockPublishResult(platform: Platform): PublishResult {
  return {
    success: true,
    platformPostId: `mock-${platform}-${Date.now()}`,
    platformUrl: `https://mock.${platform}.example/post/${Date.now()}`,
  };
}

export function mockEngagement(platform: Platform): EngagementMetrics {
  return {
    likes: Math.floor(Math.random() * 200),
    comments: Math.floor(Math.random() * 30),
    shares: Math.floor(Math.random() * 50),
    impressions: Math.floor(Math.random() * 5000),
    platform,
    fetchedAt: new Date().toISOString(),
  };
}
