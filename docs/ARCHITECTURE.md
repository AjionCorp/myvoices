# myVoice — System Architecture

---

## High-Level System Diagram

```mermaid
graph TB
    subgraph browser [Browser / Client]
        UI[React UI\nNext.js App Router]
        Zustand[Zustand Stores\n12 domain stores]
        SpacetimeClient[SpacetimeDB\nTS Client]
        ClerkClient[Clerk\nClient SDK]
    end

    subgraph nextjs [Next.js Server\nAPI Routes /api/v1/...]
        APIRoutes[REST API Handlers]
        ApiMiddleware[withApiKey Middleware]
        WebhookHandlers[Webhook Handlers\nClerk · Stripe]
    end

    subgraph spacetimedb [SpacetimeDB Cloud]
        WS[WebSocket\nSubscription Engine]
        Reducers[Rust Reducers\nBusiness Logic]
        Tables[Tables\nIn-memory + Durable]
    end

    subgraph external [External Services]
        Clerk[Clerk\nAuth + Identity]
        Stripe[Stripe\nPayments + Connect]
        YouTube[YouTube\noEmbed API]
        TikTok[TikTok\noEmbed API]
    end

    UI --> ClerkClient
    ClerkClient -->|OIDC JWT| Clerk
    Clerk -->|Session token| ClerkClient
    ClerkClient -->|JWT template: spacetimedb| SpacetimeClient
    SpacetimeClient -->|Authenticated WebSocket| WS
    WS -->|Row-level push callbacks| SpacetimeClient
    SpacetimeClient -->|onInsert/onUpdate/onDelete| Zustand
    Zustand -->|Reactive reads| UI
    UI -->|Call reducer| SpacetimeClient
    SpacetimeClient -->|Reducer call| Reducers
    Reducers -->|Read/Write| Tables
    Tables -->|Subscription updates| WS

    UI -->|REST fetch| APIRoutes
    APIRoutes --> ApiMiddleware
    APIRoutes -->|Read tables| Tables
    APIRoutes -->|Call server-side reducers| Reducers
    WebhookHandlers -->|user.updated/deleted| Reducers
    WebhookHandlers -->|checkout.completed| Reducers

    APIRoutes -->|video metadata| YouTube
    APIRoutes -->|video metadata| TikTok
    APIRoutes -->|payout / checkout| Stripe
    Stripe -->|webhook events| WebhookHandlers
    Clerk -->|webhook events| WebhookHandlers
```

---

## Authentication Flow

```mermaid
sequenceDiagram
    actor User
    participant ClerkUI as Clerk Modal
    participant ClerkServer as Clerk Server
    participant AuthProvider as AuthProvider\n(React Context)
    participant AuthStore as useAuthStore\n(Zustand)
    participant SpacetimeDB

    User->>ClerkUI: Click "Sign In"
    ClerkUI->>ClerkServer: Sign in (email/OAuth)
    ClerkServer-->>ClerkUI: Session established
    ClerkUI-->>AuthProvider: useAuth() resolves
    AuthProvider->>ClerkServer: getToken("spacetimedb")
    ClerkServer-->>AuthProvider: OIDC JWT
    AuthProvider->>AuthStore: setUser() + setToken()
    AuthProvider->>SpacetimeDB: connect().withToken(oidcToken)
    SpacetimeDB-->>AuthProvider: onConnect(identity, token)
    AuthProvider->>SpacetimeDB: store_clerk_mapping(clerkUserId)
    alt First login
        AuthProvider->>SpacetimeDB: register_user(username, email)
        SpacetimeDB-->>AuthStore: UserProfile row inserted → setUser()
    else Returning user
        SpacetimeDB-->>AuthStore: UserProfile subscription → setUser()
    end
    AuthStore-->>User: Authenticated, UI unlocked
```

### Identity Bridging

Two identity systems run in parallel:

| System | ID Format | Used For |
|---|---|---|
| Clerk | `user_xxxxxxxxxxxxxxxx` | Auth UX, webhooks, JWT issuance |
| SpacetimeDB | 32-char hex string | All in-app data ownership (blocks, comments, follows, messages) |

`ClerkIdentityMap` table links them: `clerk_user_id → spacetimedb_identity`. When Clerk fires a `user.updated` or `user.deleted` webhook, the server resolves the SpacetimeDB identity via this map and calls the appropriate server-side reducer.

---

## Data Flow: Anonymous vs. Authenticated

```mermaid
flowchart LR
    subgraph anon [Anonymous User]
        A1[Browser loads /]
        A2["GET /api/v1/topics\n(REST)"]
        A3[Next.js API reads\nSpacetimeDB tables via HTTP]
        A4[Topics rendered on\nLandingCanvas]
        A1 --> A2 --> A3 --> A4
    end

    subgraph auth [Authenticated User]
        B1[Browser loads /t/slug]
        B2[SpacetimeDB WebSocket\nauthenticated connection]
        B3[Server pushes subscribed\ntable rows in real-time]
        B4[Zustand stores updated\nvia row callbacks]
        B5[Canvas re-renders\nreactively]
        B1 --> B2 --> B3 --> B4 --> B5
        B4 -->|User action\ne.g. like_video| B2
    end
```

**Anonymous path**: No WebSocket. Topics load via `GET /api/v1/topics` which reads SpacetimeDB tables server-side. Fast first paint, no auth overhead.

**Authenticated path**: Persistent WebSocket. SpacetimeDB pushes every relevant row change (blocks, likes, comments, notifications, messages) directly to the client. No polling.

---

## Real-Time Reactivity Loop

