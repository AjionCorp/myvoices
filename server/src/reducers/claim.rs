use spacetimedb::{reducer, ReducerContext, Table};
use crate::tables::*;

/// Unclaim a block — removes it from the grid.
/// The topic's video_count is NOT decremented to prevent spiral position reuse.
#[reducer]
pub fn unclaim_block(ctx: &ReducerContext, block_id: u64) -> Result<(), String> {
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

    Ok(())
}
