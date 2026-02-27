use spacetimedb::{reducer, ReducerContext, Table};
use crate::tables::*;

const GRID_COLS: u32 = 1250;

fn now_micros(ctx: &ReducerContext) -> u64 {
    ctx.timestamp.to_micros_since_unix_epoch() as u64
}

#[reducer]
pub fn claim_block(
    ctx: &ReducerContext,
    block_id: u32,
    video_url: String,
    thumbnail_url: String,
    platform: String,
    owner_name: String,
) -> Result<(), String> {
    let caller = ctx.sender().to_hex().to_string();

    let existing = ctx.db.block().id().find(block_id);
    if let Some(block) = existing {
        if block.status != "empty" {
            return Err("Block is already claimed".to_string());
        }
        ctx.db.block().id().delete(block_id);
    }

    ctx.db.block().try_insert(Block {
        id: block_id,
        x: (block_id % GRID_COLS) as i32,
        y: (block_id / GRID_COLS) as i32,
        video_url,
        thumbnail_url,
        platform,
        owner_identity: caller,
        owner_name,
        likes: 0,
        dislikes: 0,
        status: "claimed".to_string(),
        ad_image_url: String::new(),
        ad_link_url: String::new(),
        claimed_at: now_micros(ctx),
    }).map_err(|e| format!("Insert failed: {e}"))?;

    Ok(())
}

#[reducer]
pub fn unclaim_block(ctx: &ReducerContext, block_id: u32) -> Result<(), String> {
    let caller = ctx.sender().to_hex().to_string();

    let block = ctx
        .db
        .block()
        .id()
        .find(block_id)
        .ok_or("Block not found")?;

    let user = ctx.db.user_profile().identity().find(caller.clone());
    let is_admin = user.map(|u| u.is_admin).unwrap_or(false);

    if block.owner_identity != caller && !is_admin {
        return Err("Not authorized".to_string());
    }

    ctx.db.block().id().delete(block_id);
    ctx.db.block().try_insert(Block {
        id: block_id,
        x: block.x,
        y: block.y,
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

    Ok(())
}
