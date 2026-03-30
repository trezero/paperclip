import type { PaperclipPluginManifestV1 } from "@paperclipai/plugin-sdk";
import {
  PLUGIN_ID,
  PLUGIN_VERSION,
  PAGE_ROUTE,
  SLOT_IDS,
  EXPORT_NAMES,
  TOOL_NAMES,
  JOB_KEYS,
  WEBHOOK_KEYS,
} from "./constants.js";

const manifest: PaperclipPluginManifestV1 = {
  apiVersion: 1,
  id: PLUGIN_ID,
  version: PLUGIN_VERSION,
  displayName: "Brand Ambassador",
  description:
    "Marketing Hub — content pipeline, platform publishing, trend discovery, and engagement analytics. Humans and AI agents collaborate as equals across the full content lifecycle.",
  author: "MemeFlow Trading Co",
  categories: ["automation"],

  entrypoints: {
    worker: "./dist/worker.js",
    ui: "./dist/ui/",
  },

  capabilities: [
    "companies.read",
    "projects.read",
    "issues.read",
    "issues.create",
    "issues.update",
    "agents.read",
    "plugin.state.read",
    "plugin.state.write",
    "events.subscribe",
    "events.emit",
    "jobs.schedule",
    "webhooks.receive",
    "http.outbound",
    "secrets.read-ref",
    "agent.tools.register",
    "ui.page.register",
    "instance.settings.register",
    "ui.sidebar.register",
    "ui.dashboardWidget.register",
    "activity.log.write",
    "metrics.write",
  ],

  instanceConfigSchema: {
    type: "object",
    properties: {
      enableAutoGenerate: {
        type: "boolean",
        title: "Enable Auto-Generate",
        description: "Allow agents to auto-generate posts without human trigger",
        default: false,
      },
      enableScheduler: {
        type: "boolean",
        title: "Enable Scheduler",
        description: "Allow scheduled post publishing",
        default: true,
      },
      maxDailyPosts: {
        type: "number",
        title: "Max Daily Posts",
        description: "Maximum posts published per day across all platforms",
        default: 10,
      },
    },
    required: [],
  },

  jobs: [
    {
      jobKey: JOB_KEYS.scheduledPublish,
      displayName: "Scheduled Publish",
      description: "Checks for posts scheduled to publish and executes them",
      schedule: "* * * * *",
    },
    {
      jobKey: JOB_KEYS.engagementPoll,
      displayName: "Engagement Poll",
      description: "Polls platform APIs for engagement metrics on published posts",
      schedule: "*/15 * * * *",
    },
    {
      jobKey: JOB_KEYS.trendRefresh,
      displayName: "Trend Refresh",
      description: "Polls RSS.app feeds for new trending content",
      schedule: "*/15 * * * *",
    },
  ],

  webhooks: [
    {
      endpointKey: WEBHOOK_KEYS.rssApp,
      displayName: "RSS.app Webhook",
      description: "Receives push notifications from RSS.app when feeds update",
    },
  ],

  tools: [
    {
      name: TOOL_NAMES.checkTrends,
      displayName: "Check Trends",
      description: "Discover trending topics across configured platforms.",
      parametersSchema: {
        type: "object",
        properties: {
          platforms: {
            type: "array",
            items: { type: "string", enum: ["twitter", "reddit", "telegram"] },
          },
          limit: { type: "number" },
        },
      },
    },
    {
      name: TOOL_NAMES.generateCaption,
      displayName: "Generate Caption",
      description: "Generate a platform-optimized caption for a given topic using brand voice.",
      parametersSchema: {
        type: "object",
        properties: {
          topic: { type: "string" },
          platform: { type: "string", enum: ["twitter", "reddit", "telegram"] },
          tone: { type: "string" },
        },
        required: ["topic", "platform"],
      },
    },
    {
      name: TOOL_NAMES.generateMedia,
      displayName: "Generate Media",
      description: "Generate an image or video using ComfyUI.",
      parametersSchema: {
        type: "object",
        properties: {
          caption: { type: "string" },
          platform: { type: "string", enum: ["twitter", "reddit", "telegram"] },
          dimensions: { type: "string" },
          style: { type: "string" },
        },
        required: ["caption", "platform"],
      },
    },
    {
      name: TOOL_NAMES.moderateContent,
      displayName: "Moderate Content",
      description: "Score content for safety and brand compliance. Returns 0-100 with flags.",
      parametersSchema: {
        type: "object",
        properties: {
          caption: { type: "string" },
          mediaRef: { type: "string" },
        },
        required: ["caption"],
      },
    },
    {
      name: TOOL_NAMES.generatePost,
      displayName: "Generate Complete Post",
      description: "End-to-end: caption, media, moderation. Creates a draft pipeline card.",
      parametersSchema: {
        type: "object",
        properties: {
          topic: { type: "string" },
          platform: { type: "string", enum: ["twitter", "reddit", "telegram"] },
          tone: { type: "string" },
          skipMedia: { type: "boolean" },
        },
        required: ["topic", "platform"],
      },
    },
    {
      name: TOOL_NAMES.dismissTrend,
      displayName: "Dismiss Trend",
      description: "Remove a trend from the active suggestions list.",
      parametersSchema: {
        type: "object",
        properties: { trendId: { type: "string" } },
        required: ["trendId"],
      },
    },
    {
      name: TOOL_NAMES.createPipelineCard,
      displayName: "Create Pipeline Card",
      description: "Assemble a content card from chain context and add to pipeline as draft.",
      parametersSchema: {
        type: "object",
        properties: {
          topic: { type: "string" },
          caption: { type: "string" },
          platform: { type: "string", enum: ["twitter", "reddit", "telegram"] },
          mediaRef: { type: "string" },
          mediaType: { type: "string", enum: ["image", "video"] },
          moderationScore: { type: "number" },
        },
        required: ["topic", "caption", "platform"],
      },
    },
    {
      name: TOOL_NAMES.manageCampaign,
      displayName: "Manage Campaign",
      description: "Create, update, list, or delete marketing campaigns.",
      parametersSchema: {
        type: "object",
        properties: {
          action: { type: "string", enum: ["create", "update", "list", "delete"] },
          campaignId: { type: "string" },
          name: { type: "string" },
          description: { type: "string" },
          startDate: { type: "string" },
          endDate: { type: "string" },
          platforms: { type: "array", items: { type: "string" } },
        },
        required: ["action"],
      },
    },
    {
      name: TOOL_NAMES.manageSchedule,
      displayName: "Manage Schedule",
      description: "Schedule, reschedule, or cancel content publishing.",
      parametersSchema: {
        type: "object",
        properties: {
          action: { type: "string", enum: ["schedule", "reschedule", "cancel", "list"] },
          cardId: { type: "string" },
          scheduledAt: { type: "string" },
        },
        required: ["action"],
      },
    },
    {
      name: TOOL_NAMES.manageTemplates,
      displayName: "Manage Templates",
      description: "Create, list, apply, or delete content templates.",
      parametersSchema: {
        type: "object",
        properties: {
          action: { type: "string", enum: ["create", "list", "apply", "delete"] },
          templateId: { type: "string" },
          name: { type: "string" },
          platform: { type: "string" },
          captionTemplate: { type: "string" },
          tone: { type: "string" },
          variables: { type: "object" },
        },
        required: ["action"],
      },
    },
    {
      name: TOOL_NAMES.bulkOperations,
      displayName: "Bulk Operations",
      description: "Perform bulk actions on multiple pipeline cards.",
      parametersSchema: {
        type: "object",
        properties: {
          action: { type: "string", enum: ["approve", "reject", "move", "regenerate", "assign-campaign"] },
          cardIds: { type: "array", items: { type: "string" } },
          targetStatus: { type: "string", enum: ["draft", "review", "approved"] },
          campaignId: { type: "string" },
          toolsToRerun: { type: "array", items: { type: "string" } },
        },
        required: ["action", "cardIds"],
      },
    },
    {
      name: TOOL_NAMES.manageVariants,
      displayName: "Manage A/B Variants",
      description: "Create variants, compare engagement, and pick winners.",
      parametersSchema: {
        type: "object",
        properties: {
          action: { type: "string", enum: ["create-variant", "list", "compare", "pick-winner"] },
          sourceCardId: { type: "string" },
          variantGroupId: { type: "string" },
          winnerCardId: { type: "string" },
          modifiedParameters: { type: "object" },
        },
        required: ["action"],
      },
    },
  ],

  ui: {
    slots: [
      {
        type: "page",
        id: SLOT_IDS.page,
        routePath: `/:companyPrefix/${PAGE_ROUTE}`,
        exportName: EXPORT_NAMES.page,
        displayName: "Marketing Hub",
      },
      {
        type: "settingsPage",
        id: SLOT_IDS.settingsPage,
        exportName: EXPORT_NAMES.settingsPage,
        displayName: "Brand Ambassador Settings",
      },
      {
        type: "sidebar",
        id: SLOT_IDS.sidebar,
        exportName: EXPORT_NAMES.sidebar,
        displayName: "Marketing",
      },
      {
        type: "dashboardWidget",
        id: SLOT_IDS.dashboardWidget,
        exportName: EXPORT_NAMES.dashboardWidget,
        displayName: "Marketing Pipeline",
      },
    ],
  },
};

export default manifest;
