import { definePlugin, runWorker } from "@paperclipai/plugin-sdk";
import type { PluginContext, ToolRunContext, ToolResult, PluginWebhookInput } from "@paperclipai/plugin-sdk";
import {
  TOOL_NAMES,
  JOB_KEYS,
  STREAM_CHANNELS,
  DEFAULT_BRAND_SETTINGS,
  type CardStatus,
  type Platform,
} from "./constants.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ContentCard {
  id: string;
  topic: string;
  platform: Platform;
  caption: string;
  mediaRef: string | null;
  mediaType: "image" | "video" | null;
  moderationScore: number | null;
  status: CardStatus;
  source: "human" | "agent";
  sourceAgentId: string | null;
  linkedIssueId: string | null;
  campaignId: string | null;
  scheduledAt: string | null;
  scheduledStatus: "pending" | "publishing" | "failed" | null;
  platformPostRef: string | null;
  publishError: string | null;
  publishAttempts: number;
  variantGroupId: string | null;
  variantLabel: string | null;
  createdAt: string;
  updatedAt: string;
}

interface Campaign {
  id: string;
  name: string;
  description: string;
  platforms: Platform[];
  startDate: string | null;
  endDate: string | null;
  createdAt: string;
  updatedAt: string;
}

interface ContentTemplate {
  id: string;
  name: string;
  platform: Platform;
  captionTemplate: string;
  tone: string;
  createdAt: string;
}