```mermaid
flowchart LR
    SpacetimeDB -->|"Row event\n(insert/update/delete)"| Bindings
    Bindings["module_bindings/\nTS client bindings"]
    Bindings -->|"table.onInsert(cb)\ntable.onUpdate(cb)\ntable.onDelete(cb)"| Provider
    Provider["SpacetimeDBProvider\n(sets up all callbacks on mount)"]
    Provider -->|"store.addBlock(row)\nstore.updateBlock(row)\nstore.removeBlock(id)"| Zustand
    Zustand["Zustand Store\n(e.g. useBlocksStore)"]
    Zustand -->|"useSyncExternalStore\n(React subscription)"| Components
    Components["React Components\n(re-render on state slice change)"]
    Components -->|"conn.reducers.likeVideo(id)"| SpacetimeDB
```

SpacetimeDB row callbacks → Zustand mutations → React re-renders. No Redux, no REST polling, no manual cache invalidation.

---

## Zustand Store Map

```mermaid
graph TD
    subgraph canvas [Canvas & Content]
        blocks["useBlocksStore\nblocks · spatial index\npositionIndex · videoIdIndex\nrankIndex · topBlocks"]
        canvas_s["useCanvasStore\nviewportX/Y · zoom\nselectedBlockId\nmodal states"]
        topic["useTopicStore\ntopics · taxonomyNodes\nmoderators · applications"]
    end

    subgraph social [Social & Engagement]
        comments["useCommentsStore\ncomments · byBlock index\ncommentLikes · likesByComment"]
        follows["useFollowsStore\nfollows (UserFollow map)\nhelpers: isFollowing\nareMutualFollowers"]
        notifs["useNotificationsStore\nnotifications · unreadCount"]
    end

    subgraph messaging [Messaging]
        messages["useMessagesStore\nmessages · conversations\ntotalUnread · requestCount\nactiveTab · selectedConvId"]
    end

    subgraph user [User & Moderation]
        auth["useAuthStore\nuser · token · isAuthenticated\nisLoading · clerkUserId"]
        mod["useModerationStore\nblocks (UserBlock map)\nmutes (UserMute map)\ngetHiddenIdentities()"]
    end

    subgraph misc [Other]
        contest["useContestStore\nactiveContest · winners\nleaderboard · timeRemaining"]
        explore["useExploreStore\nsidebarOpen · selectedPaths"]
        viewers["useViewersStore\nviewers (presence)\nstartViewerSimulation()"]
    end
```

| Store | Primary Owner | Key Indexes / Helpers |
|---|---|---|
| `useBlocksStore` | Video blocks on a canvas | Spatial bucket index (32×32 cells), `"x,y"→id`, `videoId→id`, rank |
| `useCanvasStore` | Viewport pan/zoom state | `centerOnBlock()`, `zoomBy()` with pivot, modal open/close |
| `useTopicStore` | Topics + taxonomy + mods | `getTopicBySlug()`, `isModeratorForTopic()` |
| `useCommentsStore` | Comments + replies + likes | `getTopLevelComments()`, `getReplies()`, `isLikedByUser()` |
| `useFollowsStore` | User-follow graph | `areMutualFollowers()`, follower/following counts |
| `useNotificationsStore` | In-app notifications | `unreadCount` auto-derived on every write |
| `useMessagesStore` | DMs + conversations | `getPrimaryConversations()`, `getRequestConversations()`, unread counts |
| `useAuthStore` | Current user auth state | Persists to `localStorage`, Clerk ID kept separate from SpacetimeDB identity |
| `useModerationStore` | Blocks + mutes | `isBlocked()` (symmetric), `getHiddenIdentities()` for feed filtering |
| `useContestStore` | Active contest state | Countdown timer, leaderboard |
| `useExploreStore` | Taxonomy sidebar UI | Multi-select `selectedPaths` set |
| `useViewersStore` | Live presence (other viewers) | Mock simulation mode with 25 drifting avatars |

---

## SpacetimeDB Subscription Strategy

```mermaid
flowchart TD
    Connect[WebSocket connect]
    Connect --> GlobalSubs

    subgraph GlobalSubs [Always-subscribed tables]
        G1[user_profile]
        G2[topic]
        G3[topic_taxonomy_node]
        G4[topic_moderator + application]
        G5[ad_placement]
        G6[contest + contest_winner]
        G7[comment + comment_like]
        G8[transaction_log + credit_transaction_log]
        G9[topic_follow + topic_ban]
        G10[saved_block]
    end

    Connect --> AuthCheck{Authenticated?}
    AuthCheck -->|Yes| UserSubs

    subgraph UserSubs [Per-user subscriptions\nfiltered by identity]
        U1[notification]
        U2[direct_message]
        U3[conversation]
        U4[user_follow]
        U5[user_block + user_mute]
    end

    Connect --> PageNav{Page navigation}
    PageNav -->|/t/slug| TopicSub["subscribeToTopicBlocks(topicId)\nblock + like_record + dislike_record"]
    PageNav -->|"/u/username"| UserBlockSub["subscribeToUserBlocks(ownerIdentity)\nblock (filtered by owner)"]
```

---

## API Middleware Stack

```mermaid
flowchart LR
    Request[Incoming\nGET /api/v1/...] --> Check{x-api-key\nheader?}
    Check -->|No| Handler[Route Handler\napiKey = null]
    Check -->|Yes| Validate[validateApiKey\nSHA-256 hash lookup\n5-min cache]
    Validate -->|Invalid| R401[401 Unauthorized]
    Validate -->|Valid| RateLimit[checkRateLimit\nDaily bucket\nFree: 1000/day\nPaid: deduct credits]
    RateLimit -->|Exceeded| R429[429 Too Many Requests\nRetry-After header]
    RateLimit -->|Allowed| Track[trackUsage\nbatched flush\nevery 30s or 50 requests]
    Track --> Handler
    Handler --> Response[Response +\nX-RateLimit-* headers]
```
