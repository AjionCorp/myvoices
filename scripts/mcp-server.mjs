#!/usr/bin/env node

/**
 * myVOice MCP Server
 *
 * Wraps the myVOice REST API as MCP tools for AI agents and humans.
 * Uses stdio transport — run with: node scripts/mcp-server.mjs
 *
 * Environment:
 *   MYVOICE_API_KEY  — your mv_... API key (required for authenticated access)
 *   MYVOICE_API_BASE — API base URL (default: https://myvoice.app)
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

// ─── Configuration ──────────────────────────────────────────────────────────

const API_KEY = process.env.MYVOICE_API_KEY || "";
const API_BASE = (process.env.MYVOICE_API_BASE || "https://myvoice.app").replace(
  /\/$/,
  ""
);

// ─── HTTP Helpers ───────────────────────────────────────────────────────────

async function apiGet(path, params = {}) {
  const url = new URL(`${API_BASE}${path}`);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, String(value));
    }
  }

  const headers = {};
  if (API_KEY) headers["x-api-key"] = API_KEY;

  const res = await fetch(url.toString(), { headers });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API error ${res.status}: ${text}`);
  }
  return res.json();
}

async function apiPost(path, body = {}) {
  const headers = { "Content-Type": "application/json" };
  if (API_KEY) headers["x-api-key"] = API_KEY;

  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API error ${res.status}: ${text}`);
  }
  return res.json();
}

function textResult(data) {
  return {
    content: [
      {
        type: "text",
        text: typeof data === "string" ? data : JSON.stringify(data, null, 2),
      },
    ],
  };
}

function errorResult(message) {
  return {
    content: [{ type: "text", text: `Error: ${message}` }],
    isError: true,
  };
}

// ─── Server Setup ───────────────────────────────────────────────────────────

const server = new McpServer({
  name: "myvoice",
  version: "1.0.0",
});

// ─── Read Tools ─────────────────────────────────────────────────────────────

server.tool(
  "list_topics",
  "List all topics on the myVOice platform with stats (video count, likes, dislikes, views), taxonomy info, moderator counts, and the top-scoring video per topic.",
  {},
  async () => {
    try {
      const data = await apiGet("/api/v1/topics");
      const topics = data.topics || [];
      const summary = topics.map((t) => ({
        id: t.id,
        slug: t.slug,
        title: t.title,
        category: t.category,
        videoCount: t.videoCount,
        totalLikes: t.totalLikes,
        totalViews: t.totalViews,
        taxonomyName: t.taxonomyName || null,
      }));
      return textResult({
        count: topics.length,
        topics: summary,
        topVideos: data.topVideos || {},
      });
    } catch (e) {
      return errorResult(e.message);
    }
  }
);

server.tool(
  "get_topic",
  "Get detailed information about a specific topic by its slug, including stats and the top 20 highest-scoring video blocks with thumbnails, likes, and view counts.",
  { slug: z.string().describe("The topic slug (e.g. 'music', 'gaming')") },
  async ({ slug }) => {
    try {
      const data = await apiGet(`/api/v1/topics/${encodeURIComponent(slug)}`);
      return textResult(data);
    } catch (e) {
      return errorResult(e.message);
    }
  }
);

server.tool(
  "get_topic_comments",
  "Get paginated comments for a topic. Optionally filter by a specific block ID. Returns comments sorted by newest first with user info, likes, and reply counts.",
  {
    slug: z.string().describe("The topic slug"),
    blockId: z
      .number()
      .optional()
      .describe("Filter comments to a specific block/video ID"),
    limit: z
      .number()
      .optional()
      .describe("Max comments to return (default 50, max 200)"),
    offset: z.number().optional().describe("Pagination offset (default 0)"),
  },
  async ({ slug, blockId, limit, offset }) => {
    try {
      const params = {};
      if (blockId !== undefined) params.blockId = blockId;
      if (limit !== undefined) params.limit = limit;
      if (offset !== undefined) params.offset = offset;
      const data = await apiGet(
        `/api/v1/topics/${encodeURIComponent(slug)}/comments`,
        params
      );
      return textResult(data);
    } catch (e) {
      return errorResult(e.message);
    }
  }
);

server.tool(
  "compare_topics",
  "Compare 2 to 4 topics side by side. Returns each topic's stats and their ranked video blocks for comparison. Useful for analyzing which topics are more active or popular.",
  {
    slugs: z
      .array(z.string())
      .min(2)
      .max(4)
      .describe("Array of 2-4 topic slugs to compare"),
  },
  async ({ slugs }) => {
    try {
      const data = await apiGet("/api/v1/compare", {
        slugs: slugs.join(","),
      });
      return textResult(data);
    } catch (e) {
      return errorResult(e.message);
    }
  }
);

server.tool(
  "get_user_profile",
  "Get a user's public profile by username. Returns display name, bio, location, website, social links (X, YouTube, TikTok, Instagram), and follower/following counts. Does NOT include email or private data.",
  {
    username: z.string().describe("The username to look up (without @)"),
  },
  async ({ username }) => {
    try {
      const data = await apiGet(
        `/api/v1/users/${encodeURIComponent(username)}`
      );
      return textResult(data);
    } catch (e) {
      return errorResult(e.message);
    }
  }
);

server.tool(
  "get_grid_data",
  "Get video blocks from the myVOice canvas grid. Optionally filter by topic and/or viewport coordinates (minX, maxX, minY, maxY). Each block contains a video ID, platform, thumbnail URL, likes, dislikes, and owner info.",
  {
    topicId: z.number().optional().describe("Filter to a specific topic ID"),
    minX: z.number().optional().describe("Left edge of viewport"),
    maxX: z.number().optional().describe("Right edge of viewport"),
    minY: z.number().optional().describe("Top edge of viewport"),
    maxY: z.number().optional().describe("Bottom edge of viewport"),
  },
  async ({ topicId, minX, maxX, minY, maxY }) => {
    try {
      const params = {};
      if (topicId !== undefined) params.topicId = topicId;
      if (minX !== undefined) params.minX = minX;
      if (maxX !== undefined) params.maxX = maxX;
      if (minY !== undefined) params.minY = minY;
      if (maxY !== undefined) params.maxY = maxY;
      const data = await apiGet("/api/v1/data", params);
      return textResult({
        blockCount: data.blocks?.length || 0,
        commentCount: data.comments?.length || 0,
        blocks: data.blocks || [],
        comments: data.comments || [],
      });
    } catch (e) {
      return errorResult(e.message);
    }
  }
);

server.tool(
  "get_stats",
  "Get platform-wide statistics for myVOice: total number of topics, claimed video blocks, registered users, and comments.",
  {},
  async () => {
    try {
      const data = await apiGet("/api/v1/stats");
      return textResult(data);
    } catch (e) {
      return errorResult(e.message);
    }
  }
);

server.tool(
  "resolve_video",
  "Resolve a YouTube, TikTok, or BiliBili video URL or ID to its metadata (title, thumbnail, duration, view count, etc.). Accepts full URLs or bare video IDs.",
  {
    input: z
      .string()
      .describe(
        "A video URL (e.g. https://youtube.com/watch?v=...) or bare video ID"
      ),
  },
  async ({ input }) => {
    try {
      const data = await apiPost("/api/v1/video-meta", { input });
      return textResult(data);
    } catch (e) {
      return errorResult(e.message);
    }
  }
);

server.tool(
  "search",
  "Search across topics and users on the myVOice platform. Returns matching topics (with stats) and users (with display names). Minimum 2 characters.",
  {
    query: z.string().min(2).describe("Search query (min 2 characters)"),
    limit: z
      .number()
      .optional()
      .describe("Max results per category (default 20, max 50)"),
  },
  async ({ query, limit }) => {
    try {
      const params = { q: query };
      if (limit !== undefined) params.limit = limit;
      const data = await apiGet("/api/v1/search", params);
      return textResult(data);
    } catch (e) {
      return errorResult(e.message);
    }
  }
);

// ─── Action Tools ───────────────────────────────────────────────────────────

server.tool(
  "register_api_key",
  "Register for a new myVOice API key. No existing account needed. Returns the API key (shown only once) — save it securely. The key gives 1,000 free requests/day.",
  {
    name: z
      .string()
      .describe("Your name or application name (1-100 characters)"),
    email: z.string().describe("Your email address"),
  },
  async ({ name, email }) => {
    try {
      const data = await apiPost("/api/v1/developers/register", {
        name,
        email,
      });
      return textResult({
        apiKey: data.apiKey,
        keyPrefix: data.keyPrefix,
        message: data.message,
        rateLimit: data.rateLimit,
      });
    } catch (e) {
      return errorResult(e.message);
    }
  }
);

server.tool(
  "get_api_key_info",
  "Check the status of the currently configured API key — credits remaining, total requests made, daily rate limit remaining, and recent usage breakdown by endpoint.",
  {},
  async () => {
    if (!API_KEY) {
      return errorResult(
        "No API key configured. Set MYVOICE_API_KEY environment variable."
      );
    }
    try {
      const data = await apiGet("/api/v1/developers/me");
      return textResult(data);
    } catch (e) {
      return errorResult(e.message);
    }
  }
);

// ─── Start Server ───────────────────────────────────────────────────────────

const transport = new StdioServerTransport();
await server.connect(transport);
