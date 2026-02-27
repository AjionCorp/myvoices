use spacetimedb::{reducer, ReducerContext, Table};
use crate::tables::*;

const GRID_COLS: u32 = 1250;

fn now_micros(ctx: &ReducerContext) -> u64 {
    ctx.timestamp.to_micros_since_unix_epoch() as u64
}

#[reducer]
pub fn place_ad(
    ctx: &ReducerContext,
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

    let block_ids: Vec<u32> =
        serde_json::from_str(&block_ids_json).map_err(|e| format!("Invalid block IDs: {}", e))?;

    for &bid in &block_ids {
        let block = ctx.db.block().id().find(bid);
        if let Some(b) = &block {
            if b.status == "claimed" {
                return Err(format!("Block {} is already claimed by a user", bid));
            }
        }
    }

    let now = now_micros(ctx);
    let expires = now + duration_days * 86_400_000_000;

    ctx.db.ad_placement().try_insert(AdPlacement {
        id: 0,
        block_ids_json: block_ids_json.clone(),
        ad_image_url: ad_image_url.clone(),
        ad_link_url: ad_link_url.clone(),
        owner_identity: caller,
        paid: false,
        created_at: now,
        expires_at: expires,
    }).map_err(|e| format!("Insert failed: {e}"))?;

    for &bid in &block_ids {
        ctx.db.block().id().delete(bid);
        ctx.db.block().try_insert(Block {
            id: bid,
            x: (bid % GRID_COLS) as i32,
            y: (bid / GRID_COLS) as i32,
            video_url: String::new(),
            thumbnail_url: String::new(),
            platform: String::new(),
            owner_identity: String::new(),
            owner_name: String::new(),
            likes: 0,
            dislikes: 0,
            status: "ad".to_string(),
            ad_image_url: ad_image_url.clone(),
            ad_link_url: ad_link_url.clone(),
            claimed_at: now,
        }).map_err(|e| format!("Insert failed: {e}"))?;
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

    let block_ids: Vec<u32> =
        serde_json::from_str(&ad.block_ids_json).unwrap_or_default();

    for &bid in &block_ids {
        ctx.db.block().id().delete(bid);
        ctx.db.block().try_insert(Block {
            id: bid,
            x: (bid % GRID_COLS) as i32,
            y: (bid / GRID_COLS) as i32,
            video_url: String::new(),
            thumbnail_url: String::new(),
            platform: String::new(),
            owner_identity: String::new(),
            owner_name: String::new(),
            likes: 0,
            dislikes: 0,
            status: "empty".to_string(),
            ad_image_url: String::new(),
            ad_link_url: String::new(),
            claimed_at: 0,
        }).map_err(|e| format!("Insert failed: {e}"))?;
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
