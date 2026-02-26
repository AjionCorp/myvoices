/**
 * SpacetimeDB 2 client connection manager.
 *
 * This module owns the singleton DbConnection and exposes helpers
 * for connecting, disconnecting, and accessing the connection from
 * anywhere in the app (stores, components, etc.).
 *
 * Generated module bindings are expected at `@/module_bindings`.
 * Run:  spacetime generate --lang typescript \
 *         --out-dir src/module_bindings \
 *         --module-path server
 */

import { DbConnection, tables } from "@/module_bindings";
import { Identity } from "spacetimedb";
import { useAuthStore } from "@/stores/auth-store";

const SPACETIMEDB_URI =
  process.env.NEXT_PUBLIC_SPACETIMEDB_URI || "ws://localhost:3000";
const SPACETIMEDB_MODULE =
  process.env.NEXT_PUBLIC_SPACETIMEDB_MODULE || "myvoice";

const TOKEN_KEY = "spacetimedb_token";

let connection: DbConnection | null = null;
let connectionPromise: Promise<DbConnection> | null = null;

export function getConnection(): DbConnection | null {
  return connection;
}

export function getStoredToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

function persistToken(token: string): void {
  if (typeof window !== "undefined") {
    localStorage.setItem(TOKEN_KEY, token);
  }
}

export function clearAuthToken(): void {
  connection?.disconnect();
  connection = null;
  connectionPromise = null;
  if (typeof window !== "undefined") {
    localStorage.removeItem(TOKEN_KEY);
  }
}

export type ConnectionCallbacks = {
  onConnect?: (conn: DbConnection, identity: Identity, token: string) => void;
  onDisconnect?: () => void;
  onConnectError?: (error: Error) => void;
};

/**
 * Connect to SpacetimeDB. Returns the existing connection if already
 * connected, or creates a new one.  Safe to call multiple times.
 */
export function connect(callbacks?: ConnectionCallbacks): Promise<DbConnection> {
  if (connection) return Promise.resolve(connection);
  if (connectionPromise) return connectionPromise;

  connectionPromise = new Promise<DbConnection>((resolve, reject) => {
    const storedToken = getStoredToken();

    const builder = DbConnection.builder()
      .withUri(SPACETIMEDB_URI)
      .withDatabaseName(SPACETIMEDB_MODULE)
      .onConnect((conn, identity, token) => {
        connection = conn;
        persistToken(token);
        useAuthStore.getState().setToken(token);

        conn
          .subscriptionBuilder()
          .onApplied(() => {
            callbacks?.onConnect?.(conn, identity, token);
          })
          .subscribe([
            tables.block,
            tables.userProfile,
            tables.contest,
            tables.contestWinner,
            tables.likeRecord,
            tables.adPlacement,
          ]);

        resolve(conn);
      })
      .onDisconnect(() => {
        connection = null;
        connectionPromise = null;
        callbacks?.onDisconnect?.();
      })
      .onConnectError((_ctx, error) => {
        connectionPromise = null;
        callbacks?.onConnectError?.(error);
        reject(error);
      });

    if (storedToken) {
      builder.withToken(storedToken);
    }

    builder.build();
  });

  return connectionPromise;
}

export function disconnect(): void {
  connection?.disconnect();
  connection = null;
  connectionPromise = null;
}
