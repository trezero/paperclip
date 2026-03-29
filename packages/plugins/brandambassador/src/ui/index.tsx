import React, { useState, useMemo, useCallback } from "react";
import {
  usePluginData,
  usePluginAction,
  usePluginStream,
  useHostContext,
  usePluginToast,
  useNavigateToEntity,
} from "@paperclipai/plugin-sdk/ui";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type CardStatus = "draft" | "review" | "approved" | "published";
type Platform = "twitter" | "reddit" | "telegram";

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
  scheduledStatus: string | null;
  platformPostRef: string | null;
  variantGroupId: string | null;
  variantLabel: string | null;
  createdAt: string;
  updatedAt: string;
}

interface ScoredTrend {
  id: string;
  title: string;
  source: string;
  platform: string;
  url: string | null;
  score: number;
  summary: string;
  discoveredAt: string;
}

interface Campaign {
  id: string;
  name: string;
  description: string;
  platforms: Platform[];
  startDate: string | null;
  endDate: string | null;
}

interface EngagementMetrics {
  likes: number;
  comments: number;
  shares: number;
  impressions: number;
  platform: string;
  fetchedAt: string;
}

interface EngagementSummaryItem {
  cardId: string;
  topic: string;
  platform: string;
  latest: EngagementMetrics | null;
}

interface BrandSettings {
  tone: string;
  audience: string;
  platforms: Platform[];
  defaultHashtags: string[];
  engagementAlertThresholds: {
    viralLikes: number;
    viralRetweets: number;
    dropPct: number;
  };
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = {
  hub: {
    display: "flex",
    height: "100%",
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    color: "#e0e0e0",
    background: "#0f0f13",
  } as React.CSSProperties,
  sidebar: {
    width: 220,
    borderRight: "1px solid #2a2a35",
    display: "flex",
    flexDirection: "column" as const,
    padding: "16px 0",
    background: "#14141b",
    flexShrink: 0,
  } as React.CSSProperties,
  sidebarItem: (active: boolean) =>
    ({
      padding: "10px 20px",
      cursor: "pointer",
      fontSize: 14,
      fontWeight: active ? 600 : 400,
      color: active ? "#7c6ef0" : "#999",
      background: active ? "rgba(124, 110, 240, 0.08)" : "transparent",
      borderLeft: active ? "3px solid #7c6ef0" : "3px solid transparent",
      transition: "all 0.15s",
    }) as React.CSSProperties,
  canvas: {
    flex: 1,
    overflow: "auto",
    padding: 24,
  } as React.CSSProperties,
  detailPanel: {
    width: 360,
    borderLeft: "1px solid #2a2a35",
    padding: 20,
    background: "#14141b",
    overflow: "auto",
    flexShrink: 0,
  } as React.CSSProperties,
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  } as React.CSSProperties,
  h2: {
    margin: 0,
    fontSize: 20,
    fontWeight: 600,
  } as React.CSSProperties,
  btn: (variant: "primary" | "secondary" | "ghost" = "primary") =>
    ({
      padding: "8px 16px",
      borderRadius: 6,
      border: variant === "ghost" ? "1px solid #333" : "none",
      background:
        variant === "primary"
          ? "#7c6ef0"
          : variant === "secondary"
            ? "#2a2a35"
            : "transparent",
      color: variant === "primary" ? "#fff" : "#ccc",
      cursor: "pointer",
      fontSize: 13,
      fontWeight: 500,
    }) as React.CSSProperties,
  kanban: {
    display: "flex",
    gap: 16,
    minHeight: 400,
  } as React.CSSProperties,
  column: {
    flex: 1,
    background: "#1a1a24",
    borderRadius: 8,
    padding: 12,
    minWidth: 200,
  } as React.CSSProperties,
  columnTitle: {
    fontSize: 12,
    fontWeight: 600,
    textTransform: "uppercase" as const,
    letterSpacing: "0.05em",
    color: "#888",
    marginBottom: 12,
    display: "flex",
    justifyContent: "space-between",
  } as React.CSSProperties,
  card: (selected: boolean) =>
    ({
      background: selected ? "#252535" : "#1e1e2a",
      borderRadius: 8,
      padding: 12,
      marginBottom: 8,
      cursor: "pointer",
      border: selected ? "1px solid #7c6ef0" : "1px solid #2a2a35",
      transition: "border-color 0.15s",
    }) as React.CSSProperties,
  cardTitle: {
    fontSize: 14,
    fontWeight: 500,
    marginBottom: 4,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap" as const,
  } as React.CSSProperties,
  cardMeta: {
    fontSize: 11,
    color: "#777",
    display: "flex",
    gap: 8,
    alignItems: "center",
  } as React.CSSProperties,
  pill: (color: string) =>
    ({
      display: "inline-block",
      padding: "2px 8px",
      borderRadius: 10,
      fontSize: 11,
      fontWeight: 500,
      background: color + "22",
      color,
    }) as React.CSSProperties,
  trendCard: {
    background: "#1e1e2a",
    borderRadius: 8,
    padding: 14,
    marginBottom: 10,
    border: "1px solid #2a2a35",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  } as React.CSSProperties,
  input: {
    background: "#1a1a24",
    border: "1px solid #333",
    borderRadius: 6,
    padding: "8px 12px",
    color: "#e0e0e0",
    fontSize: 13,
    width: "100%",
    boxSizing: "border-box" as const,
  } as React.CSSProperties,
  textarea: {
    background: "#1a1a24",
    border: "1px solid #333",
    borderRadius: 6,
    padding: "8px 12px",
    color: "#e0e0e0",
    fontSize: 13,
    width: "100%",
    minHeight: 80,
    resize: "vertical" as const,
    boxSizing: "border-box" as const,
  } as React.CSSProperties,
  select: {
    background: "#1a1a24",
    border: "1px solid #333",
    borderRadius: 6,
    padding: "8px 12px",
    color: "#e0e0e0",
    fontSize: 13,
  } as React.CSSProperties,
  emptyState: {
    textAlign: "center" as const,
    padding: 40,
    color: "#666",
    fontSize: 14,
  } as React.CSSProperties,
  section: {
    marginBottom: 20,
  } as React.CSSProperties,
  label: {
    fontSize: 12,
    fontWeight: 500,
    color: "#999",
    marginBottom: 6,
    display: "block" as const,
  } as React.CSSProperties,
  brandFooter: {
    marginTop: "auto",
    padding: "16px 20px",
    borderTop: "1px solid #2a2a35",
    fontSize: 12,
    color: "#666",
  } as React.CSSProperties,
};

