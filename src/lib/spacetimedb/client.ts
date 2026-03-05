import { DbConnection, type SubscriptionHandle } from "@/module_bindings";
import type { Identity } from "spacetimedb";
import { useAuthStore } from "@/stores/auth-store";

const SPACETIMEDB_URI =
  process.env.NEXT_PUBLIC_SPACETIMEDB_URI || "wss://maincloud.spacetimedb.com";
const SPACETIMEDB_MODULE =
  process.env.NEXT_PUBLIC_SPACETIMEDB_MODULE || "myvoice";

let connection: DbConnection | null = null;
let connectionPromise: Promise<DbConnection> | null = null;

/** Handle for the currently-active block subscription (one topic at a time). */
let activeBlockSubscription: SubscriptionHandle | null = null;

/** Handle for user-profile block subscription (all blocks by a specific user). */
let userBlocksSubscription: SubscriptionHandle | null = null;

export function getConnection(): DbConnection | null {
  return connection;
}

export type ConnectionCallbacks = {
  onConnect?: (conn: DbConnection, identity: Identity, token: string) => void;
  onBlocksLoaded?: () => void;
  onDisconnect?: () => void;
  onConnectError?: (error: Error) => void;
};

/** Tables that are always subscribed (user metadata + all topics for the landing page). */
const USER_TABLES = [
  "SELECT * FROM user_profile",
  "SELECT * FROM topic",
  "SELECT * FROM topic_taxonomy_node",
  "SELECT * FROM topic_moderator",
  "SELECT * FROM topic_moderator_application",
  "SELECT * FROM ad_placement",
  "SELECT * FROM contest",
  "SELECT * FROM contest_winner",
  "SELECT * FROM comment",
  "SELECT * FROM comment_like",
  "SELECT * FROM transaction_log",
  "SELECT * FROM credit_transaction_log",
  "SELECT * FROM topic_follow",
  "SELECT * FROM topic_ban",
  "SELECT * FROM saved_block",
];

/** Handle for the user-specific notification subscription. */
let notificationSubscription: SubscriptionHandle | null = null;

/** Handle for the user-specific message subscription. */
let messageSubscription: SubscriptionHandle | null = null;

/** Handle for the user-specific follow subscription. */
let followSubscription: SubscriptionHandle | null = null;

/** Handle for the user-specific conversation subscription. */
let conversationSubscription: SubscriptionHandle | null = null;

/** Handle for the user-specific block subscription. */
let blockSubscription: SubscriptionHandle | null = null;

/** Handle for the user-specific mute subscription. */
let muteSubscription: SubscriptionHandle | null = null;

/**
 * Subscribe to notifications for the authenticated user.
 * Called after connect when the identity is known.
 */
export function subscribeToNotifications(identity: string): void {
  if (!connection) return;

  if (notificationSubscription) {
    notificationSubscription.unsubscribe();
    notificationSubscription = null;
  }

  notificationSubscription = connection
    .subscriptionBuilder()
    .onApplied(() => {
      console.log("[SpacetimeDB] notification subscription applied");
    })
    .subscribe([
      `SELECT * FROM notification WHERE recipient_identity = '${identity}'`,
    ]);
}

/**
 * Subscribe to direct messages for the authenticated user.
 * Called after connect when the identity is known.
 */
export function subscribeToMessages(identity: string): void {
  if (!connection) return;

  if (messageSubscription) {
    messageSubscription.unsubscribe();
    messageSubscription = null;
  }

  messageSubscription = connection
    .subscriptionBuilder()
    .onApplied(() => {
      console.log("[SpacetimeDB] message subscription applied");
    })
    .subscribe([
      `SELECT * FROM direct_message WHERE sender_identity = '${identity}' OR recipient_identity = '${identity}'`,
    ]);
}

/**
 * Subscribe to follows for the authenticated user.
 */
