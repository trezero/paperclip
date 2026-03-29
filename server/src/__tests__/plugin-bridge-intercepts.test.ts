/**
 * Tests for host-level bridge intercepts on plugin action/data routes.
 *
 * These intercepts route "execute-tool" actions through the tool dispatcher
 * (same path as agent tool calls) and serve "tool-schemas" data directly
 * from the registry without a worker round-trip.
 */

import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { errorHandler } from "../middleware/index.js";

// ---------------------------------------------------------------------------
// Mocks — hoisted so vi.mock sees them
// ---------------------------------------------------------------------------

const pluginId = "plg-11111111";
const pluginKey = "brandambassador.marketing";
const companyId = "co-22222222";

const fakePlugin = {
  id: pluginId,
  pluginKey,
  displayName: "Brand Ambassador Marketing",
  status: "ready" as const,
  version: "0.1.0",
  packageName: "@brandambassador/paperclip-plugin-marketing",
};

const mockRegistry = vi.hoisted(() => ({
  getById: vi.fn(),
  getByKey: vi.fn(),
  list: vi.fn(),
}));

vi.mock("../services/plugin-registry.js", () => ({
  pluginRegistryService: () => mockRegistry,
}));

vi.mock("../services/plugin-lifecycle.js", () => ({
  pluginLifecycleManager: () => ({}),
}));

vi.mock("../services/plugin-loader.js", () => ({
  pluginLoader: () => ({}),
  getPluginUiContributionMetadata: () => null,
}));

vi.mock("../services/activity-log.js", () => ({
  logActivity: vi.fn(),
}));

vi.mock("../services/live-events.js", () => ({
  publishGlobalLiveEvent: vi.fn(),
}));

