import { NextRequest, NextResponse } from "next/server";
import { runSql, rowToObject } from "@/lib/spacetimedb/http-sql";

const TOPIC_COLS = [
  "id", "slug", "title", "description", "category",
  "video_count", "total_likes", "total_dislikes", "total_views", "taxonomy_node_id",
];
const TAXONOMY_COLS = ["id", "name", "path"];
const BLOCK_COLS = [
  "id", "topic_id", "video_id", "platform",
  "thumbnail_url", "likes", "dislikes", "yt_views", "yt_likes", "owner_name",
];

/** Only allow valid slug characters to prevent SQL injection. */
const SLUG_RE = /^[a-z0-9-]{1,80}$/;

export interface CompareBlock {
  id: number;
  videoId: string;
  platform: string;
  thumbnailUrl: string | null;
  likes: number;
  dislikes: number;
  ytViews: number;
  ytLikes: number;
  ownerName: string | null;
  score: number;
}

export interface CompareTopic {
  id: number;
  slug: string;
  title: string;
  description: string;
  category: string;
  videoCount: number;
  totalLikes: number;
  totalDislikes: number;
  totalViews: number;
  taxonomyPath: string;
  taxonomyName: string;
  /** Internal — used during enrichment, not sent to client. */
  taxonomyNodeId?: number | null;
}

export interface ComparePanel {
  topic: CompareTopic;
  blocks: CompareBlock[];
}

export interface CompareResponse {
  panels: ComparePanel[];
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const rawSlugs = searchParams.get("slugs") ?? "";
  const slugs = rawSlugs.split(",").map((s) => s.trim()).filter(Boolean);

  if (slugs.length < 2 || slugs.length > 4) {
    return NextResponse.json({ error: "Provide between 2 and 4 topic slugs" }, { status: 400 });
  }

  for (const s of slugs) {
    if (!SLUG_RE.test(s)) {
      return NextResponse.json({ error: `Invalid slug: "${s}"` }, { status: 400 });
    }
  }

  // SpacetimeDB does not support IN (...) — build OR chains instead
  const slugOrClause = slugs.map((s) => `slug = '${s}'`).join(" OR ");

  try {
    // 1. Fetch matching topics
    const topicResults = await runSql(
      `SELECT id, slug, title, description, category, video_count, total_likes, total_dislikes, total_views, taxonomy_node_id FROM topic WHERE ${slugOrClause}`
    );

    const topicsById = new Map<number, CompareTopic>();
    const topicIdBySlug = new Map<string, number>();
    const topicRes = topicResults[0];

    if (topicRes) {
      for (const row of topicRes.rows) {
        const obj = rowToObject(row, topicRes.schema, TOPIC_COLS);
        const t: CompareTopic = {
          id: Number(obj.id),
          slug: String(obj.slug ?? ""),
          title: String(obj.title ?? ""),
          description: String(obj.description ?? ""),
          category: String(obj.category ?? ""),
          videoCount: Number(obj.video_count ?? 0),
          totalLikes: Number(obj.total_likes ?? 0),
          totalDislikes: Number(obj.total_dislikes ?? 0),
          totalViews: Number(obj.total_views ?? 0),
          taxonomyPath: "",
          taxonomyName: "",
          taxonomyNodeId: obj.taxonomy_node_id ? Number(obj.taxonomy_node_id) : null,
        };
        topicsById.set(t.id, t);
        topicIdBySlug.set(t.slug, t.id);
      }
    }

    if (topicsById.size === 0) {
      return NextResponse.json({ panels: [] });
    }

    // 2. Enrich topics with taxonomy info
    try {
      const taxResults = await runSql("SELECT id, name, path FROM topic_taxonomy_node");
      const taxRes = taxResults[0];
      if (taxRes) {
        const taxById = new Map<number, { name: string; path: string }>();
        for (const row of taxRes.rows) {
          const obj = rowToObject(row, taxRes.schema, TAXONOMY_COLS);
          taxById.set(Number(obj.id), { name: String(obj.name ?? ""), path: String(obj.path ?? "") });
        }
        for (const t of topicsById.values()) {
          const nodeId = t.taxonomyNodeId;
          if (nodeId && taxById.has(nodeId)) {
            const node = taxById.get(nodeId)!;
            t.taxonomyPath = node.path;
            t.taxonomyName = node.name;
          }
        }
      }
    } catch {
      // Non-fatal — taxonomy enrichment is best-effort
    }

    // 3. Fetch claimed blocks for these topics
    // SpacetimeDB does not support IN (...) — build OR chains instead
    const topicIdOrClause = [...topicsById.keys()]
      .map((id) => `topic_id = ${id}`)
      .join(" OR ");
    const blockResults = await runSql(
      `SELECT id, topic_id, video_id, platform, thumbnail_url, likes, dislikes, yt_views, yt_likes, owner_name FROM block WHERE (${topicIdOrClause}) AND status = 'claimed' AND video_id != '' AND platform != ''`
    );

    const blocksByTopic = new Map<number, CompareBlock[]>();
    const blockRes = blockResults[0];

    if (blockRes) {
      for (const row of blockRes.rows) {
        const obj = rowToObject(row, blockRes.schema, BLOCK_COLS);
        const topicId = Number(obj.topic_id);
        const videoId = String(obj.video_id ?? "");
        const platform = String(obj.platform ?? "");
        if (!videoId || !platform) continue;

        const ytViews = Number(obj.yt_views ?? 0);
        const ytLikes = Number(obj.yt_likes ?? 0);
        const likes = Number(obj.likes ?? 0);
        const dislikes = Number(obj.dislikes ?? 0);
        const score = Math.max(ytViews, ytLikes) + (likes - dislikes);

        const block: CompareBlock = {
          id: Number(obj.id),
          videoId,
          platform,
          thumbnailUrl: obj.thumbnail_url ? String(obj.thumbnail_url) : null,
          likes,
          dislikes,
          ytViews,
          ytLikes,
          ownerName: obj.owner_name ? String(obj.owner_name) : null,
          score,
        };

        if (!blocksByTopic.has(topicId)) blocksByTopic.set(topicId, []);
        blocksByTopic.get(topicId)!.push(block);
      }
    }

    // Sort by score descending, cap at top 20 per topic
    for (const [topicId, blocks] of blocksByTopic) {
      blocks.sort((a, b) => b.score - a.score);
      blocksByTopic.set(topicId, blocks.slice(0, 20));
    }

    // Build panels in the order the slugs were requested
    const panels: ComparePanel[] = [];
    for (const slug of slugs) {
      const topicId = topicIdBySlug.get(slug);
      if (topicId === undefined) continue;
      const topic = topicsById.get(topicId);
      if (!topic) continue;
      panels.push({ topic, blocks: blocksByTopic.get(topicId) ?? [] });
    }

    return NextResponse.json({ panels } satisfies CompareResponse);
  } catch (err) {
    console.error("[api/v1/compare]", err);
    return NextResponse.json({ error: "Failed to fetch comparison data" }, { status: 500 });
  }
}