export function subscribeToFollows(identity: string): void {
  if (!connection) return;

  if (followSubscription) {
    followSubscription.unsubscribe();
    followSubscription = null;
  }

  followSubscription = connection
    .subscriptionBuilder()
    .onApplied(() => {
      console.log("[SpacetimeDB] follow subscription applied");
    })
    .subscribe([
      `SELECT * FROM user_follow WHERE follower_identity = '${identity}' OR following_identity = '${identity}'`,
    ]);
}

/**
 * Subscribe to conversations for the authenticated user.
 */
export function subscribeToConversations(identity: string): void {
  if (!connection) return;

  if (conversationSubscription) {
    conversationSubscription.unsubscribe();
    conversationSubscription = null;
  }

  conversationSubscription = connection
    .subscriptionBuilder()
    .onApplied(() => {
      console.log("[SpacetimeDB] conversation subscription applied");
    })
    .subscribe([
      `SELECT * FROM conversation WHERE participant_a = '${identity}' OR participant_b = '${identity}'`,
    ]);
}

/**
 * Subscribe to block relationships for the authenticated user.
 */
export function subscribeToUserBlocks_mod(identity: string): void {
  if (!connection) return;
  if (blockSubscription) {
    blockSubscription.unsubscribe();
    blockSubscription = null;
  }
  blockSubscription = connection
    .subscriptionBuilder()
    .onApplied(() => {
      console.log("[SpacetimeDB] block subscription applied");
    })
    .subscribe([
      `SELECT * FROM user_block WHERE blocker_identity = '${identity}' OR blocked_identity = '${identity}'`,
    ]);
}

/**
 * Subscribe to mute relationships for the authenticated user.
 */
export function subscribeToUserMutes(identity: string): void {
  if (!connection) return;
  if (muteSubscription) {
    muteSubscription.unsubscribe();
    muteSubscription = null;
  }
  muteSubscription = connection
    .subscriptionBuilder()
    .onApplied(() => {
      console.log("[SpacetimeDB] mute subscription applied");
    })
    .subscribe([
      `SELECT * FROM user_mute WHERE muter_identity = '${identity}'`,
    ]);
}

/** Handle for admin-only report subscription. */
let reportSubscription: SubscriptionHandle | null = null;

/**
 * Subscribe to all user reports (admin-only).
 * Call this only after verifying the user is an admin.
 */
export function subscribeToReports(): void {
  if (!connection) return;
  if (reportSubscription) {
    reportSubscription.unsubscribe();
    reportSubscription = null;
  }
  reportSubscription = connection
    .subscriptionBuilder()
    .onApplied(() => {
      console.log("[SpacetimeDB] report subscription applied (admin)");
    })
    .subscribe([`SELECT * FROM user_report`]);
}

export function connect(
  callbacks?: ConnectionCallbacks,
  oidcToken?: string | null
): Promise<DbConnection> {
  if (connection) return Promise.resolve(connection);
  if (connectionPromise) return connectionPromise;

  connectionPromise = new Promise<DbConnection>((resolve, reject) => {
    let builder = DbConnection.builder()
      .withUri(SPACETIMEDB_URI)
      .withDatabaseName(SPACETIMEDB_MODULE);

    if (oidcToken) {
      builder = builder.withToken(oidcToken);
    }

    builder
      .onConnect((conn: DbConnection, identity: Identity, token: string) => {
        connection = conn;
        useAuthStore.getState().setToken(token);
        console.log("[SpacetimeDB] WS connected, subscribing to user+topic tables...");

        conn
          .subscriptionBuilder()
          .onApplied(() => {
            console.log("[SpacetimeDB] user+topic tables applied, calling onConnect");
            callbacks?.onConnect?.(conn, identity, token);
          })
          .subscribe(USER_TABLES);

        resolve(conn);
      })
      .onDisconnect(() => {
        connection = null;
        connectionPromise = null;
        activeBlockSubscription = null;
        userBlocksSubscription = null;
        notificationSubscription = null;
        messageSubscription = null;
        followSubscription = null;
        conversationSubscription = null;
        blockSubscription = null;
        muteSubscription = null;
        callbacks?.onDisconnect?.();
      })
      .onConnectError((_ctx: unknown, error: Error) => {
        connectionPromise = null;
        callbacks?.onConnectError?.(error);
        reject(error);
      })
      .build();
  });

  return connectionPromise;
}