const PLATFORM_COLORS: Record<string, string> = {
  twitter: "#1DA1F2",
  reddit: "#FF4500",
  telegram: "#0088cc",
  web: "#8b8b8b",
};

const STATUS_COLUMNS: CardStatus[] = ["draft", "review", "approved", "published"];

// ---------------------------------------------------------------------------
// Pipeline View (Kanban)
// ---------------------------------------------------------------------------

function PipelineView({
  cards,
  selectedCardId,
  onSelectCard,
  onRefresh,
}: {
  cards: ContentCard[];
  selectedCardId: string | null;
  onSelectCard: (id: string | null) => void;
  onRefresh: () => void;
}) {
  const execute = usePluginAction("execute-tool");
  const toast = usePluginToast();
  const hostCtx = useHostContext();
  const [bulkMode, setBulkMode] = useState(false);
  const [bulkSelected, setBulkSelected] = useState<Set<string>>(new Set());

  const columnCards = useMemo(() => {
    const groups: Record<CardStatus, ContentCard[]> = {
      draft: [],
      review: [],
      approved: [],
      published: [],
    };
    for (const card of cards) {
      groups[card.status]?.push(card);
    }
    return groups;
  }, [cards]);

  const toggleBulkCard = useCallback((id: string) => {
    setBulkSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleBulkStatusChange = useCallback(async (targetStatus: CardStatus) => {
    if (bulkSelected.size === 0) return;
    const count = bulkSelected.size;
    toast({ title: `Moving ${count} post${count > 1 ? "s" : ""} to ${targetStatus}...`, tone: "info" });
    try {
      for (const cardId of bulkSelected) {
        await execute({
          toolName: "update-card-status",
          parameters: { cardId, status: targetStatus },
          runContext: { companyId: hostCtx.companyId },
        });
      }
      toast({ title: `${count} post${count > 1 ? "s" : ""} moved to ${targetStatus}`, tone: "success" });
      setBulkSelected(new Set());
      onRefresh();
    } catch (err: any) {
      toast({ title: `Bulk update failed: ${err.message}`, tone: "error" });
    }
  }, [bulkSelected, execute, hostCtx.companyId, toast, onRefresh]);

  const handleAutoGenerate = useCallback(async () => {
    toast({ title: "Generating post...", tone: "info" });
    try {
      await execute({
        toolName: "generate-post",
        parameters: { topic: "Trending in crypto today", platform: "twitter" },
        runContext: { companyId: hostCtx.companyId },
      });
      toast({ title: "Post generated and added to drafts!", tone: "success" });
      onRefresh();
    } catch (err: any) {
      toast({ title: `Generation failed: ${err.message}`, tone: "error" });
    }
  }, [execute, hostCtx.companyId, toast, onRefresh]);

  return (
    <div>
      <div style={styles.header}>
        <h2 style={styles.h2}>Pipeline</h2>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button
            style={styles.btn(bulkMode ? "primary" : "ghost")}
            onClick={() => { setBulkMode((v) => !v); setBulkSelected(new Set()); }}
          >
            {bulkMode ? "Exit Bulk" : "Bulk Select"}
          </button>
          <button style={styles.btn("secondary")} onClick={onRefresh}>
            Refresh
          </button>
          <button style={styles.btn("primary")} onClick={handleAutoGenerate}>
            + Auto-Generate
          </button>
        </div>
      </div>

      {/* Bulk action bar */}
      {bulkMode && bulkSelected.size > 0 && (
        <div style={{ display: "flex", gap: 8, alignItems: "center", padding: "8px 12px", background: "#1a1a24", borderRadius: 8, marginBottom: 12 }}>
          <span style={{ fontSize: 13, color: "#ccc" }}>{bulkSelected.size} selected</span>
          <button style={styles.btn("secondary")} onClick={() => handleBulkStatusChange("review")}>
            Move to Review
          </button>
          <button style={styles.btn("secondary")} onClick={() => handleBulkStatusChange("approved")}>
            Approve All
          </button>
          <button style={styles.btn("ghost")} onClick={() => setBulkSelected(new Set())}>
            Clear
          </button>
        </div>
      )}

      <div style={styles.kanban}>
        {STATUS_COLUMNS.map((status) => (
          <div key={status} style={styles.column}>
            <div style={styles.columnTitle}>
              <span>{status}</span>
              <span style={styles.pill("#7c6ef0")}>{columnCards[status].length}</span>
            </div>
            {columnCards[status].length === 0 && (
              <div style={{ color: "#555", fontSize: 12, textAlign: "center", padding: 20 }}>
                No {status} posts
              </div>
            )}
            {columnCards[status].map((card) => (
              <div
                key={card.id}
                style={{
                  ...styles.card(bulkMode ? bulkSelected.has(card.id) : card.id === selectedCardId),
                  position: "relative" as const,
                }}
                onClick={() => bulkMode ? toggleBulkCard(card.id) : onSelectCard(card.id === selectedCardId ? null : card.id)}
              >
                {bulkMode && (
                  <input
                    type="checkbox"
                    checked={bulkSelected.has(card.id)}
                    readOnly
                    style={{ position: "absolute" as const, top: 8, right: 8, accentColor: "#7c6ef0" }}
                  />
                )}
                <div style={styles.cardTitle}>{card.topic}</div>
                <div style={styles.cardMeta}>
                  <span style={styles.pill(PLATFORM_COLORS[card.platform] ?? "#888")}>
                    {card.platform}
                  </span>
                  {card.moderationScore != null && (
                    <span
                      style={styles.pill(card.moderationScore >= 70 ? "#4caf50" : "#f44336")}
                    >
                      {card.moderationScore}
                    </span>
                  )}
                  {card.variantLabel && (
                    <span style={styles.pill("#ff9800")}>{card.variantLabel}</span>
                  )}
                  {card.source === "agent" && (
                    <span style={styles.pill("#7c6ef0")}>AI</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Detail Panel
// ---------------------------------------------------------------------------

function DetailPanel({
  card,
  onStatusChange,
  onClose,
}: {
  card: ContentCard;
  onStatusChange: (cardId: string, status: CardStatus) => void;
  onClose: () => void;
}) {
  const hostCtx = useHostContext();
  const navigateToEntity = useNavigateToEntity();

  return (
    <div style={styles.detailPanel}>
      <div style={{ ...styles.header, marginBottom: 16 }}>
        <h3 style={{ margin: 0, fontSize: 16 }}>Card Detail</h3>
        <button style={styles.btn("ghost")} onClick={onClose}>
          x
        </button>
      </div>

      <div style={styles.section}>
        <div style={styles.label}>Topic</div>
        <div>{card.topic}</div>
      </div>

      <div style={styles.section}>
        <div style={styles.label}>Caption</div>
        <div style={{ fontSize: 13, lineHeight: 1.5, color: "#ccc" }}>{card.caption}</div>
      </div>

      <div style={styles.section}>
        <div style={styles.label}>Platform</div>
        <span style={styles.pill(PLATFORM_COLORS[card.platform] ?? "#888")}>
          {card.platform}
        </span>
      </div>

      {card.moderationScore != null && (
        <div style={styles.section}>
          <div style={styles.label}>Moderation Score</div>
          <span style={styles.pill(card.moderationScore >= 70 ? "#4caf50" : "#f44336")}>
            {card.moderationScore}/100
          </span>
        </div>
      )}

      {card.mediaRef && (
        <div style={styles.section}>
          <div style={styles.label}>Media</div>
          <div style={{ color: "#999", fontSize: 12 }}>{card.mediaRef}</div>
        </div>
      )}

      {card.linkedIssueId && (
        <div style={styles.section}>
          <div style={styles.label}>Linked Issue</div>
          <button
            style={{ ...styles.btn("ghost"), fontSize: 12 }}
            onClick={() =>
              navigateToEntity({
                type: "issue",
                id: card.linkedIssueId!,
                companyId: hostCtx.companyId!,
              })
            }
          >
            View Issue &rarr;
          </button>
        </div>
      )}

      {card.scheduledAt && (
        <div style={styles.section}>
          <div style={styles.label}>Scheduled</div>
          <div style={{ fontSize: 12, color: "#999" }}>
            {new Date(card.scheduledAt).toLocaleString()}
            {card.scheduledStatus && (
              <span style={styles.pill("#ff9800")}> {card.scheduledStatus}</span>
            )}
          </div>
        </div>
      )}

      <div style={{ ...styles.section, display: "flex", gap: 8, flexWrap: "wrap" }}>
        {card.status === "draft" && (
          <button
            style={styles.btn("primary")}
            onClick={() => onStatusChange(card.id, "review")}
          >
            Submit for Review
          </button>
        )}
        {card.status === "review" && (
          <>
            <button
              style={styles.btn("primary")}
              onClick={() => onStatusChange(card.id, "approved")}
            >
              Approve
            </button>
            <button
              style={styles.btn("secondary")}
              onClick={() => onStatusChange(card.id, "draft")}
            >
              Reject
            </button>
          </>
        )}
        {card.status === "approved" && (
          <button
            style={styles.btn("primary")}
            onClick={() => onStatusChange(card.id, "published")}
          >
            Publish
          </button>
        )}
      </div>

      <div style={{ fontSize: 11, color: "#555", marginTop: 16 }}>
        Created: {new Date(card.createdAt).toLocaleString()}
        <br />
        Updated: {new Date(card.updatedAt).toLocaleString()}
        <br />
        Source: {card.source}
        {card.sourceAgentId && ` (${card.sourceAgentId})`}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Create Workshop
// ---------------------------------------------------------------------------

const TEMPLATES: { name: string; topic: string; tone: string; platform: Platform }[] = [
  { name: "Product Launch", topic: "New feature launch announcement", tone: "hype", platform: "twitter" },
  { name: "Community Update", topic: "Weekly community progress update", tone: "friendly", platform: "reddit" },
  { name: "Alpha Leak", topic: "Upcoming partnership or integration hint", tone: "mysterious", platform: "twitter" },
  { name: "Educational", topic: "How our technology works explained simply", tone: "professional", platform: "reddit" },
  { name: "Meme Drop", topic: "Fun community meme about the project", tone: "witty", platform: "twitter" },
  { name: "AMA Promo", topic: "Upcoming AMA session announcement", tone: "exciting", platform: "telegram" },
];

function CreateView({ onRefresh }: { onRefresh: () => void }) {
  const execute = usePluginAction("execute-tool");
  const toast = usePluginToast();
  const hostCtx = useHostContext();
  const [topic, setTopic] = useState("");
  const [platform, setPlatform] = useState<Platform>("twitter");
  const [tone, setTone] = useState("");
  const [abTest, setAbTest] = useState(false);
  const [variantCount, setVariantCount] = useState(3);
  const [result, setResult] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);

  const applyTemplate = useCallback((t: typeof TEMPLATES[number]) => {
    setTopic(t.topic);
    setTone(t.tone);
    setPlatform(t.platform);
    setShowTemplates(false);
    toast({ title: `Applied "${t.name}" template`, tone: "info" });
  }, [toast]);

  const handleGenerate = useCallback(async () => {
    if (!topic.trim()) {
      toast({ title: "Enter a topic", tone: "error" });
      return;
    }
    setRunning(true);
    setResult(null);
    try {
      if (abTest) {
        // Generate multiple variants for A/B testing
        const tones = tone
          ? [tone, `${tone} but edgier`, `${tone} but casual`]
          : ["professional", "witty", "hype"];
        const count = Math.min(variantCount, tones.length);
        const groupId = `ab-${Date.now()}`;
        const results: string[] = [];

        for (let i = 0; i < count; i++) {
          const res = await execute({
            toolName: "generate-post",
            parameters: {
              topic,
              platform,
              tone: tones[i],
              variantGroupId: groupId,
              variantLabel: String.fromCharCode(65 + i), // A, B, C
            },
            runContext: { companyId: hostCtx.companyId },
          });
          results.push(`Variant ${String.fromCharCode(65 + i)} (${tones[i]}):\n${JSON.stringify(res, null, 2)}`);
        }

        setResult(results.join("\n\n---\n\n"));
        toast({ title: `${count} A/B variants created in drafts!`, tone: "success" });
      } else {
        const res = await execute({
          toolName: "generate-post",
          parameters: {
            topic,
            platform,
            tone: tone || undefined,
          },
          runContext: { companyId: hostCtx.companyId },
        });
        setResult(JSON.stringify(res, null, 2));
        toast({ title: "Post created in drafts!", tone: "success" });
      }
      onRefresh();
    } catch (err: any) {
      toast({ title: err.message, tone: "error" });
      setResult(`Error: ${err.message}`);
    } finally {
      setRunning(false);
    }
  }, [topic, platform, tone, abTest, variantCount, execute, hostCtx.companyId, toast, onRefresh]);

  return (
    <div>
      <div style={styles.header}>
        <h2 style={styles.h2}>Create Workshop</h2>
        <button style={styles.btn("ghost")} onClick={() => setShowTemplates((v) => !v)}>
          {showTemplates ? "Hide Templates" : "Templates"}
        </button>
      </div>

      {/* Templates panel */}
      {showTemplates && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginBottom: 20 }}>
          {TEMPLATES.map((t) => (
            <button
              key={t.name}
              onClick={() => applyTemplate(t)}
              style={{
                background: "#1a1a24",
                border: "1px solid #2a2a35",
                borderRadius: 8,
                padding: 12,
                cursor: "pointer",
                textAlign: "left" as const,
                color: "#e0e0e0",
              }}
            >
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>{t.name}</div>
              <div style={{ fontSize: 11, color: "#888" }}>{t.platform} &middot; {t.tone}</div>
            </button>
          ))}
        </div>
      )}

      <div style={{ maxWidth: 600 }}>
        <div style={styles.section}>
          <label style={styles.label}>Topic</label>
          <input
            style={styles.input}
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="What should the post be about?"
          />
        </div>
        <div style={{ display: "flex", gap: 12, ...styles.section }}>
          <div style={{ flex: 1 }}>
            <label style={styles.label}>Platform</label>
            <select
              style={styles.select}
              value={platform}
              onChange={(e) => setPlatform(e.target.value as Platform)}
            >
              <option value="twitter">Twitter</option>
              <option value="reddit">Reddit</option>
              <option value="telegram">Telegram</option>
            </select>
          </div>
          <div style={{ flex: 1 }}>
            <label style={styles.label}>Tone (optional)</label>
            <input
              style={styles.input}
              value={tone}
              onChange={(e) => setTone(e.target.value)}
              placeholder="witty, serious, hype..."
            />
          </div>
        </div>

        {/* A/B Testing toggle */}
        <div style={{ ...styles.section, display: "flex", alignItems: "center", gap: 12 }}>
          <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 13, color: "#ccc" }}>
            <input
              type="checkbox"
              checked={abTest}
              onChange={(e) => setAbTest(e.target.checked)}
              style={{ accentColor: "#7c6ef0" }}
            />
            A/B Test Mode
          </label>
          {abTest && (
            <select
              style={{ ...styles.select, width: "auto" }}
              value={variantCount}
              onChange={(e) => setVariantCount(Number(e.target.value))}
            >
              <option value={2}>2 variants</option>
              <option value={3}>3 variants</option>
            </select>
          )}
          {abTest && (
            <span style={{ fontSize: 11, color: "#888" }}>
              Generates multiple tone variants in a shared group for comparison
            </span>
          )}
        </div>

        <button
          style={{ ...styles.btn("primary"), width: "100%", padding: 12 }}
          onClick={handleGenerate}
          disabled={running}
        >
          {running ? "Generating..." : abTest ? `Generate ${variantCount} Variants` : "Generate Post"}
        </button>
        {result && (
          <pre
            style={{
              marginTop: 16,
              background: "#1a1a24",
              padding: 12,
              borderRadius: 8,
              fontSize: 12,
              overflow: "auto",
              maxHeight: 300,
              color: "#aaa",
            }}
          >
            {result}
          </pre>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Discover View
// ---------------------------------------------------------------------------

function DiscoverView({ onRefresh }: { onRefresh: () => void }) {
  const { data: trends, loading } = usePluginData<ScoredTrend[]>("trends");
  const execute = usePluginAction("execute-tool");
  const toast = usePluginToast();
  const hostCtx = useHostContext();

  const handleDismiss = useCallback(
    async (trendId: string) => {
      try {
        await execute({
          toolName: "dismiss-trend",
          parameters: { trendId },
          runContext: { companyId: hostCtx.companyId },
        });
        toast({ title: "Trend dismissed", tone: "info" });
        onRefresh();
      } catch (err: any) {
        toast({ title: err.message, tone: "error" });
      }
    },
    [execute, hostCtx.companyId, toast, onRefresh],
  );

  const handleCreateFrom = useCallback(
    async (trend: ScoredTrend) => {
      toast({ title: `Creating post from "${trend.title}"...`, tone: "info" });
      try {
        await execute({
          toolName: "generate-post",
          parameters: {
            topic: trend.title,
            platform: trend.platform === "web" ? "twitter" : trend.platform,
          },
          runContext: { companyId: hostCtx.companyId },
        });
        toast({ title: "Post created!", tone: "success" });
        onRefresh();
      } catch (err: any) {
        toast({ title: err.message, tone: "error" });
      }
    },
    [execute, hostCtx.companyId, toast, onRefresh],
  );

  if (loading) return <div style={styles.emptyState}>Loading trends...</div>;

  const trendList = trends ?? [];

  return (
    <div>
      <div style={styles.header}>
        <h2 style={styles.h2}>Discover</h2>
        <button style={styles.btn("secondary")} onClick={onRefresh}>
          Refresh
        </button>
      </div>
      {trendList.length === 0 ? (
        <div style={styles.emptyState}>
          No trends discovered yet. Configure RSS.app feeds in settings to start monitoring.
        </div>
      ) : (
        trendList.map((trend) => (
          <div key={trend.id} style={styles.trendCard}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 4 }}>
                {trend.title}
              </div>
              <div style={{ fontSize: 12, color: "#888", marginBottom: 4 }}>
                {trend.summary}
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <span style={styles.pill(PLATFORM_COLORS[trend.platform] ?? "#888")}>
                  {trend.platform}
                </span>
                <span style={styles.pill("#7c6ef0")}>Score: {trend.score}</span>
                <span style={{ fontSize: 11, color: "#666" }}>{trend.source}</span>
              </div>
            </div>
            <div style={{ display: "flex", gap: 6, flexDirection: "column" }}>
              <button
                style={styles.btn("primary")}
                onClick={() => handleCreateFrom(trend)}
              >
                Create
              </button>
              <button
                style={styles.btn("ghost")}
                onClick={() => handleDismiss(trend.id)}
              >
                Dismiss
              </button>
            </div>
          </div>
        ))
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Monitor View (Engagement)
// ---------------------------------------------------------------------------

function MetricBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <div style={{ width: 80, height: 6, background: "#2a2a35", borderRadius: 3, overflow: "hidden" }}>
        <div style={{ width: `${pct}%`, height: "100%", background: color, borderRadius: 3 }} />
      </div>
      <span style={{ fontSize: 11, color: "#ccc", minWidth: 32 }}>{value.toLocaleString()}</span>
    </div>
  );
}

function EngagementCard({ item, maxMetrics }: { item: EngagementSummaryItem; maxMetrics: { likes: number; comments: number; shares: number; impressions: number } }) {
  const m = item.latest;
  return (
    <div style={{ ...styles.trendCard, flexDirection: "column" as const, alignItems: "stretch", gap: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 500 }}>{item.topic}</div>
          <div style={{ fontSize: 12, color: "#888" }}>{item.platform}</div>
        </div>
        <span style={styles.pill(m ? "#4caf50" : "#666")}>{m ? "Tracked" : "Pending"}</span>
      </div>
      {m ? (
        <div style={{ display: "grid", gridTemplateColumns: "80px 1fr", gap: "4px 8px", fontSize: 12, color: "#aaa" }}>
          <span>Likes</span>
          <MetricBar value={m.likes} max={maxMetrics.likes} color="#e91e63" />
          <span>Comments</span>
          <MetricBar value={m.comments} max={maxMetrics.comments} color="#2196f3" />
          <span>Shares</span>
          <MetricBar value={m.shares} max={maxMetrics.shares} color="#ff9800" />
          <span>Impressions</span>
          <MetricBar value={m.impressions} max={maxMetrics.impressions} color="#7c6ef0" />
          <span style={{ gridColumn: "1 / -1", fontSize: 11, color: "#666", marginTop: 4 }}>
            Last updated: {new Date(m.fetchedAt).toLocaleString()}
          </span>
        </div>
      ) : (
        <div style={{ fontSize: 12, color: "#666" }}>Engagement data not yet collected. Run the engagement poll job to fetch metrics.</div>
      )}
    </div>
  );
}

function MonitorView() {
  const { data: summary } = usePluginData<EngagementSummaryItem[]>("engagement-summary");
  const items = summary ?? [];

  const maxMetrics = useMemo(() => {
    const m = { likes: 1, comments: 1, shares: 1, impressions: 1 };
    for (const item of items) {
      if (!item.latest) continue;
      m.likes = Math.max(m.likes, item.latest.likes);
      m.comments = Math.max(m.comments, item.latest.comments);
      m.shares = Math.max(m.shares, item.latest.shares);
      m.impressions = Math.max(m.impressions, item.latest.impressions);
    }
    return m;
  }, [items]);

  const totals = useMemo(() => {
    const t = { likes: 0, comments: 0, shares: 0, impressions: 0, tracked: 0 };
    for (const item of items) {
      if (!item.latest) continue;
      t.likes += item.latest.likes;
      t.comments += item.latest.comments;
      t.shares += item.latest.shares;
      t.impressions += item.latest.impressions;
      t.tracked++;
    }
    return t;
  }, [items]);

  return (
    <div>
      <div style={styles.header}>
        <h2 style={styles.h2}>Monitor</h2>
      </div>

      {/* Aggregate stats strip */}
      {items.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 20 }}>
          {([
            { label: "Total Likes", value: totals.likes, color: "#e91e63" },
            { label: "Total Comments", value: totals.comments, color: "#2196f3" },
            { label: "Total Shares", value: totals.shares, color: "#ff9800" },
            { label: "Impressions", value: totals.impressions, color: "#7c6ef0" },
          ] as const).map((stat) => (
            <div key={stat.label} style={{ background: "#1a1a24", borderRadius: 8, padding: 14, borderLeft: `3px solid ${stat.color}` }}>
              <div style={{ fontSize: 11, color: "#888", textTransform: "uppercase" as const, letterSpacing: 0.5 }}>{stat.label}</div>
              <div style={{ fontSize: 22, fontWeight: 600, color: "#e0e0e0", marginTop: 4 }}>{stat.value.toLocaleString()}</div>
              <div style={{ fontSize: 11, color: "#666", marginTop: 2 }}>{totals.tracked} post{totals.tracked !== 1 ? "s" : ""} tracked</div>
            </div>
          ))}
        </div>
      )}

      {items.length === 0 ? (
        <div style={styles.emptyState}>
          No published posts yet. Approve and publish content from the pipeline to start tracking engagement.
        </div>
      ) : (
        items.map((item) => (
          <EngagementCard key={item.cardId} item={item} maxMetrics={maxMetrics} />
        ))
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Campaigns View
// ---------------------------------------------------------------------------

function ScheduleCalendar({ cards }: { cards: ContentCard[] }) {
  const scheduled = useMemo(
    () => cards.filter((c) => c.scheduledAt).sort((a, b) => new Date(a.scheduledAt!).getTime() - new Date(b.scheduledAt!).getTime()),
    [cards],
  );

  // Build a 7-day calendar starting today
  const days = useMemo(() => {
    const result: { date: Date; label: string; cards: ContentCard[] }[] = [];
    const today = new Date();
    for (let i = 0; i < 7; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() + i);
      const dayStr = d.toISOString().slice(0, 10);
      result.push({
        date: d,
        label: i === 0 ? "Today" : i === 1 ? "Tomorrow" : d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }),
        cards: scheduled.filter((c) => c.scheduledAt!.slice(0, 10) === dayStr),
      });
    }
    return result;
  }, [scheduled]);

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 8, marginBottom: 20 }}>
      {days.map((day) => (
        <div
          key={day.date.toISOString()}
          style={{
            background: "#1a1a24",
            borderRadius: 8,
            padding: 10,
            minHeight: 80,
            border: day.label === "Today" ? "1px solid #7c6ef0" : "1px solid #2a2a35",
          }}
        >
          <div style={{ fontSize: 11, fontWeight: 600, color: day.label === "Today" ? "#7c6ef0" : "#888", marginBottom: 6 }}>
            {day.label}
          </div>
          {day.cards.length === 0 ? (
            <div style={{ fontSize: 11, color: "#444" }}>-</div>
          ) : (
            day.cards.map((card) => (
              <div
                key={card.id}
                style={{
                  fontSize: 11,
                  padding: "3px 6px",
                  borderRadius: 4,
                  background: "#252535",
                  marginBottom: 4,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap" as const,
                }}
              >
                <span style={styles.pill(PLATFORM_COLORS[card.platform] ?? "#888")}>{card.platform[0]}</span>{" "}
                {card.topic.slice(0, 20)}
              </div>
            ))
          )}
        </div>
      ))}
    </div>
  );
}

function CampaignsView({ onRefresh }: { onRefresh: () => void }) {
  const { data: campaigns, loading } = usePluginData<Campaign[]>("campaigns");
  const { data: cards } = usePluginData<ContentCard[]>("pipeline");
  const execute = usePluginAction("execute-tool");
  const toast = usePluginToast();
  const hostCtx = useHostContext();
  const [newName, setNewName] = useState("");
  const [viewMode, setViewMode] = useState<"list" | "calendar">("list");

  const handleCreate = useCallback(async () => {
    if (!newName.trim()) return;
    try {
      await execute({
        toolName: "manage-campaign",
        parameters: { action: "create", name: newName },
        runContext: { companyId: hostCtx.companyId },
      });
      setNewName("");
      toast({ title: "Campaign created", tone: "success" });
      onRefresh();
    } catch (err: any) {
      toast({ title: err.message, tone: "error" });
    }
  }, [newName, execute, hostCtx.companyId, toast, onRefresh]);

  if (loading) return <div style={styles.emptyState}>Loading campaigns...</div>;

  return (
    <div>
      <div style={styles.header}>
        <h2 style={styles.h2}>Campaigns & Schedule</h2>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            style={styles.btn(viewMode === "list" ? "primary" : "ghost")}
            onClick={() => setViewMode("list")}
          >
            List
          </button>
          <button
            style={styles.btn(viewMode === "calendar" ? "primary" : "ghost")}
            onClick={() => setViewMode("calendar")}
          >
            Calendar
          </button>
        </div>
      </div>

      {viewMode === "calendar" && <ScheduleCalendar cards={cards ?? []} />}

      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <input
          style={{ ...styles.input, flex: 1 }}
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="New campaign name..."
          onKeyDown={(e) => e.key === "Enter" && handleCreate()}
        />
        <button style={styles.btn("primary")} onClick={handleCreate}>
          Create
        </button>
      </div>
      {(campaigns ?? []).length === 0 ? (
        <div style={styles.emptyState}>No campaigns yet.</div>
      ) : (
        (campaigns ?? []).map((c) => (
          <div key={c.id} style={styles.trendCard}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 500 }}>{c.name}</div>
              <div style={{ fontSize: 12, color: "#888" }}>
                {c.platforms.join(", ") || "All platforms"}
                {c.startDate && ` · ${new Date(c.startDate).toLocaleDateString()}`}
                {c.endDate && ` – ${new Date(c.endDate).toLocaleDateString()}`}
              </div>
            </div>
          </div>
        ))
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Marketing Hub (Root)
// ---------------------------------------------------------------------------

type Section = "pipeline" | "create" | "discover" | "monitor" | "campaigns";

export function MarketingHub() {
  const [section, setSection] = useState<Section>("pipeline");
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const { data: cards, refresh: refreshCards } = usePluginData<ContentCard[]>("pipeline");
  const updateStatus = usePluginAction("update-card-status");
  const hostCtx = useHostContext();
  const toast = usePluginToast();

  const selectedCard = useMemo(
    () => (cards ?? []).find((c) => c.id === selectedCardId) ?? null,
    [cards, selectedCardId],
  );

  const handleStatusChange = useCallback(
    async (cardId: string, status: CardStatus) => {
      try {
        await updateStatus({ companyId: hostCtx.companyId, cardId, status });
        toast({ title: `Card moved to ${status}`, tone: "success" });
        refreshCards();
      } catch (err: any) {
        toast({ title: err.message, tone: "error" });
      }
    },
    [updateStatus, hostCtx.companyId, toast, refreshCards],
  );

  const sections: { key: Section; label: string }[] = [
    { key: "pipeline", label: "Pipeline" },
    { key: "create", label: "Create" },
    { key: "discover", label: "Discover" },
    { key: "monitor", label: "Monitor" },
    { key: "campaigns", label: "Campaigns" },
  ];

  return (
    <div style={styles.hub}>
      {/* Sidebar */}
      <div style={styles.sidebar}>
        {sections.map((s) => (
          <div
            key={s.key}
            style={styles.sidebarItem(section === s.key)}
            onClick={() => {
              setSection(s.key);
              setSelectedCardId(null);
            }}
          >
            {s.label}
          </div>
        ))}
        <div style={styles.brandFooter}>
          <div style={{ fontWeight: 600, marginBottom: 4 }}>Brand Ambassador</div>
          <div>v0.1.0</div>
        </div>
      </div>

      {/* Canvas */}
      <div style={styles.canvas}>
        {section === "pipeline" && (
          <PipelineView
            cards={cards ?? []}
            selectedCardId={selectedCardId}
            onSelectCard={setSelectedCardId}
            onRefresh={refreshCards}
          />
        )}
        {section === "create" && <CreateView onRefresh={refreshCards} />}
        {section === "discover" && <DiscoverView onRefresh={refreshCards} />}
        {section === "monitor" && <MonitorView />}
        {section === "campaigns" && <CampaignsView onRefresh={refreshCards} />}
      </div>

      {/* Detail Panel */}
      {selectedCard && (
        <DetailPanel
          card={selectedCard}
          onStatusChange={handleStatusChange}
          onClose={() => setSelectedCardId(null)}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Settings Page
// ---------------------------------------------------------------------------

export function MarketingHubSettings() {
  const { data: settings, refresh } = usePluginData<BrandSettings>("brand-settings");
  const saveSettings = usePluginAction("save-brand-settings");
  const hostCtx = useHostContext();
  const toast = usePluginToast();
  const [tone, setTone] = useState("");
  const [audience, setAudience] = useState("");

  React.useEffect(() => {
    if (settings) {
      setTone(settings.tone);
      setAudience(settings.audience);
    }
  }, [settings]);

  const handleSave = useCallback(async () => {
    try {
      await saveSettings({ companyId: hostCtx.companyId, settings: { tone, audience } });
      toast({ title: "Brand settings saved", tone: "success" });
      refresh();
    } catch (err: any) {
      toast({ title: err.message, tone: "error" });
    }
  }, [tone, audience, saveSettings, hostCtx.companyId, toast, refresh]);

  return (
    <div style={{ padding: 24, maxWidth: 600 }}>
      <h2 style={styles.h2}>Brand Ambassador Settings</h2>
      <div style={{ ...styles.section, marginTop: 20 }}>
        <label style={styles.label}>Brand Tone</label>
        <input
          style={styles.input}
          value={tone}
          onChange={(e) => setTone(e.target.value)}
          placeholder="witty, professional, hype..."
        />
      </div>
      <div style={styles.section}>
        <label style={styles.label}>Target Audience</label>
        <input
          style={styles.input}
          value={audience}
          onChange={(e) => setAudience(e.target.value)}
          placeholder="crypto native, retail investors..."
        />
      </div>
      <button style={styles.btn("primary")} onClick={handleSave}>
        Save Settings
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sidebar Link
// ---------------------------------------------------------------------------

export function MarketingHubSidebarLink() {
  return (
    <div style={{ padding: "8px 12px", fontSize: 13, color: "#ccc" }}>
      Marketing Hub
    </div>
  );
}

// ---------------------------------------------------------------------------
// Dashboard Widget
// ---------------------------------------------------------------------------

export function MarketingHubDashboardWidget() {
  const { data: cards } = usePluginData<ContentCard[]>("pipeline");
  const counts = useMemo(() => {
    const c = cards ?? [];
    return {
      draft: c.filter((x) => x.status === "draft").length,
      review: c.filter((x) => x.status === "review").length,
      approved: c.filter((x) => x.status === "approved").length,
      published: c.filter((x) => x.status === "published").length,
      total: c.length,
    };
  }, [cards]);

  return (
    <div style={{ padding: 16 }}>
      <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Marketing Pipeline</div>
      <div style={{ display: "flex", gap: 12 }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 700, color: "#7c6ef0" }}>{counts.total}</div>
          <div style={{ fontSize: 11, color: "#888" }}>Total</div>
        </div>
        <div>
          <div style={{ fontSize: 20, fontWeight: 700, color: "#ff9800" }}>{counts.review}</div>
          <div style={{ fontSize: 11, color: "#888" }}>In Review</div>
        </div>
        <div>
          <div style={{ fontSize: 20, fontWeight: 700, color: "#4caf50" }}>
            {counts.published}
          </div>
          <div style={{ fontSize: 11, color: "#888" }}>Published</div>
        </div>
      </div>
    </div>
  );
}