// Import after mocks are set up
const { pluginRoutes } = await import("../routes/plugins.js");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createApp(opts: {
  toolDispatcher?: {
    getTool: ReturnType<typeof vi.fn>;
    executeTool: ReturnType<typeof vi.fn>;
    listToolsForAgent: ReturnType<typeof vi.fn>;
  };
  workerManager?: {
    call: ReturnType<typeof vi.fn>;
  };
}) {
  const app = express();
  app.use(express.json());

  // Inject board actor
  app.use((req, _res, next) => {
    (req as any).actor = {
      type: "board",
      userId: "user-1",
      source: "local_implicit",
      isInstanceAdmin: true,
      companyIds: [companyId],
    };
    next();
  });

  const toolDeps = opts.toolDispatcher
    ? { toolDispatcher: opts.toolDispatcher as any }
    : undefined;

  const bridgeDeps = opts.workerManager
    ? { workerManager: opts.workerManager as any }
    : undefined;

  app.use(
    "/api",
    pluginRoutes(
      {} as any, // db stub
      (() => ({})) as any, // loader stub
      undefined, // jobDeps
      undefined, // webhookDeps
      toolDeps,
      bridgeDeps,
    ),
  );

  app.use(errorHandler);
  return app;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("plugin bridge intercepts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRegistry.getById.mockResolvedValue(fakePlugin);
    mockRegistry.getByKey.mockResolvedValue(fakePlugin);
  });

  // =========================================================================
  // execute-tool intercept
  // =========================================================================

  describe("execute-tool action intercept", () => {
    it("routes execute-tool through toolDispatcher on body-keyed route", async () => {
      const mockResult = { pluginId, toolName: "generate-caption", result: { content: [{ type: "text", text: "Hello!" }] } };
      const toolDispatcher = {
        getTool: vi.fn().mockReturnValue({ namespacedName: `${pluginKey}:generate-caption` }),
        executeTool: vi.fn().mockResolvedValue(mockResult),
        listToolsForAgent: vi.fn(),
      };
      const workerManager = { call: vi.fn() };
      const app = createApp({ toolDispatcher, workerManager });

      const res = await request(app)
        .post(`/api/plugins/${pluginId}/bridge/action`)
        .send({
          key: "execute-tool",
          params: {
            toolName: "generate-caption",
            parameters: { topic: "ETH staking", platform: "twitter" },
            runContext: { companyId },
          },
        });

      expect(res.status).toBe(200);
      expect(res.body.data).toEqual(mockResult);
      expect(toolDispatcher.getTool).toHaveBeenCalledWith(`${pluginKey}:generate-caption`);
      expect(toolDispatcher.executeTool).toHaveBeenCalledWith(
        `${pluginKey}:generate-caption`,
        { topic: "ETH staking", platform: "twitter" },
        expect.objectContaining({ companyId }),
      );
      // Worker should NOT have been called
      expect(workerManager.call).not.toHaveBeenCalled();
    });

    it("routes execute-tool through toolDispatcher on URL-keyed route", async () => {
      const mockResult = { pluginId, toolName: "moderate-content", result: { content: [{ type: "text", text: "OK" }] } };
      const toolDispatcher = {
        getTool: vi.fn().mockReturnValue({ namespacedName: `${pluginKey}:moderate-content` }),
        executeTool: vi.fn().mockResolvedValue(mockResult),
        listToolsForAgent: vi.fn(),
      };
      const workerManager = { call: vi.fn() };
      const app = createApp({ toolDispatcher, workerManager });

      const res = await request(app)
        .post(`/api/plugins/${pluginId}/actions/execute-tool`)
        .send({
          params: {
            toolName: "moderate-content",
            parameters: { text: "test content" },
            runContext: { companyId },
          },
        });

      expect(res.status).toBe(200);
      expect(res.body.data).toEqual(mockResult);
      expect(toolDispatcher.executeTool).toHaveBeenCalled();
      expect(workerManager.call).not.toHaveBeenCalled();
    });

    it("returns 400 when toolName is missing", async () => {
      const toolDispatcher = {
        getTool: vi.fn(),
        executeTool: vi.fn(),
        listToolsForAgent: vi.fn(),
      };
      const workerManager = { call: vi.fn() };
      const app = createApp({ toolDispatcher, workerManager });

      const res = await request(app)
        .post(`/api/plugins/${pluginId}/bridge/action`)
        .send({
          key: "execute-tool",
          params: { parameters: {} },
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain("toolName");
    });

    it("returns 404 when tool is not registered", async () => {
      const toolDispatcher = {
        getTool: vi.fn().mockReturnValue(null),
        executeTool: vi.fn(),
        listToolsForAgent: vi.fn(),
      };
      const workerManager = { call: vi.fn() };
      const app = createApp({ toolDispatcher, workerManager });

      const res = await request(app)
        .post(`/api/plugins/${pluginId}/bridge/action`)
        .send({
          key: "execute-tool",
          params: { toolName: "nonexistent-tool", runContext: { companyId } },
        });

      expect(res.status).toBe(404);
      expect(res.body.error).toContain("nonexistent-tool");
    });

    it("preserves already-namespaced tool names", async () => {
      const toolDispatcher = {
        getTool: vi.fn().mockReturnValue({ namespacedName: `${pluginKey}:generate-caption` }),
        executeTool: vi.fn().mockResolvedValue({ result: {} }),
        listToolsForAgent: vi.fn(),
      };
      const workerManager = { call: vi.fn() };
      const app = createApp({ toolDispatcher, workerManager });

      await request(app)
        .post(`/api/plugins/${pluginId}/bridge/action`)
        .send({
          key: "execute-tool",
          params: {
            toolName: `${pluginKey}:generate-caption`,
            parameters: {},
            runContext: { companyId },
          },
        });

      // Should NOT double-namespace
      expect(toolDispatcher.getTool).toHaveBeenCalledWith(`${pluginKey}:generate-caption`);
    });

    it("forwards non-execute-tool actions to worker as before", async () => {
      const toolDispatcher = {
        getTool: vi.fn(),
        executeTool: vi.fn(),
        listToolsForAgent: vi.fn(),
      };
      const workerManager = { call: vi.fn().mockResolvedValue({ ok: true }) };
      const app = createApp({ toolDispatcher, workerManager });

      const res = await request(app)
        .post(`/api/plugins/${pluginId}/bridge/action`)
        .send({
          key: "save-brand-settings",
          params: { name: "TestBrand" },
        });

      expect(res.status).toBe(200);
      expect(workerManager.call).toHaveBeenCalledWith(
        pluginId,
        "performAction",
        expect.objectContaining({ key: "save-brand-settings" }),
      );
      // Tool dispatcher should NOT have been called
      expect(toolDispatcher.executeTool).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  // tool-schemas data intercept
  // =========================================================================

  describe("tool-schemas data intercept", () => {
    it("serves tool schemas from registry without worker call", async () => {
      const toolDispatcher = {
        getTool: vi.fn(),
        executeTool: vi.fn(),
        listToolsForAgent: vi.fn().mockReturnValue([
          {
            name: `${pluginKey}:generate-caption`,
            displayName: "Generate Caption",
            description: "Generates captions",
            parametersSchema: { type: "object", properties: { topic: { type: "string" } } },
            pluginId,
          },
          {
            name: `${pluginKey}:moderate-content`,
            displayName: "Moderate Content",
            description: "Moderates content",
            parametersSchema: { type: "object", properties: { text: { type: "string" } } },
            pluginId,
          },
        ]),
      };
      const workerManager = { call: vi.fn() };
      const app = createApp({ toolDispatcher, workerManager });

      const res = await request(app)
        .post(`/api/plugins/${pluginId}/data/tool-schemas`)
        .send({});

      expect(res.status).toBe(200);
      expect(res.body.data.tools).toHaveLength(2);
      expect(res.body.data.tools[0]).toEqual({
        name: "generate-caption",
        displayName: "Generate Caption",
        description: "Generates captions",
        parametersSchema: { type: "object", properties: { topic: { type: "string" } } },
      });
      // Worker should NOT have been called
      expect(workerManager.call).not.toHaveBeenCalled();
      // Should filter by pluginId
      expect(toolDispatcher.listToolsForAgent).toHaveBeenCalledWith({ pluginId });
    });

    it("forwards non-tool-schemas data requests to worker", async () => {
      const toolDispatcher = {
        getTool: vi.fn(),
        executeTool: vi.fn(),
        listToolsForAgent: vi.fn(),
      };
      const workerManager = { call: vi.fn().mockResolvedValue({ trends: [] }) };
      const app = createApp({ toolDispatcher, workerManager });

      const res = await request(app)
        .post(`/api/plugins/${pluginId}/data/trends`)
        .send({ params: { companyId } });

      expect(res.status).toBe(200);
      expect(workerManager.call).toHaveBeenCalledWith(
        pluginId,
        "getData",
        expect.objectContaining({ key: "trends" }),
      );
      expect(toolDispatcher.listToolsForAgent).not.toHaveBeenCalled();
    });
  });
});
