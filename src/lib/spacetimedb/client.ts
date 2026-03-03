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
];

/** Handle for the user-specific notification subscription. */
let notificationSubscription: SubscriptionHandle | null = null;

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
        notificationSubscription = null;
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
  notificationSubscription?.unsubscribe();
  notificationSubscription = null;
  connection?.disconnect();
  connection = null;
  connectionPromise = null;
}
