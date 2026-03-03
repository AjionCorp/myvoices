use spacetimedb::{reducer, ReducerContext, Table};
use crate::tables::*;
use crate::reducers::topic::{spiral_coords, block_score};

/// Unclaim a block — removes it from the grid.
/// Decrements the topic's video_count and rebalances remaining blocks.
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

    let topic_id = block.topic_id;

    ctx.db.block().id().delete(block_id);

    // Decrement video_count so the display reflects the actual number of live videos.
    if let Some(topic) = ctx.db.topic().id().find(topic_id) {
        let new_count = topic.video_count.saturating_sub(1);
        ctx.db.topic().id().delete(topic_id);
        ctx.db.topic().try_insert(Topic {
            video_count: new_count,
            ..topic
        }).map_err(|e| format!("Topic update failed: {e}"))?;
    }

    // Rebalance remaining claimed blocks so spiral positions stay compact.
    let mut claimed: Vec<Block> = ctx
        .db
        .block()
        .iter()
        .filter(|b| b.topic_id == topic_id && b.status == "claimed")
        .collect();

    claimed.sort_by(|a, b| block_score(b).cmp(&block_score(a)));

    for (i, block) in claimed.iter().enumerate() {
        let (new_x, new_y) = spiral_coords(i as u64);
        if block.x != new_x || block.y != new_y {
            ctx.db.block().id().delete(block.id);
            ctx.db.block().try_insert(Block {
                x: new_x,
                y: new_y,
                ..block.clone()
            }).map_err(|e| format!("Rebalance insert failed: {e}"))?;
        }
    }

    Ok(())
}