/**
 * Subscribe to all blocks (and interaction records) belonging to a specific topic.
 * Calling this again with a different topicId will unsubscribe from the previous topic first.
 */
export function subscribeToTopicBlocks(
  topicId: number,
  onLoaded: () => void
): void {
  if (!connection) return;

  // Unsubscribe from any previous topic
  if (activeBlockSubscription) {
    activeBlockSubscription.unsubscribe();
    activeBlockSubscription = null;
  }

  console.log(`[SpacetimeDB] subscribing to blocks for topic ${topicId}`);

  activeBlockSubscription = connection
    .subscriptionBuilder()
    .onApplied(() => {
      console.log(`[SpacetimeDB] block tables for topic ${topicId} applied`);
      onLoaded();
    })
    .subscribe([
      `SELECT * FROM block WHERE topic_id = ${topicId}`,
      `SELECT * FROM like_record`,
      `SELECT * FROM dislike_record`,
    ]);
}

/** Unsubscribe from the current topic's blocks (e.g. when leaving a topic page). */
export function unsubscribeFromTopicBlocks(): void {
  if (activeBlockSubscription) {
    activeBlockSubscription.unsubscribe();
    activeBlockSubscription = null;
    console.log("[SpacetimeDB] unsubscribed from topic blocks");
  }
}

/**
 * Subscribe to all blocks owned by a specific user (across all topics).
 * Used on the user profile page to show all their videos.
 */
export function subscribeToUserBlocks(
  ownerIdentity: string,
  onLoaded: () => void
): void {
  if (!connection) return;

  if (userBlocksSubscription) {
    userBlocksSubscription.unsubscribe();
    userBlocksSubscription = null;
  }

  console.log(`[SpacetimeDB] subscribing to blocks for user ${ownerIdentity.slice(0, 12)}…`);

  userBlocksSubscription = connection
    .subscriptionBuilder()
    .onApplied(() => {
      console.log(`[SpacetimeDB] user blocks applied for ${ownerIdentity.slice(0, 12)}…`);
      onLoaded();
    })
    .subscribe([
      `SELECT * FROM block WHERE owner_identity = '${ownerIdentity}'`,
    ]);
}

/** Unsubscribe from user blocks (e.g. when leaving a profile page). */
export function unsubscribeFromUserBlocks(): void {
  if (userBlocksSubscription) {
    userBlocksSubscription.unsubscribe();
    userBlocksSubscription = null;
    console.log("[SpacetimeDB] unsubscribed from user blocks");
  }
}

/** Disconnect and reconnect (optionally with a fresh OIDC token) */
export function reconnect(
  callbacks?: ConnectionCallbacks,
  oidcToken?: string | null
): Promise<DbConnection> {
  disconnect();
  return connect(callbacks, oidcToken);
}

export function disconnect(): void {
  activeBlockSubscription?.unsubscribe();
  activeBlockSubscription = null;
  userBlocksSubscription?.unsubscribe();
  userBlocksSubscription = null;
  notificationSubscription?.unsubscribe();
  notificationSubscription = null;
  messageSubscription?.unsubscribe();
  messageSubscription = null;
  followSubscription?.unsubscribe();
  followSubscription = null;
  conversationSubscription?.unsubscribe();
  conversationSubscription = null;
  blockSubscription?.unsubscribe();
  blockSubscription = null;
  muteSubscription?.unsubscribe();
  muteSubscription = null;
  connection?.disconnect();
  connection = null;
  connectionPromise = null;
}
