/**
 * API key generation, validation, rate limiting, and usage tracking.
 * Server-side only — used by Next.js API routes.
 */

import { createHash, randomBytes } from "crypto";
import { runSql, rowToObject } from "@/lib/spacetimedb/http-sql";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface ApiKeyRecord {
  id: number;
  keyHash: string;
  keyPrefix: string;
  name: string;
  email: string;
  credits: number;
  totalRequests: number;
  isActive: boolean;
  createdAt: number;
  lastUsedAt: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  limit: number;
  resetAt: number; // Unix seconds
  creditsUsed: boolean;
}

// ─── Constants ──────────────────────────────────────────────────────────────

export const FREE_DAILY_LIMIT = 1000;

export const API_CREDIT_TIERS = [
  { id: "starter", credits: 5_000, priceCents: 500, label: "5K API requests" },
  { id: "growth", credits: 50_000, priceCents: 2500, label: "50K API requests" },
  { id: "scale", credits: 500_000, priceCents: 10000, label: "500K API requests" },
] as const;

// ─── Key Generation ─────────────────────────────────────────────────────────

export function generateApiKey(): string {
  return "mv_" + randomBytes(16).toString("hex"); // mv_ + 32 hex chars = 35 chars
}

export function hashApiKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

export function getKeyPrefix(key: string): string {
  // "mv_" + first 8 chars of the random part
  return key.slice(0, 11) + "...";
}

// ─── Key Validation (with cache) ────────────────────────────────────────────

const API_KEY_COLUMNS = [
  "id", "key_hash", "key_prefix", "name", "email", "credits",
  "total_requests", "is_active", "created_at", "last_used_at",
];

interface CacheEntry {
  record: ApiKeyRecord;
  cachedAt: number;
}

const keyCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

function mapApiKeyRow(row: Record<string, unknown>): ApiKeyRecord {
  return {
    id: Number(row.id ?? 0),
    keyHash: String(row.key_hash ?? row.keyHash ?? ""),
    keyPrefix: String(row.key_prefix ?? row.keyPrefix ?? ""),
    name: String(row.name ?? ""),
    email: String(row.email ?? ""),
    credits: Number(row.credits ?? 0),
    totalRequests: Number(row.total_requests ?? row.totalRequests ?? 0),
    isActive:
      row.is_active === true || row.is_active === 1 || row.is_active === "true" ||
      row.isActive === true || row.isActive === 1 || row.isActive === "true",
    createdAt: Number(row.created_at ?? row.createdAt ?? 0),
    lastUsedAt: Number(row.last_used_at ?? row.lastUsedAt ?? 0),
  };
}

export async function validateApiKey(rawKey: string): Promise<ApiKeyRecord | null> {
  if (!rawKey || !rawKey.startsWith("mv_")) return null;

  const hash = hashApiKey(rawKey);

  // Check cache
  const cached = keyCache.get(hash);
  if (cached && Date.now() - cached.cachedAt < CACHE_TTL_MS) {
    return cached.record.isActive ? cached.record : null;
  }

  // Query SpacetimeDB
  try {
    const results = await runSql(
      `SELECT * FROM api_key WHERE key_hash = '${hash}'`
    );
    const res = results[0];
    if (!res || res.rows.length === 0) return null;

    const obj = rowToObject(res.rows[0], res.schema, API_KEY_COLUMNS);
    const record = mapApiKeyRow(obj);

    // Cache it
    keyCache.set(hash, { record, cachedAt: Date.now() });

    return record.isActive ? record : null;
  } catch (err) {
    console.error("[api-keys] validateApiKey failed:", err);
    return null;
  }
}

/** Invalidate cache for a specific key hash */
export function invalidateKeyCache(keyHash: string): void {
  keyCache.delete(keyHash);
}

// ─── Rate Limiting (in-memory) ──────────────────────────────────────────────

interface RateBucket {
  count: number;
  resetAt: number; // Unix ms
}

const rateBuckets = new Map<number, RateBucket>();

function getDayResetTime(): number {
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  tomorrow.setUTCHours(0, 0, 0, 0);
  return tomorrow.getTime();
}

/**
 * Read-only version of checkRateLimit — returns current quota state without
 * incrementing the request counter. Use for info-only endpoints (e.g. /me).
 */
export function peekRateLimit(keyId: number, credits: number): RateLimitResult {
  const now = Date.now();
  const bucket = rateBuckets.get(keyId);

  if (!bucket || now >= bucket.resetAt) {
    const totalAllowed = FREE_DAILY_LIMIT + credits;
    return {
      allowed: true,
      remaining: totalAllowed,
      limit: totalAllowed,
      resetAt: Math.floor(getDayResetTime() / 1000),
      creditsUsed: false,
    };
  }

  const totalAllowed = FREE_DAILY_LIMIT + credits;
  const remaining = Math.max(0, totalAllowed - bucket.count);
  const creditsUsed = bucket.count >= FREE_DAILY_LIMIT;

  return {
    allowed: bucket.count < totalAllowed,
    remaining,
    limit: totalAllowed,
    resetAt: Math.floor(bucket.resetAt / 1000),
    creditsUsed,
  };
}

