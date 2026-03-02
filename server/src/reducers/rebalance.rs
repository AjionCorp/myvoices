use spacetimedb::{reducer, ReducerContext, Table};
use crate::tables::*;
use crate::reducers::topic::{spiral_coords, block_score};

/// Re-sort claimed blocks within a topic by combined score
/// (YouTube metrics + platform likes/dislikes), reassigning their spiral
/// positions so high-scoring blocks appear near the centre.
///
/// This is an admin-only operation and should only be run when explicitly desired,
/// since it changes every block's (x, y) position.
#[reducer]
pub fn rebalance_topic(ctx: &ReducerContext, topic_id: u64, batch_size: u32) -> Result<(), String> {
    let caller = ctx.sender().to_hex().to_string();
    let user = ctx.db.user_profile().identity().find(caller);
    if !user.map(|u| u.is_admin).unwrap_or(false) {
        return Err("Only admins can trigger rebalance".to_string());
    }

    let mut claimed_blocks: Vec<Block> = ctx
        .db
        .block()
        .iter()
        .filter(|b| b.topic_id == topic_id && b.status == "claimed")
        .collect();

    claimed_blocks.sort_by(|a, b| block_score(b).cmp(&block_score(a)));

    let limit = (batch_size as usize).min(claimed_blocks.len());
    for (i, block) in claimed_blocks.iter().take(limit).enumerate() {
        let (new_x, new_y) = spiral_coords(i as u64);
        if block.x != new_x || block.y != new_y {
            ctx.db.block().id().delete(block.id);
            ctx.db.block().try_insert(Block {
                x: new_x,
                y: new_y,
                ..block.clone()
            }).map_err(|e| format!("Insert failed: {e}"))?;
        }
    }

    log::info!("Rebalanced {} blocks in topic {}", limit, topic_id);
    Ok(())
}
