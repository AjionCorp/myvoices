import { DbConnection } from "@/module_bindings";
import type { Identity } from "spacetimedb";
import { useAuthStore } from "@/stores/auth-store";

const SPACETIMEDB_URI =
  process.env.NEXT_PUBLIC_SPACETIMEDB_URI || "wss://maincloud.spacetimedb.com";
const SPACETIMEDB_MODULE =
  process.env.NEXT_PUBLIC_SPACETIMEDB_MODULE || "myvoice";

let connection: DbConnection | null = null;
let connectionPromise: Promise<DbConnection> | null = null;

export function getConnection(): DbConnection | null {
  return connection;
}

export function clearConnection(): void {
  connection?.disconnect();
  connection = null;
  connectionPromise = null;
}

export type ConnectionCallbacks = {
  onConnect?: (conn: DbConnection, identity: Identity, token: string) => void;
  onDisconnect?: () => void;
  onConnectError?: (error: Error) => void;
};

export function connect(
  callbacks?: ConnectionCallbacks,
  oidcToken?: string | null
): Promise<DbConnection> {
  if (connection) return Promise.resolve(connection);
  if (connectionPromise) return connectionPromise;

  connectionPromise = new Promise<DbConnection>((resolve, reject) => {
    const tokenToUse = oidcToken || null;

    const builder = DbConnection.builder()
      .withUri(SPACETIMEDB_URI)
      .withDatabaseName(SPACETIMEDB_MODULE)
      .onConnect((conn: DbConnection, identity: Identity, token: string) => {
        connection = conn;
        useAuthStore.getState().setToken(token);

        conn
          .subscriptionBuilder()
          .onApplied(() => {
            callbacks?.onConnect?.(conn, identity, token);
          })
          .subscribeToAllTables();

        resolve(conn);
      })
      .onDisconnect(() => {
        connection = null;
        connectionPromise = null;
        callbacks?.onDisconnect?.();
      })
      .onConnectError((_ctx: unknown, error: Error) => {
        connectionPromise = null;

        // If the token is expired/invalid, clear it and retry anonymously
        const msg = error?.message || String(error);
        if (msg.includes("ExpiredSignature") || msg.includes("TokenError") || msg.includes("InvalidToken") || msg.includes("Unauthorized")) {
          console.warn("[SpacetimeDB] Stale token detected, reconnecting anonymously...");
          clearConnection();
          // Retry without token
          connect(callbacks).then(resolve, reject);
          return;
        }

        callbacks?.onConnectError?.(error);
        reject(error);
      });

    if (tokenToUse) {
      builder.withToken(tokenToUse);
    }

    builder.build();
  });

  return connectionPromise;
}

/** Disconnect and reconnect with a fresh OIDC token */
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
