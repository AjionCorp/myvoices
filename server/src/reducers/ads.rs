use spacetimedb::{reducer, ReducerContext, Table};
use crate::tables::*;

fn now_micros(ctx: &ReducerContext) -> u64 {
    ctx.timestamp.to_micros_since_unix_epoch() as u64
}

/// Register an ad placement for a topic. Block IDs in the JSON array refer to
/// existing blocks that will be marked as "ad" status.
#[reducer]
pub fn place_ad(
    ctx: &ReducerContext,
    topic_id: u64,
    block_ids_json: String,
    ad_image_url: String,
    ad_link_url: String,
    duration_days: u64,
) -> Result<(), String> {
    let caller = ctx.sender().to_hex().to_string();
    let user = ctx
        .db
        .user_profile()
        .identity()
        .find(caller.clone())
        .ok_or("User not found")?;

    if !user.is_admin {
        return Err("Only admins can place ads".to_string());
    }

    let block_ids: Vec<u64> =
        serde_json::from_str(&block_ids_json).map_err(|e| format!("Invalid block IDs: {}", e))?;

    for &bid in &block_ids {
        let block = ctx.db.block().id().find(bid)
            .ok_or_else(|| format!("Block {} does not exist", bid))?;
        if block.status == "claimed" {
            return Err(format!("Block {} is already claimed by a user", bid));
        }
    }

    let now = now_micros(ctx);
    let expires = now + duration_days * 86_400_000_000;

    ctx.db.ad_placement().try_insert(AdPlacement {
        id: 0,
        topic_id,
        block_ids_json: block_ids_json.clone(),
        ad_image_url: ad_image_url.clone(),
        ad_link_url: ad_link_url.clone(),
        owner_identity: caller,
        paid: false,
        created_at: now,
        expires_at: expires,
    }).map_err(|e| format!("Insert failed: {e}"))?;

    // Mark blocks as ad status
    for &bid in &block_ids {
        if let Some(block) = ctx.db.block().id().find(bid) {
            ctx.db.block().id().delete(bid);
            ctx.db.block().try_insert(Block {
                status: "ad".to_string(),
                ad_image_url: ad_image_url.clone(),
                ad_link_url: ad_link_url.clone(),
                ..block
            }).map_err(|e| format!("Block update failed: {e}"))?;
        }
    }

    Ok(())
}

#[reducer]
pub fn remove_ad(ctx: &ReducerContext, ad_id: u64) -> Result<(), String> {
    let caller = ctx.sender().to_hex().to_string();
    let user = ctx.db.user_profile().identity().find(caller);
    if !user.map(|u| u.is_admin).unwrap_or(false) {
        return Err("Only admins can remove ads".to_string());
    }

    let ad = ctx
        .db
        .ad_placement()
        .id()
        .find(ad_id)
        .ok_or("Ad not found")?;

    let block_ids: Vec<u64> =
        serde_json::from_str(&ad.block_ids_json)
            .map_err(|e| format!("Corrupted ad block_ids_json: {e}"))?;

    for &bid in &block_ids {
        if let Some(block) = ctx.db.block().id().find(bid) {
            ctx.db.block().id().delete(bid);
            ctx.db.block().try_insert(Block {
                status: "empty".to_string(),
                ad_image_url: String::new(),
                ad_link_url: String::new(),
                ..block
            }).map_err(|e| format!("Block update failed: {e}"))?;
        }
    }

    ctx.db.ad_placement().id().delete(ad_id);
    Ok(())
}

#[reducer]
pub fn mark_ad_paid(ctx: &ReducerContext, ad_id: u64) -> Result<(), String> {
    let caller = ctx.sender().to_hex().to_string();
    let user = ctx.db.user_profile().identity().find(caller);
    if !user.map(|u| u.is_admin).unwrap_or(false) {
        return Err("Only admins can mark ads as paid".to_string());
    }

    let ad = ctx
        .db
        .ad_placement()
        .id()
        .find(ad_id)
        .ok_or("Ad not found")?;

    ctx.db.ad_placement().id().delete(ad_id);
    ctx.db.ad_placement().try_insert(AdPlacement {
        paid: true,
        ..ad
    }).map_err(|e| format!("Insert failed: {e}"))?;

    Ok(())
}
