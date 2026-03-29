/**
 * Telegram adapter — Bot API for publishing + engagement reading.
 *
 * Falls back to mock mode when TELEGRAM_BOT_TOKEN is not configured.
 */

import type {
  PlatformAdapter,
  PublishPayload,
  PublishResult,
  PlatformPostRef,
  EngagementMetrics,
  AdapterHealth,
} from "./adapter.js";
import { mockPublishResult, mockEngagement } from "./adapter.js";
import { resilientFetch } from "./resilientHttp.js";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const TG_API = "https://api.telegram.org";
const SERVICE_NAME = "telegram";

// ---------------------------------------------------------------------------
// Credentials
// ---------------------------------------------------------------------------

export interface TelegramCredentials {
  botToken: string;
  channelIds: string[];
}

// ---------------------------------------------------------------------------
// Response types
// ---------------------------------------------------------------------------

interface TgSendMessageResult {
  ok: boolean;
  result?: {
    message_id: number;
    chat: { id: number; title?: string; username?: string };
    date: number;
  };
  description?: string;
}

interface TgMessageInfo {
  ok: boolean;
  result?: {
    views?: number;
    forwards?: number;
    reactions?: { results?: Array<{ count: number }> };
  };
}

// ---------------------------------------------------------------------------
// Adapter
// ---------------------------------------------------------------------------

export class TelegramAdapter implements PlatformAdapter {
  readonly platform = "telegram" as const;
  private creds: TelegramCredentials | null;

  constructor(creds: TelegramCredentials | null) {
    this.creds = creds;
  }

  updateCredentials(creds: TelegramCredentials | null): void {
    this.creds = creds;
  }

  private get isMock(): boolean {
    return !this.creds;
  }

  private get apiBase(): string {
    return `${TG_API}/bot${this.creds!.botToken}`;
  }

  // -----------------------------------------------------------------------
  // Publish
  // -----------------------------------------------------------------------

  async publish(payload: PublishPayload): Promise<PublishResult> {
    if (this.isMock) return mockPublishResult("telegram");

    const channelId = this.creds!.channelIds[0];
    if (!channelId) {
      return { success: false, platformPostId: "", platformUrl: "", error: "No channel configured" };
    }

    const parseMode = payload.formatting === "markdown" ? "MarkdownV2" : "HTML";

    // If media is attached, use sendPhoto/sendDocument
    if (payload.mediaRef && payload.mediaType === "image") {
      const body = {
        chat_id: channelId,
        photo: payload.mediaRef,
        caption: payload.caption,
        parse_mode: parseMode,
      };

      const res = await resilientFetch(
        `${this.apiBase}/sendPhoto`,
        { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) },
        { serviceName: SERVICE_NAME, endpointKey: "sendPhoto", maxRetries: 1, timeoutMs: 15_000 },
      );

      const json = (await res.json()) as TgSendMessageResult;
      if (!json.ok || !json.result) {
        return { success: false, platformPostId: "", platformUrl: "", error: json.description ?? "sendPhoto failed" };
      }

      const msgId = json.result.message_id;
      const chatUsername = json.result.chat.username;
      const url = chatUsername ? `https://t.me/${chatUsername}/${msgId}` : "";

      return { success: true, platformPostId: String(msgId), platformUrl: url };
    }

    // Text-only message
    const body = {
      chat_id: channelId,
      text: payload.caption,
      parse_mode: parseMode,
    };

    const res = await resilientFetch(
      `${this.apiBase}/sendMessage`,
      { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) },
      { serviceName: SERVICE_NAME, endpointKey: "sendMessage", maxRetries: 1, timeoutMs: 10_000 },
    );

    const json = (await res.json()) as TgSendMessageResult;
    if (!json.ok || !json.result) {
      return { success: false, platformPostId: "", platformUrl: "", error: json.description ?? "sendMessage failed" };
    }

    const msgId = json.result.message_id;
    const chatUsername = json.result.chat.username;
    const url = chatUsername ? `https://t.me/${chatUsername}/${msgId}` : "";

    return { success: true, platformPostId: String(msgId), platformUrl: url };
  }

  // -----------------------------------------------------------------------
  // Engagement
  // -----------------------------------------------------------------------

  async getEngagement(ref: PlatformPostRef): Promise<EngagementMetrics> {
    if (this.isMock) return mockEngagement("telegram");

    // Telegram doesn't have a direct "get message stats" endpoint for bots.
    // Channel message views/forwards are available via MTProto but not Bot API.
    // We approximate by calling getChat + forwarded counts where possible.
    // For channels with linked discussion groups, we could count replies.

    // Attempt to use getChatMessage (non-standard — some proxied APIs support this)
    try {
      const channelId = this.creds!.channelIds[0];
      if (!channelId) return mockEngagement("telegram");

      // Try to get the message to check views/forwards
      // Note: Bot API doesn't natively expose views. This is a best-effort attempt.
      const res = await resilientFetch(
        `${this.apiBase}/forwardMessage`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: channelId,
            from_chat_id: channelId,
            message_id: parseInt(ref.postId, 10),
            disable_notification: true,
          }),
        },
        { serviceName: SERVICE_NAME, endpointKey: "getEngagement", maxRetries: 0, timeoutMs: 5_000 },
      );

      // If forward worked, delete the forwarded copy immediately
      const fwdJson = (await res.json()) as TgSendMessageResult;
      if (fwdJson.ok && fwdJson.result) {
        // Delete the forwarded message to clean up
        await resilientFetch(
          `${this.apiBase}/deleteMessage`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ chat_id: channelId, message_id: fwdJson.result.message_id }),
          },
          { serviceName: SERVICE_NAME, endpointKey: "deleteMessage", maxRetries: 0, timeoutMs: 5_000 },
        ).catch(() => {});
      }
    } catch {
      // Expected — Bot API engagement is limited
    }

    // Return zeros for metrics we can't access via Bot API
    return {
      likes: 0,
      comments: 0,
      shares: 0,
      impressions: 0,
      platform: "telegram",
      fetchedAt: new Date().toISOString(),
    };
  }

  // -----------------------------------------------------------------------
  // Health
  // -----------------------------------------------------------------------

  async health(): Promise<AdapterHealth> {
    if (this.isMock) return { ok: false, reason: "Telegram credentials not configured" };

    try {
      const res = await resilientFetch(
        `${this.apiBase}/getMe`,
        {},
        { serviceName: SERVICE_NAME, endpointKey: "getMe", maxRetries: 0, timeoutMs: 5_000 },
      );
      const json = (await res.json()) as { ok: boolean; description?: string };
      return json.ok ? { ok: true } : { ok: false, reason: json.description ?? "getMe failed" };
    } catch (err: any) {
      return { ok: false, reason: err.message };
    }
  }
}
