# myVoice — Project Overview

> **"1 Million Video Canvas"** — A social platform where users compete for the center of an infinite, zoomable video grid.

---

## What Is myVoice?

myVoice is a real-time social video platform built around **topic canvases** — infinite, zoomable grid boards where users claim positions by submitting YouTube or TikTok videos. The community votes those videos toward the center (the most coveted position) through likes and dislikes. Creators earn real money through contests and Stripe-powered payouts.

The core metaphor is a **circuit-board-style canvas** full of live video thumbnails. Every topic has its own canvas; the closer a video is to the center, the more engagement it has received.

---

## Tech Stack

| Layer | Technology | Version |
|---|---|---|
| Framework | Next.js (App Router) | 16 |
| UI Library | React | 19 |
| Language | TypeScript | 5 |
| Styling | Tailwind CSS + shadcn/ui (Radix primitives) | 4 |
| Real-time DB | SpacetimeDB (WebSocket, Rust module) | 2.0 |
| Auth | Clerk (`@clerk/nextjs`) | 6 |
| Client State | Zustand | 5 |
| Payments | Stripe (Connect + Checkout) | latest |
| Form Validation | React Hook Form + Zod | latest |
| Backend Logic | Rust (SpacetimeDB reducers) | — |
| E2E Testing | Playwright | latest |
| MCP Server | Custom Node.js (`scripts/mcp-server.mjs`) | — |

---

## Repository Layout

```
D:/myVoice/
├── server/                   ← Rust SpacetimeDB module
│   └── src/
│       ├── tables.rs         ← All database table definitions
│       └── reducers/         ← Business logic (claim, like, comment, …)
├── src/
│   ├── app/                  ← Next.js App Router pages + API routes
│   ├── components/           ← React components (grouped by domain)
│   ├── lib/                  ← Utility libraries, SpacetimeDB client
│   ├── module_bindings/      ← Auto-generated TypeScript SpacetimeDB bindings
│   └── stores/               ← Zustand state stores (one per domain)
├── e2e/                      ← Playwright end-to-end tests
├── scripts/                  ← MCP server + tooling
└── public/                   ← Static assets
```

---

## Page Routes

### Canvas Pages (full-screen, infinite zoom/pan)

| Route | Description |
|---|---|
| `/` | Landing canvas — shows all topics as a zoomable `CircuitCanvas` with the `ExploreSidebar` |
| `/t/[slug]` | Topic canvas — the main play area; a full-screen video grid for a single topic |
| `/u/[username]` | User profile canvas — shows all of a user's videos across all topics |
| `/compare/[...slugs]` | Side-by-side comparison of 2–4 topic canvases |
| `/t/create` | Create a new topic |

### Standard Pages (header + centered content column)

| Route | Auth Required | Description |
|---|---|---|
| `/popular` | No | Top-scored video blocks across all topics; sortable by Hot / Top / New |
| `/feed` | Yes | Blocks from topics the user follows; sortable by Hot / New |
| `/search` | No | Full-text search over topics and users |
| `/liked` | Yes | All video blocks the user has liked |
| `/saved` | Yes | All video blocks the user has bookmarked |
| `/messages` | Yes | Direct messaging inbox (conversations + chat pane) |
| `/settings` | Yes | Account settings, profile details, Stripe Connect, credits balance |
| `/earnings` | Yes | Contest win history and Stripe payout management |
| `/developers` | No | Developer API portal: register key, manage credits, API reference |
| `/about` | No | About page |
| `/help` | No | Help / FAQ page |
| `/privacy` | No | Privacy policy |
| `/terms` | No | Terms of service |

### Admin Pages (requires `is_admin = true`)

| Route | Description |
|---|---|
| `/admin` | Admin dashboard landing |
| `/admin/contests` | Create / finalize contests; trigger Stripe prize payouts |
| `/admin/finance` | Financial overview |
| `/admin/reports` | Review user reports (dismiss / warn / ban) |
| `/admin/taxonomy` | Manage the topic category tree |
| `/admin/users` | User management |
| `/admin/ads` | Ad placement management |

---

## Two UI Paradigms

```
┌─────────────────────────────────────────────────────────────────┐
│  CANVAS PAGES  /  /t/[slug]  /u/[username]  /compare/...        │
│                                                                   │
│  body { overflow: hidden }  ←  no document scroll               │
│  VideoCanvas (base layer) + absolutely-positioned overlays       │
│  Header is replaced by topic-specific TopicHeader               │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  STANDARD PAGES  /popular  /feed  /search  /messages  …         │
│                                                                   │
│  Sticky Header → centered content column (max-w-3xl)            │
│  Traditional scroll  ·  No canvas                               │
└─────────────────────────────────────────────────────────────────┘
```

---

## Key Concepts

| Term | Definition |
|---|---|
| **Topic** | A named canvas / discussion space with a category and its own video grid |
| **Block** | A single claimed cell in a topic's grid; holds one video + engagement metrics |
| **Spiral rebalance** | After every like/unlike, all blocks are re-sorted by score and reassigned positions outward from the center in a spiral — the most-liked video is always at `(0,0)` |
| **Claim** | The act of submitting a video to a topic; creates a Block at the next available spiral position |
| **Contest** | A timed competition where the top-2 liked videos split a prize pool paid out via Stripe |
| **Credits** | In-app currency. New users receive 10 free credits. Additional credits purchasable via Stripe. Used for API access and future features |
| **SpacetimeDB identity** | A cryptographic hex identifier issued by SpacetimeDB on first WebSocket connection. Bridged to Clerk's user ID via `ClerkIdentityMap` |
| **Anonymous read path** | Unauthenticated users skip the WebSocket entirely; the landing page and topic data load via REST (`/api/v1/topics`) for fast initial render |

---

## Environment Variables (key ones)

| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_SPACETIMEDB_URI` | WebSocket URI (default: `wss://maincloud.spacetimedb.com`) |
| `NEXT_PUBLIC_SPACETIMEDB_MODULE` | Module name (default: `myvoice`) |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk public key |
| `CLERK_SECRET_KEY` | Clerk secret for webhook verification |
| `STRIPE_SECRET_KEY` | Stripe API secret |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signature secret (ad placements) |
| `STRIPE_CREDITS_WEBHOOK_SECRET` | Stripe webhook signature secret (credit purchases) |
| `NEXT_PUBLIC_USE_MOCK_DATA` | Set to `true` to bypass SpacetimeDB and use local mock data |
