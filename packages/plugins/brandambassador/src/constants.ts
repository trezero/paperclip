export const PLUGIN_ID = "brandambassador.marketing";
export const PLUGIN_VERSION = "0.1.0";
export const PAGE_ROUTE = "marketing";

export const SLOT_IDS = {
  page: "marketing-hub-page",
  settingsPage: "marketing-hub-settings",
  sidebar: "marketing-hub-sidebar-link",
  dashboardWidget: "marketing-hub-dashboard-widget",
} as const;

export const EXPORT_NAMES = {
  page: "MarketingHub",
  settingsPage: "MarketingHubSettings",
  sidebar: "MarketingHubSidebarLink",
  dashboardWidget: "MarketingHubDashboardWidget",
} as const;

export const TOOL_NAMES = {
  checkTrends: "check-trends",
  generateCaption: "generate-caption",
  generateMedia: "generate-media",
  moderateContent: "moderate-content",
  generatePost: "generate-post",
  dismissTrend: "dismiss-trend",
  createPipelineCard: "create-pipeline-card",
  manageCampaign: "manage-campaign",
  manageSchedule: "manage-schedule",
  manageTemplates: "manage-templates",
  bulkOperations: "bulk-operations",
  manageVariants: "manage-variants",
} as const;

export const JOB_KEYS = {
  scheduledPublish: "scheduled-publish",
  engagementPoll: "engagement-poll",
  trendRefresh: "trend-refresh",
} as const;

export const WEBHOOK_KEYS = {
  rssApp: "rssapp-webhook",
} as const;

export const STREAM_CHANNELS = {
  generationProgress: "generation-progress",
  comfyuiStatus: "comfyui-status",
  trendsUpdated: "trends-updated",
  contentPublished: "content-published",
  engagementAlert: "engagement-alert",
  scheduleFired: "schedule-fired",
} as const;

/** Content card statuses for the pipeline kanban. */
export const CARD_STATUSES = ["draft", "review", "approved", "published"] as const;
export type CardStatus = (typeof CARD_STATUSES)[number];

/** Supported publishing platforms. */
export const PLATFORMS = ["twitter", "reddit", "telegram"] as const;
export type Platform = (typeof PLATFORMS)[number];

/** State namespace keys for plugin state storage. */
export const STATE_KEYS = {
  pipelineCards: "pipeline:cards",
  trendsActive: "trends:active",
  trendsDismissed: "trends:dismissed",
  trendsFeeds: "trends:feeds",
  brandSettings: "brand:settings",
  campaignsList: "campaigns:list",
  templatesList: "templates:list",
  variantsGroups: "variants:groups",
  engagementHistory: "engagement:history",
  engagementAlerts: "engagement:alerts",
} as const;

export const DEFAULT_BRAND_SETTINGS = {
  tone: "witty",
  audience: "crypto native",
  platforms: ["twitter"] as Platform[],
  defaultHashtags: [] as string[],
  twitterApiKey: "",
  redditClientId: "",
  redditClientSecret: "",
  telegramBotToken: "",
  telegramChannelId: "",
  rssAppApiKey: "",
  rssAppSecret: "",
  engagementAlertThresholds: {
    viralLikes: 100,
    viralRetweets: 50,
    dropPct: 50,
  },
} as const;
