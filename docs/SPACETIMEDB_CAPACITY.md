# SpacetimeDB Capacity and Performance

## Data Volume / Max RAM

SpacetimeDB keeps all data in memory; there is no disk-backed storage. Your Maincloud instance size dictates limits (e.g. 512MB, 1GB, 2GB per plan).

### Approximate Row Sizes

| Table           | Est. bytes/row | Notes                                                                 |
| --------------- | -------------- | --------------------------------------------------------------------- |
| block           | ~150–250       | id, x, y, videoId, platform, ownerIdentity, ownerName, likes, dislikes, status, adImageUrl, adLinkUrl, claimedAt |
| user_profile    | ~200           | identity, displayName, email, stripeAccountId, totalEarnings, isAdmin, createdAt |
| comment         | ~120           | id, blockId, userIdentity, userName, text (~100)                      |
| like_record     | ~90            | id, blockId, userIdentity, createdAt                                 |
| dislike_record  | ~90            | same                                                                  |
| ad_placement    | ~200           | id, blockIdsJson, adImageUrl, adLinkUrl, ownerIdentity, paid, created, expires |
| contest         | ~50            | small                                                                |
| contest_winner  | ~150           | blockId, videoId, platform, ownerName, etc.                           |
| transaction_log | ~150           | tx_type, amount, identities, stripe_id, description                   |

### Scenario Estimates

| Scenario           | Blocks | Comments | Likes | Total rows (approx) | Est. RAM      |
| ------------------ | ------ | -------- | ----- | ------------------- | ------------- |
| Early              | 5k     | 2k       | 10k   | ~25k                | ~3–5 MB       |
| Growth             | 50k    | 20k      | 200k  | ~300k               | ~35–50 MB     |
| Heavy              | 200k   | 100k     | 1M    | ~1.5M               | ~150–200 MB   |
| Max (1M grid full) | 1M     | 500k     | 5M    | ~7M                 | ~700 MB–1 GB+ |

### What Max RAM Means for You

- **Rule of thumb:** Plan for ~150–200 bytes per row across all tables.
- With 2GB RAM and ~1GB for OS/runtime, you have ~1GB for data ≈ **5–7 million rows** before hitting limits.
- **Grid size:** `TOTAL_BLOCKS = 1,000,000` (1250×800). If every cell were claimed, that's 1M blocks + indexes + overhead.
- With typical usage (10–20% claimed), 100k–200k blocks is realistic.

### Environment: Viewport Subscriptions

When block count grows large, enable viewport-scoped subscriptions:

```
NEXT_PUBLIC_VIEWPORT_SUBSCRIPTION_THRESHOLD=20000
```

When set > 0, the client subscribes to all tables except `block`; `ViewportSubscriptionManager` creates the block subscription. Uses full grid initially, then expands bounds as the user pans (union of viewports).

### Recommendations

- Monitor row counts regularly (e.g. `spacetime sql` or dashboard).
- Add indexes for high-traffic lookups (see Reducer Audit below).
- Consider archival or retention policies for old `comment` and `transaction_log` rows.

---

## Reducer Audit

All reducers in `server/src/reducers/` are DB-only: no HTTP, no I/O. Findings:

| Reducer                                        | Verdict                                                                 |
| ---------------------------------------------- | ----------------------------------------------------------------------- |
| claim_block, unclaim_block                     | Fast; single block find/delete/insert                                  |
| like_video, unlike_video, dislike_video, undislike_video | **Potential issue:** iterate over all `like_record` and `dislike_record` rows — O(n) per like/dislike |
| place_ad, remove_ad, mark_ad_paid              | Fast; bounded loops over block_ids                                    |
| create_contest, finalize_contest               | finalize_contest iterates all blocks — O(n) but runs rarely (admin)   |
| add_comment, delete_comment                   | Fast                                                                   |
| rebalance_layout                               | Heavy but admin-only; spiral loop up to 2M iterations                  |
| register_user, update_stripe_account, set_admin | Fast                                                                   |

### Like/Dislike Index Recommendation

Add index-backed lookups for `like_record` and `dislike_record` by `(block_id, user_identity)`. SpacetimeDB tables support indexes. If this index does not exist, the current O(n) scan will degrade as like/dislike count grows. Check your table definitions and add a composite index when scaling.
