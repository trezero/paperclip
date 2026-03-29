export type {
  PlatformAdapter,
  PublishPayload,
  PublishResult,
  PlatformPostRef,
  EngagementMetrics,
  TrendQuery,
  TrendItem,
  AdapterHealth,
} from "./adapter.js";
export { mockPublishResult, mockEngagement } from "./adapter.js";
export { resilientFetch, CircuitOpenError } from "./resilientHttp.js";
export type { ResilientFetchOptions } from "./resilientHttp.js";
export { TwitterAdapter } from "./twitterAdapter.js";
export { RedditAdapter } from "./redditAdapter.js";
export type { RedditCredentials } from "./redditAdapter.js";
export { TelegramAdapter } from "./telegramAdapter.js";
export type { TelegramCredentials } from "./telegramAdapter.js";
export { RssAppAdapter, scoreItems, dedupeAndMerge } from "./rssAppAdapter.js";
export type { RssAppCredentials, RssAppFeed, RssAppFeedItem, ScoredTrend, WebhookPayload } from "./rssAppAdapter.js";
