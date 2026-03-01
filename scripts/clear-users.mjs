#!/usr/bin/env node
/**
 * Clears all user_profile and clerk_identity_map rows from SpacetimeDB.
 *
 * Usage:
 *   SPACETIMEDB_SERVER_TOKEN=<token> node scripts/clear-users.mjs
 *
 * Or set it in .env.local and run:
 *   node -e "require('fs').readFileSync('.env.local','utf8').split('\n').forEach(l=>{const[k,...v]=l.split('=');if(k&&v.length)process.env[k.trim()]=v.join('=').trim()})" && node scripts/clear-users.mjs
 */

import { readFileSync } from "fs";

// Load .env.local if no token in environment
if (!process.env.SPACETIMEDB_SERVER_TOKEN) {
  try {
    const env = readFileSync(".env.local", "utf8");
    for (const line of env.split("\n")) {
      const [key, ...rest] = line.split("=");
      if (key && rest.length) process.env[key.trim()] = rest.join("=").trim();
    }
  } catch { /* no .env.local */ }
}

const TOKEN = process.env.SPACETIMEDB_SERVER_TOKEN;
const URI = (process.env.NEXT_PUBLIC_SPACETIMEDB_URI || "wss://maincloud.spacetimedb.com")
  .replace(/^wss:/, "https:")
  .replace(/^ws:/, "http:");
const MODULE = process.env.NEXT_PUBLIC_SPACETIMEDB_MODULE || "myvoice";

if (!TOKEN) {
  console.error("❌ SPACETIMEDB_SERVER_TOKEN is not set.");
  process.exit(1);
}

console.log(`Clearing all users from ${MODULE} on ${URI}...`);

const res = await fetch(`${URI}/v1/database/${MODULE}/call/dev_clear_all_users`, {
  method: "POST",
  headers: {
    Authorization: `Bearer ${TOKEN}`,
    "Content-Type": "application/json",
  },
  body: "[]",
});

if (res.ok) {
  console.log("✅ All user profiles cleared.");
} else {
  const text = await res.text();
  console.error(`❌ Failed: ${res.status} ${text}`);
  process.exit(1);
}
