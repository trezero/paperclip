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
