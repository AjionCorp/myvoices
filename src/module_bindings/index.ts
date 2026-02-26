/**
 * STUB module bindings — mirrors the Rust module schema so the app
 * compiles before `spacetime generate` is run.
 *
 * Replace this entire directory by running:
 *   spacetime generate --lang typescript \
 *     --out-dir src/module_bindings \
 *     --module-path server
 */

import {
  Identity,
  ConnectionId,
  type DbConnectionBuilder as BaseBuilder,
} from "spacetimedb";

/* ------------------------------------------------------------------ */
/*  Row types (match server/src/tables.rs)                            */
/* ------------------------------------------------------------------ */

export interface Block {
  id: number;
  x: number;
  y: number;
  videoUrl: string;
  thumbnailUrl: string;
  platform: string;
  ownerIdentity: string;
  ownerName: string;
  likes: bigint;
  status: string;
  adImageUrl: string;
  adLinkUrl: string;
  claimedAt: bigint;
}

export interface UserProfile {
  identity: string;
  displayName: string;
  email: string;
  stripeAccountId: string;
  totalEarnings: bigint;
  isAdmin: boolean;
  createdAt: bigint;
}

export interface LikeRecord {
  id: bigint;
  blockId: number;
  userIdentity: string;
  createdAt: bigint;
}

export interface AdPlacement {
  id: bigint;
  blockIdsJson: string;
  adImageUrl: string;
  adLinkUrl: string;
  ownerIdentity: string;
  paid: boolean;
  createdAt: bigint;
  expiresAt: bigint;
}

export interface Contest {
  id: bigint;
  startAt: bigint;
  endAt: bigint;
  prizePool: bigint;
  status: string;
}

export interface TransactionLog {
  id: bigint;
  txType: string;
  amount: bigint;
  fromIdentity: string;
  toIdentity: string;
  stripeId: string;
  description: string;
  createdAt: bigint;
}

export interface ContestWinner {
  id: bigint;
  contestId: bigint;
  blockId: number;
  ownerIdentity: string;
  ownerName: string;
  videoUrl: string;
  thumbnailUrl: string;
  platform: string;
  likes: bigint;
  rank: number;
  prizeAmount: bigint;
}

/* ------------------------------------------------------------------ */
/*  Event / context types                                             */
/* ------------------------------------------------------------------ */

export type Event =
  | { tag: "Reducer"; value: ReducerEvent }
  | { tag: "Transaction" }
  | { tag: "SubscriptionApplied" };

export interface ReducerEvent {
  timestamp: bigint;
  status: UpdateStatus;
  callerIdentity: Identity;
  callerConnectionId?: ConnectionId;
  energyConsumed?: bigint;
  reducer: Reducer;
}

export type UpdateStatus =
  | { tag: "Committed" }
  | { tag: "Failed"; value: string }
  | { tag: "OutOfEnergy" };

export type Reducer =
  | { name: "ClaimBlock"; args: { blockId: number; videoUrl: string; thumbnailUrl: string; platform: string; ownerName: string } }
  | { name: "UnclaimBlock"; args: { blockId: number } }
  | { name: "LikeVideo"; args: { blockId: number } }
  | { name: "UnlikeVideo"; args: { blockId: number } }
  | { name: "PlaceAd"; args: { blockIdsJson: string; adImageUrl: string; adLinkUrl: string; durationDays: bigint } }
  | { name: "RemoveAd"; args: { adId: bigint } }
  | { name: "MarkAdPaid"; args: { adId: bigint } }
  | { name: "CreateContest"; args: { durationDays: bigint; prizePool: bigint } }
  | { name: "FinalizeContest"; args: { contestId: bigint } }
  | { name: "RegisterUser"; args: { displayName: string; email: string } }
  | { name: "UpdateStripeAccount"; args: { stripeAccountId: string } }
  | { name: "SetAdmin"; args: { targetIdentity: string; isAdmin: boolean } }
  | { name: "RebalanceLayout"; args: { batchSize: number } };

/* ------------------------------------------------------------------ */
/*  Table callback / handle plumbing                                  */
/* ------------------------------------------------------------------ */

type InsertCallback<Row> = (ctx: EventContext, row: Row) => void;
type DeleteCallback<Row> = (ctx: EventContext, row: Row) => void;
type UpdateCallback<Row> = (ctx: EventContext, oldRow: Row, newRow: Row) => void;

export interface EventContext {
  event: Event;
  db: RemoteTables;
  reducers: RemoteReducers;
}

interface UniqueIndex<Row> {
  find(value: string | number | bigint): Row | undefined;
}

interface TableHandle<Row> {
  count(): number;
  iter(): Iterable<Row>;
  onInsert(cb: InsertCallback<Row>): void;
  removeOnInsert(cb: InsertCallback<Row>): void;
  onDelete(cb: DeleteCallback<Row>): void;
  removeOnDelete(cb: DeleteCallback<Row>): void;
  onUpdate(cb: UpdateCallback<Row>): void;
  removeOnUpdate(cb: UpdateCallback<Row>): void;
}

