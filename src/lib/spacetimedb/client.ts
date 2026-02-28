import { DbConnection } from "@/module_bindings";
import type { Identity } from "spacetimedb";
import { useAuthStore } from "@/stores/auth-store";

const SPACETIMEDB_URI =
  process.env.NEXT_PUBLIC_SPACETIMEDB_URI || "wss://maincloud.spacetimedb.com";
const SPACETIMEDB_MODULE =
  process.env.NEXT_PUBLIC_SPACETIMEDB_MODULE || "myvoice";

export const VIEWPORT_SUBSCRIPTION_THRESHOLD = parseInt(
  process.env.NEXT_PUBLIC_VIEWPORT_SUBSCRIPTION_THRESHOLD ?? "0",
  10
);

let connection: DbConnection | null = null;
let connectionPromise: Promise<DbConnection> | null = null;

export function getConnection(): DbConnection | null {
  return connection;
}

export type ConnectionCallbacks = {
  onConnect?: (conn: DbConnection, identity: Identity, token: string) => void;
  onBlocksLoaded?: () => void;
  onDisconnect?: () => void;
  onConnectError?: (error: Error) => void;
};

const USER_TABLES = [
  "SELECT * FROM user_profile",
  "SELECT * FROM ad_placement",
  "SELECT * FROM contest",
  "SELECT * FROM contest_winner",
  "SELECT * FROM comment",
  "SELECT * FROM transaction_log",
];
const BLOCK_TABLES = [
  "SELECT * FROM block",
  "SELECT * FROM like_record",
  "SELECT * FROM dislike_record",
];

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
    // Without token: anonymous connection (requires "Allow anonymous sign-in" in SpacetimeDB)

    builder
      .onConnect((conn: DbConnection, identity: Identity, token: string) => {
        connection = conn;
        useAuthStore.getState().setToken(token);
        console.log("[SpacetimeDB] WS connected, subscribing to user tables...");

        // Subscribe to user/metadata tables first — fires quickly so user registration
        // happens without waiting for the full block table to load.
        conn
          .subscriptionBuilder()
          .onApplied(() => {
            console.log("[SpacetimeDB] user tables applied, calling onConnect");
            callbacks?.onConnect?.(conn, identity, token);
          })
          .subscribe(VIEWPORT_SUBSCRIPTION_THRESHOLD > 0 ? USER_TABLES : USER_TABLES);

        // Subscribe to block/interaction tables separately — may take a while.
        conn
          .subscriptionBuilder()
          .onApplied(() => {
            console.log("[SpacetimeDB] block tables applied");
            callbacks?.onBlocksLoaded?.();
          })
          .subscribe(VIEWPORT_SUBSCRIPTION_THRESHOLD > 0
            ? ["SELECT * FROM block"]
            : BLOCK_TABLES
          );

        resolve(conn);
      })
      .onDisconnect(() => {
        connection = null;
        connectionPromise = null;
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

/** Disconnect and reconnect (optionally with a fresh OIDC token) */
export function reconnect(
  callbacks?: ConnectionCallbacks,
  oidcToken?: string | null
): Promise<DbConnection> {
  disconnect();
  return connect(callbacks, oidcToken);
}

export function disconnect(): void {
  connection?.disconnect();
  connection = null;
  connectionPromise = null;
}
