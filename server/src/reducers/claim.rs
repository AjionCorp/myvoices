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

/// Remove a block from a topic — topic owner, moderator, or admin only.
#[reducer]
pub fn mod_remove_block(ctx: &ReducerContext, block_id: u64) -> Result<(), String> {
    let caller = ctx.sender().to_hex().to_string();

    let block = ctx
        .db
        .block()
        .id()
        .find(block_id)
        .ok_or("Block not found")?;

    let topic_id = block.topic_id;

    // Check authorization: admin, topic creator, or topic moderator
    let user = ctx.db.user_profile().identity().find(caller.clone());
    let is_admin = user.map(|u| u.is_admin).unwrap_or(false);

    let topic = ctx.db.topic().id().find(topic_id).ok_or("Topic not found")?;
    let is_topic_owner = topic.creator_identity == caller;

    let is_mod = ctx
        .db
        .topic_moderator()
        .iter()
        .any(|m| m.topic_id == topic_id && m.identity == caller && m.status == "active");

    if !is_admin && !is_topic_owner && !is_mod {
        return Err("Not authorized — must be topic owner, moderator, or admin".to_string());
    }

    // Delete the block
    ctx.db.block().id().delete(block_id);

    // Decrement video_count
    if let Some(t) = ctx.db.topic().id().find(topic_id) {
        let new_count = t.video_count.saturating_sub(1);
        ctx.db.topic().id().delete(topic_id);
        ctx.db.topic().try_insert(Topic {
            video_count: new_count,
            ..t
        }).map_err(|e| format!("Topic update failed: {e}"))?;
    }

    // Rebalance remaining blocks
    let mut claimed: Vec<Block> = ctx
        .db
        .block()
        .iter()
        .filter(|b| b.topic_id == topic_id && b.status == "claimed")
        .collect();

    claimed.sort_by(|a, b| block_score(b).cmp(&block_score(a)));

    for (i, blk) in claimed.iter().enumerate() {
        let (new_x, new_y) = spiral_coords(i as u64);
        if blk.x != new_x || blk.y != new_y {
            ctx.db.block().id().delete(blk.id);
            ctx.db.block().try_insert(Block {
                x: new_x,
                y: new_y,
                ..blk.clone()
            }).map_err(|e| format!("Rebalance insert failed: {e}"))?;
        }
    }

    Ok(())
}

/// Edit a block — swap the video URL. Only the block owner can do this.
/// Resets likes/dislikes and yt metrics since it's a different video.
#[reducer]
pub fn edit_block(
    ctx: &ReducerContext,
    block_id: u64,
    new_video_id: String,
    new_platform: String,
    new_thumbnail_url: String,
    new_yt_views: u64,
    new_yt_likes: u64,
) -> Result<(), String> {
    let caller = ctx.sender().to_hex().to_string();

    let block = ctx.db.block().id().find(block_id).ok_or("Block not found")?;

    if block.owner_identity != caller {
        return Err("Only the block owner can edit their video".to_string());
    }
    if block.status != "claimed" {
        return Err("Block is not claimed".to_string());
    }
    if new_video_id.trim().is_empty() {
        return Err("video_id cannot be empty".to_string());
    }

    // Check for duplicate in same topic
    let vid_trimmed = new_video_id.trim();
    for existing in ctx.db.block().iter() {
        if existing.topic_id == block.topic_id
            && existing.video_id == vid_trimmed
            && existing.status == "claimed"
            && existing.id != block_id
        {
            return Err("This video is already in this topic".to_string());
        }
    }

    // Remove old like/dislike records for this block
    let like_ids: Vec<u64> = ctx.db.like_record().iter()
        .filter(|l| l.block_id == block_id)
        .map(|l| l.id).collect();
    for id in like_ids { ctx.db.like_record().id().delete(id); }

    let dislike_ids: Vec<u64> = ctx.db.dislike_record().iter()
        .filter(|d| d.block_id == block_id)
        .map(|d| d.id).collect();
    for id in dislike_ids { ctx.db.dislike_record().id().delete(id); }

    // Update topic totals
    if let Some(topic) = ctx.db.topic().id().find(block.topic_id) {
        ctx.db.topic().id().delete(block.topic_id);
        let _ = ctx.db.topic().try_insert(Topic {
            total_likes: topic.total_likes.saturating_sub(block.likes),
            total_dislikes: topic.total_dislikes.saturating_sub(block.dislikes),
            ..topic
        });
    }

    ctx.db.block().id().delete(block_id);
    ctx.db.block().try_insert(Block {
        video_id: new_video_id,
        platform: new_platform,
        thumbnail_url: new_thumbnail_url,
        yt_views: new_yt_views,
        yt_likes: new_yt_likes,
        likes: 0,
        dislikes: 0,
        claimed_at: ctx.timestamp.to_micros_since_unix_epoch() as u64,
        ..block
    }).map_err(|e| format!("Block update failed: {e}"))?;

    // Rebalance
    let mut remaining: Vec<Block> = ctx.db.block().iter()
        .filter(|b| b.topic_id == block.topic_id && b.status == "claimed")
        .collect();
    remaining.sort_by(|a, b| block_score(b).cmp(&block_score(a)));
    for (i, rb) in remaining.iter().enumerate() {
        let (nx, ny) = spiral_coords(i as u64);
        if rb.x != nx || rb.y != ny {
            ctx.db.block().id().delete(rb.id);
            let _ = ctx.db.block().try_insert(Block { x: nx, y: ny, ..rb.clone() });
        }
    }

    Ok(())
}