export function checkRateLimit(keyId: number, credits: number): RateLimitResult {
  const now = Date.now();
  let bucket = rateBuckets.get(keyId);

  // Reset if expired
  if (!bucket || now >= bucket.resetAt) {
    bucket = { count: 0, resetAt: getDayResetTime() };
    rateBuckets.set(keyId, bucket);
  }

  const totalAllowed = FREE_DAILY_LIMIT + credits;
  const creditsUsed = bucket.count >= FREE_DAILY_LIMIT;

  if (bucket.count >= totalAllowed) {
    return {
      allowed: false,
      remaining: 0,
      limit: totalAllowed,
      resetAt: Math.floor(bucket.resetAt / 1000),
      creditsUsed,
    };
  }

  // Increment
  bucket.count++;

  return {
    allowed: true,
    remaining: Math.max(0, totalAllowed - bucket.count),
    limit: totalAllowed,
    resetAt: Math.floor(bucket.resetAt / 1000),
    creditsUsed: bucket.count > FREE_DAILY_LIMIT,
  };
}

// ─── Usage Tracking (batched) ───────────────────────────────────────────────

interface UsageBatch {
  keyId: number;
  endpoint: string;
  day: number; // YYYYMMDD
  count: number;
  creditsToDeduct: number;
}

const usageBatches = new Map<string, UsageBatch>();
let flushTimer: ReturnType<typeof setTimeout> | null = null;
const FLUSH_INTERVAL_MS = 30_000; // 30 seconds
const FLUSH_THRESHOLD = 50; // flush after 50 accumulated requests

function getTodayBucket(): number {
  const d = new Date();
  return d.getUTCFullYear() * 10000 + (d.getUTCMonth() + 1) * 100 + d.getUTCDate();
}

export function trackUsage(keyId: number, endpoint: string, usedCredit: boolean): void {
  const day = getTodayBucket();
  const batchKey = `${keyId}:${endpoint}:${day}`;

  const existing = usageBatches.get(batchKey);
  if (existing) {
    existing.count++;
    if (usedCredit) existing.creditsToDeduct++;
  } else {
    usageBatches.set(batchKey, {
      keyId,
      endpoint,
      day,
      count: 1,
      creditsToDeduct: usedCredit ? 1 : 0,
    });
  }

  // Auto-flush if threshold reached
  let totalPending = 0;
  for (const b of usageBatches.values()) totalPending += b.count;
  if (totalPending >= FLUSH_THRESHOLD) {
    if (flushTimer) { clearTimeout(flushTimer); flushTimer = null; }
    void flushUsage();
    return;
  }

  // Schedule flush
  if (!flushTimer) {
    flushTimer = setTimeout(() => {
      flushTimer = null;
      void flushUsage();
    }, FLUSH_INTERVAL_MS);
  }
}

const SPACETIMEDB_URI =
  (process.env.NEXT_PUBLIC_SPACETIMEDB_URI || "wss://maincloud.spacetimedb.com")
    .replace(/^wss:/, "https:")
    .replace(/^ws:/, "http:");
const SPACETIMEDB_MODULE = process.env.NEXT_PUBLIC_SPACETIMEDB_MODULE || "myvoice";
const SPACETIMEDB_SERVER_TOKEN = process.env.SPACETIMEDB_SERVER_TOKEN ?? "";

async function callReducer(reducerName: string, args: unknown[]): Promise<void> {
  if (!SPACETIMEDB_SERVER_TOKEN) {
    throw new Error(`[api-keys] SPACETIMEDB_SERVER_TOKEN not set — cannot call ${reducerName}`);
  }
  const url = `${SPACETIMEDB_URI}/v1/database/${SPACETIMEDB_MODULE}/call/${reducerName}`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${SPACETIMEDB_SERVER_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(args),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`[api-keys] ${reducerName} failed: ${res.status} ${text}`);
  }
}

export async function flushUsage(): Promise<void> {
  if (usageBatches.size === 0) return;

  // Snapshot and clear — new trackUsage calls during this flush will create fresh entries.
  const batches = [...usageBatches.entries()];
  usageBatches.clear();

  for (const [batchKey, batch] of batches) {
    try {
      await callReducer("server_record_api_usage", [
        batch.keyId,
        batch.endpoint,
        batch.day,
        batch.count,
        batch.creditsToDeduct,
      ]);
    } catch (err) {
      console.error("[api-keys] flushUsage error, re-queuing batch:", err);
      // Merge failed batch back so it isn't lost.
      const existing = usageBatches.get(batchKey);
      if (existing) {
        existing.count += batch.count;
        existing.creditsToDeduct += batch.creditsToDeduct;
      } else {
        usageBatches.set(batchKey, batch);
      }
    }
  }

  // Invalidate cached key records since credits may have changed
  for (const [, batch] of batches) {
    if (batch.creditsToDeduct > 0) {
      for (const [hash, entry] of keyCache.entries()) {
        if (entry.record.id === batch.keyId) {
          keyCache.delete(hash);
          break;
        }
      }
    }
  }
}

export { callReducer as callSpacetimeReducer };