interface BrandSettings {
  tone: string;
  audience: string;
  platforms: Platform[];
  defaultHashtags: string[];
  twitterApiKey: string;
  redditClientId: string;
  redditClientSecret: string;
  telegramBotToken: string;
  telegramChannelId: string;
  rssAppApiKey: string;
  rssAppSecret: string;
  engagementAlertThresholds: {
    viralLikes: number;
    viralRetweets: number;
    dropPct: number;
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function uuid(): string {
  return crypto.randomUUID();
}

function now(): string {
  return new Date().toISOString();
}

async function getCards(ctx: PluginContext, companyId: string): Promise<ContentCard[]> {
  const raw = await ctx.state.get({
    scopeKind: "company",
    scopeId: companyId,
    namespace: "pipeline",
    stateKey: "cards",
  });
  return (raw as ContentCard[] | null) ?? [];
}

async function setCards(ctx: PluginContext, companyId: string, cards: ContentCard[]): Promise<void> {
  await ctx.state.set(
    { scopeKind: "company", scopeId: companyId, namespace: "pipeline", stateKey: "cards" },
    cards,
  );
}

async function getBrandSettings(ctx: PluginContext, companyId: string): Promise<BrandSettings> {
  const raw = await ctx.state.get({
    scopeKind: "company",
    scopeId: companyId,
    namespace: "brand",
    stateKey: "settings",
  });
  return (raw as BrandSettings | null) ?? { ...DEFAULT_BRAND_SETTINGS };
}

async function getCampaigns(ctx: PluginContext, companyId: string): Promise<Campaign[]> {
  const raw = await ctx.state.get({
    scopeKind: "company",
    scopeId: companyId,
    namespace: "campaigns",
    stateKey: "list",
  });
  return (raw as Campaign[] | null) ?? [];
}

async function setCampaigns(ctx: PluginContext, companyId: string, campaigns: Campaign[]): Promise<void> {
  await ctx.state.set(
    { scopeKind: "company", scopeId: companyId, namespace: "campaigns", stateKey: "list" },
    campaigns,
  );
}

async function getTemplates(ctx: PluginContext, companyId: string): Promise<ContentTemplate[]> {
  const raw = await ctx.state.get({
    scopeKind: "company",
    scopeId: companyId,
    namespace: "templates",
    stateKey: "list",
  });
  return (raw as ContentTemplate[] | null) ?? [];
}

async function setTemplates(ctx: PluginContext, companyId: string, templates: ContentTemplate[]): Promise<void> {
  await ctx.state.set(
    { scopeKind: "company", scopeId: companyId, namespace: "templates", stateKey: "list" },
    templates,
  );
}

// ---------------------------------------------------------------------------
// Inline tool logic (tools can't call each other via ctx.tools.execute)
// ---------------------------------------------------------------------------

async function generateCaptionLogic(
  ctx: PluginContext,
  topic: string,
  platform: Platform,
  tone: string | undefined,
  companyId: string,
): Promise<{ caption: string; tone: string }> {
  const settings = await getBrandSettings(ctx, companyId);
  const effectiveTone = tone ?? settings.tone;
  const tags = settings.defaultHashtags.length
    ? "#" + settings.defaultHashtags.join(" #")
    : "#crypto";
  const caption = `${topic} — ${effectiveTone} take for ${platform}. ${tags}`;
  return { caption, tone: effectiveTone };
}

function generateMediaLogic(ctx: PluginContext): { mediaRef: string; mediaType: "image" } {
  ctx.streams.emit(STREAM_CHANNELS.generationProgress, { stage: "queued", progress: 0 });
  const mediaRef = `media_${uuid()}.png`;
  ctx.streams.emit(STREAM_CHANNELS.generationProgress, { stage: "complete", progress: 1, outputFile: mediaRef });
  return { mediaRef, mediaType: "image" };
}

function moderateContentLogic(caption: string): { score: number; issues: string[] } {
  const issues: string[] = [];
  let score = 85;
  if (caption.length > 280) {
    issues.push("Caption exceeds Twitter character limit");
    score -= 10;
  }
  if (/fuck|shit|damn/i.test(caption)) {
    issues.push("Contains profanity");
    score -= 20;
  }
  return { score: Math.max(0, Math.min(100, score)), issues };
}

function createCardFromParts(
  topic: string,
  caption: string,
  platform: Platform,
  mediaRef: string | null,
  mediaType: "image" | "video" | null,
  moderationScore: number | null,
  runCtx: ToolRunContext,
): ContentCard {
  return {
    id: uuid(),
    topic,
    platform,
    caption,
    mediaRef,
    mediaType,
    moderationScore,
    status: "draft",
    source: runCtx.agentId ? "agent" : "human",
    sourceAgentId: runCtx.agentId ?? null,
    linkedIssueId: null,
    campaignId: null,
    scheduledAt: null,
    scheduledStatus: null,
    platformPostRef: null,
    publishError: null,
    publishAttempts: 0,
    variantGroupId: null,
    variantLabel: null,
    createdAt: now(),
    updatedAt: now(),
  };
}

// ---------------------------------------------------------------------------
// Plugin definition
// ---------------------------------------------------------------------------

const toolDecl = (displayName: string, description: string) => ({
  displayName,
  description,
  parametersSchema: { type: "object" as const, properties: {} },
});

const plugin = definePlugin({
  async setup(ctx: PluginContext) {
    ctx.logger.info("BrandAmbassador plugin initializing...");

    // ------------------------------------------------------------------
    // Data handlers
    // ------------------------------------------------------------------

    ctx.data.register("pipeline", async (params) => {
      return await getCards(ctx, params.companyId as string);
    });

    ctx.data.register("trends", async (params) => {
      const raw = await ctx.state.get({
        scopeKind: "company",
        scopeId: params.companyId as string,
        namespace: "trends",
        stateKey: "active",
      });
      return raw ?? [];
    });

    ctx.data.register("brand-settings", async (params) => {
      return await getBrandSettings(ctx, params.companyId as string);
    });

    ctx.data.register("campaigns", async (params) => {
      return await getCampaigns(ctx, params.companyId as string);
    });

    ctx.data.register("templates", async (params) => {
      return await getTemplates(ctx, params.companyId as string);
    });

    // ------------------------------------------------------------------
    // Action handlers
    // ------------------------------------------------------------------

    ctx.actions.register("save-brand-settings", async (params) => {
      const { companyId, settings } = params as { companyId: string; settings: Partial<BrandSettings> };
      const current = await getBrandSettings(ctx, companyId);
      const merged = { ...current, ...settings };
      await ctx.state.set(
        { scopeKind: "company", scopeId: companyId, namespace: "brand", stateKey: "settings" },
        merged,
      );
      return { success: true, settings: merged };
    });

    ctx.actions.register("update-card-status", async (params) => {
      const { companyId, cardId, status } = params as {
        companyId: string;
        cardId: string;
        status: CardStatus;
      };
      const cards = await getCards(ctx, companyId);
      const card = cards.find((c) => c.id === cardId);
      if (!card) return { success: false, error: "Card not found" };

      card.status = status;
      card.updatedAt = now();

      if (status === "review" && !card.linkedIssueId) {
        try {
          const issue = await ctx.issues.create({
            companyId,
            title: `[Marketing] Review: ${card.topic}`,
            description: `Platform: ${card.platform}\n\n${card.caption}`,
          });
          card.linkedIssueId = issue.id;
        } catch (err) {
          ctx.logger.warn("Failed to create review issue:", err as Record<string, unknown>);
        }
      }

      await setCards(ctx, companyId, cards);
      return { success: true, card };
    });

    ctx.actions.register("delete-card", async (params) => {
      const { companyId, cardId } = params as { companyId: string; cardId: string };
      const cards = await getCards(ctx, companyId);
      await setCards(ctx, companyId, cards.filter((c) => c.id !== cardId));
      return { success: true };
    });

    ctx.actions.register("execute-tool", async (params) => {
      // Bridge adapter: UI calls action, we dispatch to internal tool logic
      const { toolName, parameters, runContext } = params as {
        toolName: string;
        parameters: Record<string, unknown>;
        runContext: Partial<ToolRunContext>;
      };
      // For now, return an acknowledgment — full tool dispatch will be wired later
      return { success: true, toolName, note: "Tool execution via bridge not yet implemented" };
    });

    // ------------------------------------------------------------------
    // Tool handlers
    // ------------------------------------------------------------------

    ctx.tools.register(
      TOOL_NAMES.checkTrends,
      toolDecl("Check Trends", "Discover trending topics across configured platforms"),
      async (params, runCtx): Promise<ToolResult> => {
        const companyId = runCtx.companyId;
        const raw = await ctx.state.get({
          scopeKind: "company",
          scopeId: companyId,
          namespace: "trends",
          stateKey: "active",
        });
        const trends = (raw as any[] | null) ?? [];
        const platformFilter = (params as any)?.platforms as string[] | undefined;
        const limit = ((params as any)?.limit as number) || 10;
        let filtered = trends;
        if (platformFilter?.length) {
          filtered = trends.filter((t: any) => platformFilter.includes(t.platform));
        }
        filtered = filtered.slice(0, limit);
        return { content: `Found ${filtered.length} trending topics.`, data: filtered };
      },
    );

    ctx.tools.register(
      TOOL_NAMES.generateCaption,
      toolDecl("Generate Caption", "Generate a platform-optimized caption"),
      async (params, runCtx): Promise<ToolResult> => {
        const { topic, platform, tone } = params as { topic: string; platform: Platform; tone?: string };
        const result = await generateCaptionLogic(ctx, topic, platform, tone, runCtx.companyId);
        return { content: result.caption, data: { caption: result.caption, platform, tone: result.tone } };
      },
    );

    ctx.tools.register(
      TOOL_NAMES.generateMedia,
      toolDecl("Generate Media", "Generate media via ComfyUI"),
      async (_params, _runCtx): Promise<ToolResult> => {
        const result = generateMediaLogic(ctx);
        return { content: `Generated media: ${result.mediaRef}`, data: result };
      },
    );

    ctx.tools.register(
      TOOL_NAMES.moderateContent,
      toolDecl("Moderate Content", "Score content for safety and brand compliance"),
      async (params): Promise<ToolResult> => {
        const { caption } = params as { caption: string };
        const result = moderateContentLogic(caption);
        return {
          content: `Moderation score: ${result.score}/100. ${result.issues.length ? "Issues: " + result.issues.join(", ") : "No issues."}`,
          data: result,
        };
      },
    );

    ctx.tools.register(
      TOOL_NAMES.generatePost,
      toolDecl("Generate Complete Post", "End-to-end post generation pipeline"),
      async (params, runCtx): Promise<ToolResult> => {
        const { topic, platform, tone, skipMedia } = params as {
          topic: string;
          platform: Platform;
          tone?: string;
          skipMedia?: boolean;
        };

        const captionResult = await generateCaptionLogic(ctx, topic, platform, tone, runCtx.companyId);
        const caption = captionResult.caption;

        let mediaRef: string | null = null;
        let mediaType: "image" | "video" | null = null;
        if (!skipMedia) {
          const media = generateMediaLogic(ctx);
          mediaRef = media.mediaRef;
          mediaType = media.mediaType;
        }

        const mod = moderateContentLogic(caption);
        const card = createCardFromParts(topic, caption, platform, mediaRef, mediaType, mod.score, runCtx);

        const cards = await getCards(ctx, runCtx.companyId);
        cards.push(card);
        await setCards(ctx, runCtx.companyId, cards);

        return {
          content: `Post created: "${caption}" (moderation: ${mod.score}/100)`,
          data: { cardId: card.id, card },
        };
      },
    );

    ctx.tools.register(
      TOOL_NAMES.dismissTrend,
      toolDecl("Dismiss Trend", "Dismiss a trend from suggestions"),
      async (params, runCtx): Promise<ToolResult> => {
        const { trendId } = params as { trendId: string };
        const raw = await ctx.state.get({
          scopeKind: "company",
          scopeId: runCtx.companyId,
          namespace: "trends",
          stateKey: "active",
        });
        const trends = (raw as any[] | null) ?? [];
        const filtered = trends.filter((t: any) => t.id !== trendId);
        await ctx.state.set(
          { scopeKind: "company", scopeId: runCtx.companyId, namespace: "trends", stateKey: "active" },
          filtered,
        );
        return { content: `Trend ${trendId} dismissed.`, data: { success: true } };
      },
    );

    ctx.tools.register(
      TOOL_NAMES.createPipelineCard,
      toolDecl("Create Pipeline Card", "Create a content card in the pipeline"),
      async (params, runCtx): Promise<ToolResult> => {
        const { topic, caption, platform, mediaRef, mediaType, moderationScore } = params as {
          topic: string;
          caption: string;
          platform: Platform;
          mediaRef?: string;
          mediaType?: "image" | "video";
          moderationScore?: number;
        };
        const card = createCardFromParts(
          topic,
          caption,
          platform,
          mediaRef ?? null,
          mediaType ?? null,
          moderationScore ?? null,
          runCtx,
        );
        const cards = await getCards(ctx, runCtx.companyId);
        cards.push(card);
        await setCards(ctx, runCtx.companyId, cards);
        return {
          content: `Created pipeline card: ${card.id} (${topic}, ${platform})`,
          data: { cardId: card.id, status: "draft", card },
        };
      },
    );

    ctx.tools.register(
      TOOL_NAMES.manageCampaign,
      toolDecl("Manage Campaign", "Manage marketing campaigns"),
      async (params, runCtx): Promise<ToolResult> => {
        const { action, campaignId, name, description, startDate, endDate, platforms } = params as any;
        const companyId = runCtx.companyId;
        const campaigns = await getCampaigns(ctx, companyId);

        switch (action) {
          case "create": {
            const campaign: Campaign = {
              id: uuid(), name: name ?? "Untitled", description: description ?? "",
              platforms: platforms ?? [], startDate: startDate ?? null, endDate: endDate ?? null,
              createdAt: now(), updatedAt: now(),
            };
            campaigns.push(campaign);
            await setCampaigns(ctx, companyId, campaigns);
            return { content: `Campaign created: ${campaign.name}`, data: campaign };
          }
          case "list":
            return { content: `${campaigns.length} campaigns`, data: campaigns };
          case "update": {
            const c = campaigns.find((c) => c.id === campaignId);
            if (!c) return { content: "Campaign not found", data: { error: "not_found" } };
            if (name) c.name = name;
            if (description) c.description = description;
            if (startDate) c.startDate = startDate;
            if (endDate) c.endDate = endDate;
            if (platforms) c.platforms = platforms;
            c.updatedAt = now();
            await setCampaigns(ctx, companyId, campaigns);
            return { content: `Campaign updated: ${c.name}`, data: c };
          }
          case "delete": {
            await setCampaigns(ctx, companyId, campaigns.filter((c) => c.id !== campaignId));
            return { content: "Campaign deleted", data: { success: true } };
          }
          default:
            return { content: `Unknown action: ${action}` };
        }
      },
    );

    ctx.tools.register(
      TOOL_NAMES.manageSchedule,
      toolDecl("Manage Schedule", "Schedule content publishing"),
      async (params, runCtx): Promise<ToolResult> => {
        const { action, cardId, scheduledAt } = params as any;
        const companyId = runCtx.companyId;
        const cards = await getCards(ctx, companyId);

        switch (action) {
          case "schedule": {
            const card = cards.find((c) => c.id === cardId);
            if (!card) return { content: "Card not found" };
            card.scheduledAt = scheduledAt;
            card.scheduledStatus = "pending";
            card.updatedAt = now();
            await setCards(ctx, companyId, cards);
            return { content: `Scheduled ${card.topic} for ${scheduledAt}`, data: card };
          }
          case "cancel": {
            const card = cards.find((c) => c.id === cardId);
            if (!card) return { content: "Card not found" };
            card.scheduledAt = null;
            card.scheduledStatus = null;
            card.updatedAt = now();
            await setCards(ctx, companyId, cards);
            return { content: `Schedule cancelled for ${card.topic}`, data: card };
          }
          case "list": {
            const scheduled = cards.filter((c) => c.scheduledAt);
            return { content: `${scheduled.length} scheduled posts`, data: scheduled };
          }
          default:
            return { content: `Unknown action: ${action}` };
        }
      },
    );

    ctx.tools.register(
      TOOL_NAMES.manageTemplates,
      toolDecl("Manage Templates", "Manage content templates"),
      async (params, runCtx): Promise<ToolResult> => {
        const { action, templateId, name, platform, captionTemplate, tone, variables } = params as any;
        const companyId = runCtx.companyId;
        const templates = await getTemplates(ctx, companyId);

        switch (action) {
          case "create": {
            const tmpl: ContentTemplate = {
              id: uuid(), name: name ?? "Untitled", platform: platform ?? "twitter",
              captionTemplate: captionTemplate ?? "", tone: tone ?? "witty", createdAt: now(),
            };
            templates.push(tmpl);
            await setTemplates(ctx, companyId, templates);
            return { content: `Template created: ${tmpl.name}`, data: tmpl };
          }
          case "list":
            return { content: `${templates.length} templates`, data: templates };
          case "apply": {
            const tmpl = templates.find((t) => t.id === templateId);
            if (!tmpl) return { content: "Template not found" };
            let resolved = tmpl.captionTemplate;
            if (variables) {
              for (const [key, val] of Object.entries(variables as Record<string, unknown>)) {
                resolved = resolved.replace(new RegExp(`\\{\\{${key}\\}\\}`, "g"), String(val));
              }
            }
            return { content: resolved, data: { caption: resolved, platform: tmpl.platform, tone: tmpl.tone } };
          }
          case "delete": {
            await setTemplates(ctx, companyId, templates.filter((t) => t.id !== templateId));
            return { content: "Template deleted", data: { success: true } };
          }
          default:
            return { content: `Unknown action: ${action}` };
        }
      },
    );

    ctx.tools.register(
      TOOL_NAMES.bulkOperations,
      toolDecl("Bulk Operations", "Bulk operations on pipeline cards"),
      async (params, runCtx): Promise<ToolResult> => {
        const { action, cardIds, targetStatus, campaignId } = params as any;
        const companyId = runCtx.companyId;
        const cards = await getCards(ctx, companyId);
        let succeeded = 0, failed = 0, skipped = 0;
        const details: { cardId: string; status: string; reason?: string }[] = [];

        for (const cardId of cardIds as string[]) {
          const card = cards.find((c) => c.id === cardId);
          if (!card) { failed++; details.push({ cardId, status: "failed", reason: "not found" }); continue; }
          switch (action) {
            case "approve":
              if (card.status !== "review") { skipped++; details.push({ cardId, status: "skipped" }); }
              else { card.status = "approved"; card.updatedAt = now(); succeeded++; details.push({ cardId, status: "ok" }); }
              break;
            case "reject":
              if (card.status !== "review") { skipped++; details.push({ cardId, status: "skipped" }); }
              else { card.status = "draft"; card.updatedAt = now(); succeeded++; details.push({ cardId, status: "ok" }); }
              break;
            case "move":
              if (targetStatus) { card.status = targetStatus; card.updatedAt = now(); succeeded++; details.push({ cardId, status: "ok" }); }
              else { skipped++; details.push({ cardId, status: "skipped" }); }
              break;
            case "assign-campaign":
              card.campaignId = campaignId ?? null; card.updatedAt = now(); succeeded++; details.push({ cardId, status: "ok" });
              break;
            default:
              skipped++; details.push({ cardId, status: "skipped" });
          }
        }
        await setCards(ctx, companyId, cards);
        return {
          content: `Bulk ${action}: ${succeeded} ok, ${failed} failed, ${skipped} skipped`,
          data: { total: (cardIds as string[]).length, succeeded, failed, skipped, details },
        };
      },
    );

    ctx.tools.register(
      TOOL_NAMES.manageVariants,
      toolDecl("Manage A/B Variants", "A/B variant testing"),
      async (params, runCtx): Promise<ToolResult> => {
        const { action, sourceCardId, variantGroupId, winnerCardId } = params as any;
        const companyId = runCtx.companyId;
        const cards = await getCards(ctx, companyId);

        switch (action) {
          case "create-variant": {
            const source = cards.find((c) => c.id === sourceCardId);
            if (!source) return { content: "Source card not found" };
            const groupId = source.variantGroupId ?? uuid();
            if (!source.variantGroupId) { source.variantGroupId = groupId; source.variantLabel = "A"; source.updatedAt = now(); }
            const variants = cards.filter((c) => c.variantGroupId === groupId);
            if (variants.length >= 3) return { content: "Max 3 variants per group" };
            const label = String.fromCharCode(65 + variants.length);
            const variant: ContentCard = {
              ...source, id: uuid(), variantGroupId: groupId, variantLabel: label,
              status: "draft", linkedIssueId: null, platformPostRef: null, publishError: null, publishAttempts: 0,
              createdAt: now(), updatedAt: now(),
            };
            cards.push(variant);
            await setCards(ctx, companyId, cards);
            return { content: `Variant ${label} created`, data: { card: variant, groupId } };
          }
          case "list": {
            const groups = new Map<string, ContentCard[]>();
            for (const c of cards) {
              if (c.variantGroupId) {
                const arr = groups.get(c.variantGroupId) ?? [];
                arr.push(c);
                groups.set(c.variantGroupId, arr);
              }
            }
            const result = Array.from(groups.entries()).map(([gid, members]) => ({ groupId: gid, members }));
            return { content: `${result.length} variant groups`, data: result };
          }
          case "compare": {
            const group = cards.filter((c) => c.variantGroupId === variantGroupId);
            return { content: `${group.length} variants in group`, data: group };
          }
          case "pick-winner": {
            const card = cards.find((c) => c.id === winnerCardId);
            if (!card) return { content: "Card not found" };
            return { content: `Winner selected: ${card.variantLabel}`, data: { winner: card } };
          }
          default:
            return { content: `Unknown action: ${action}` };
        }
      },
    );

    // ------------------------------------------------------------------
    // Jobs
    // ------------------------------------------------------------------

    ctx.jobs.register(JOB_KEYS.scheduledPublish, async (_job) => {
      ctx.logger.info("[ScheduledPublish] Checking for posts due...");
    });

    ctx.jobs.register(JOB_KEYS.engagementPoll, async (_job) => {
      ctx.logger.info("[EngagementPoll] Polling platform APIs...");
    });

    ctx.jobs.register(JOB_KEYS.trendRefresh, async (_job) => {
      ctx.logger.info("[TrendRefresh] Refreshing trend feeds...");
    });

    ctx.logger.info("BrandAmbassador plugin initialized — 12 tools, 3 jobs registered.");
  },

  async onHealth() {
    return { status: "ok" as const, details: { version: "0.1.0" } };
  },

  async onWebhook(input: PluginWebhookInput) {
    // Handle RSS.app webhook pushes
    void input;
  },

  async onShutdown() {
    // Graceful shutdown
  },
});

export default plugin;

if (typeof globalThis.process !== "undefined") {
  runWorker(plugin, import.meta.url);
}
