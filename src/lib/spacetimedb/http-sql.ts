/**
 * Server-side SpacetimeDB HTTP SQL client for anonymous read access.
 * Used when users are not authenticated (no WebSocket connection).
 *
 * Token source (in order):
 * 1. SPACETIMEDB_SERVER_TOKEN env var (from SpacetimeDB dashboard)
 * 2. POST /v1/identity (creates ephemeral identity; may not have DB access if anonymous sign-in is disabled)
 */

const HTTP_BASE =
  (process.env.NEXT_PUBLIC_SPACETIMEDB_URI || "wss://maincloud.spacetimedb.com")
    .replace(/^wss:/, "https:")
    .replace(/^ws:/, "http:");
const MODULE = process.env.NEXT_PUBLIC_SPACETIMEDB_MODULE || "myvoice";

let cachedToken: string | null = null;

async function getToken(): Promise<string> {
  const serverToken = process.env.SPACETIMEDB_SERVER_TOKEN;
  if (serverToken) return serverToken;

  if (cachedToken) return cachedToken;

  const res = await fetch(`${HTTP_BASE}/v1/identity`, { method: "POST" });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`SpacetimeDB identity failed: ${res.status} ${text}`);
  }
  const data = (await res.json()) as { identity: string; token: string };
  cachedToken = data.token;
  return cachedToken;
}

export interface SqlResult {
  schema: { Product?: { elements: Array<{ name?: { some?: string }; algebraic_type?: unknown }> } };
  rows: unknown[][];
}

/** Run SQL against the database. Returns array of statement results. */
export async function runSql(queries: string): Promise<SqlResult[]> {
  const token = await getToken();
  const res = await fetch(`${HTTP_BASE}/v1/database/${MODULE}/sql`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "text/plain",
    },
    body: queries,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`SpacetimeDB SQL failed: ${res.status} ${text}`);
  }

  const results = (await res.json()) as SqlResult[];
  return results;
}

/** Block table column order for positional fallback when schema names are missing. */
export const BLOCK_COLUMNS = [
  "id", "x", "y", "video_id", "platform", "owner_identity", "owner_name",
  "likes", "dislikes", "status", "ad_image_url", "ad_link_url", "claimed_at",
];

/** Comment table column order for positional fallback. */
export const COMMENT_COLUMNS = [
  "id", "block_id", "user_identity", "user_name", "text", "created_at",
];

/** Map a SQL row (array or object) to a plain object using schema element names. */
export function rowToObject(
  row: unknown,
  schema: SqlResult["schema"],
  columnOrder?: string[]
): Record<string, unknown> {
  const elements = schema?.Product?.elements ?? [];
  const names = elements.map((e) => e?.name?.some ?? null);
  const fallbackCols = columnOrder?.length ? columnOrder : BLOCK_COLUMNS;

  if (Array.isArray(row)) {
    const arr = row as unknown[];
    const obj: Record<string, unknown> = {};
    for (let i = 0; i < arr.length; i++) {
      const name = names[i] ?? fallbackCols[i];
      if (name) obj[name] = arr[i];
    }
    return obj;
  }

  if (typeof row === "object" && row !== null) {
    return row as Record<string, unknown>;
  }

  return {};
}