interface BlockTableHandle extends TableHandle<Block> {
  id: UniqueIndex<Block>;
}

interface UserProfileTableHandle extends TableHandle<UserProfile> {
  identity: UniqueIndex<UserProfile>;
}

interface LikeRecordTableHandle extends TableHandle<LikeRecord> {
  id: UniqueIndex<LikeRecord>;
}

interface AdPlacementTableHandle extends TableHandle<AdPlacement> {
  id: UniqueIndex<AdPlacement>;
}

interface ContestTableHandle extends TableHandle<Contest> {
  id: UniqueIndex<Contest>;
}

interface TransactionLogTableHandle extends TableHandle<TransactionLog> {
  id: UniqueIndex<TransactionLog>;
}

interface ContestWinnerTableHandle extends TableHandle<ContestWinner> {
  id: UniqueIndex<ContestWinner>;
}

/* ------------------------------------------------------------------ */
/*  RemoteTables                                                      */
/* ------------------------------------------------------------------ */

export interface RemoteTables {
  block: BlockTableHandle;
  userProfile: UserProfileTableHandle;
  likeRecord: LikeRecordTableHandle;
  adPlacement: AdPlacementTableHandle;
  contest: ContestTableHandle;
  transactionLog: TransactionLogTableHandle;
  contestWinner: ContestWinnerTableHandle;
}

/* ------------------------------------------------------------------ */
/*  RemoteReducers                                                    */
/* ------------------------------------------------------------------ */

export interface RemoteReducers {
  claimBlock(blockId: number, videoUrl: string, thumbnailUrl: string, platform: string, ownerName: string): Promise<void>;
  unclaimBlock(blockId: number): Promise<void>;
  likeVideo(blockId: number): Promise<void>;
  unlikeVideo(blockId: number): Promise<void>;
  placeAd(blockIdsJson: string, adImageUrl: string, adLinkUrl: string, durationDays: bigint): Promise<void>;
  removeAd(adId: bigint): Promise<void>;
  markAdPaid(adId: bigint): Promise<void>;
  createContest(durationDays: bigint, prizePool: bigint): Promise<void>;
  finalizeContest(contestId: bigint): Promise<void>;
  registerUser(displayName: string, email: string): Promise<void>;
  updateStripeAccount(stripeAccountId: string): Promise<void>;
  setAdmin(targetIdentity: string, isAdmin: boolean): Promise<void>;
  rebalanceLayout(batchSize: number): Promise<void>;
}

/* ------------------------------------------------------------------ */
/*  Subscription plumbing                                             */
/* ------------------------------------------------------------------ */

export interface SubscriptionHandle {
  unsubscribe(): void;
}

export interface SubscriptionEventContext {
  db: RemoteTables;
  reducers: RemoteReducers;
}

export interface ErrorContext {
  event: Error;
  db: RemoteTables;
  reducers: RemoteReducers;
}

interface SubscriptionBuilder {
  onApplied(cb: (ctx: SubscriptionEventContext) => void): SubscriptionBuilder;
  onError(cb: (ctx: ErrorContext, error: Error) => void): SubscriptionBuilder;
  subscribe(queries: unknown | unknown[]): SubscriptionHandle;
  subscribeToAllTables(): void;
}

/* ------------------------------------------------------------------ */
/*  DbConnection                                                      */
/* ------------------------------------------------------------------ */

export interface DbConnection {
  db: RemoteTables;
  reducers: RemoteReducers;
  disconnect(): void;
  subscriptionBuilder(): SubscriptionBuilder;
  identity: Identity;
  connectionId: ConnectionId;
}

interface DbConnectionBuilder {
  withUri(uri: string): DbConnectionBuilder;
  withDatabaseName(name: string): DbConnectionBuilder;
  withToken(token: string): DbConnectionBuilder;
  withConfirmedReads(confirmed: boolean): DbConnectionBuilder;
  onConnect(cb: (conn: DbConnection, identity: Identity, token: string) => void): DbConnectionBuilder;
  onDisconnect(cb: (ctx: ErrorContext, error: Error | null) => void): DbConnectionBuilder;
  onConnectError(cb: (ctx: ErrorContext, error: Error) => void): DbConnectionBuilder;
  build(): DbConnection;
}

const DbConnection = {
  builder(): DbConnectionBuilder {
    throw new Error(
      "Stub module_bindings: run `spacetime generate` to create real bindings. " +
      "See src/module_bindings/index.ts for instructions."
    );
  },
} as unknown as { builder(): DbConnectionBuilder } & { new (): DbConnection };

export { DbConnection };

/* ------------------------------------------------------------------ */
/*  Table refs for subscriptions (tables.block, tables.contest, etc.) */
/* ------------------------------------------------------------------ */

export const tables = {
  block: "block" as unknown,
  userProfile: "user_profile" as unknown,
  likeRecord: "like_record" as unknown,
  adPlacement: "ad_placement" as unknown,
  contest: "contest" as unknown,
  transactionLog: "transaction_log" as unknown,
  contestWinner: "contest_winner" as unknown,
};
