use spacetimedb::{reducer, ReducerContext, Table};
use crate::tables::*;

fn now_micros(ctx: &ReducerContext) -> u64 {
    ctx.timestamp.to_micros_since_unix_epoch() as u64
}

fn caller_name(ctx: &ReducerContext) -> String {
    let identity = ctx.sender().to_hex().to_string();
    ctx.db
        .user_profile()
        .identity()
        .find(identity)
        .map(|u| u.display_name)
        .unwrap_or_else(|| "Anonymous".to_string())
}

fn insert_video_like_notification(
    ctx: &ReducerContext,
    recipient_identity: String,
    actor_identity: String,
    block_id: u64,
) {
    if recipient_identity == actor_identity {
        return;
    }
    let _ = ctx.db.notification().try_insert(Notification {
        id: 0,
        recipient_identity,
        actor_identity: actor_identity.clone(),
        actor_name: caller_name(ctx),
        notification_type: "video_like".to_string(),
        block_id,
        comment_id: 0,
        is_read: false,
        created_at: now_micros(ctx),
    });
}

fn update_topic_likes(ctx: &ReducerContext, topic_id: u64, delta: i64) {
    if let Some(topic) = ctx.db.topic().id().find(topic_id) {
        ctx.db.topic().id().delete(topic_id);
        let new_likes = if delta > 0 {
            topic.total_likes.saturating_add(delta as u64)
        } else {
            topic.total_likes.saturating_sub((-delta) as u64)
        };
        let _ = ctx.db.topic().try_insert(Topic { total_likes: new_likes, ..topic });
    }
}

fn update_topic_dislikes(ctx: &ReducerContext, topic_id: u64, delta: i64) {
    if let Some(topic) = ctx.db.topic().id().find(topic_id) {
        ctx.db.topic().id().delete(topic_id);
        let new_dislikes = if delta > 0 {
            topic.total_dislikes.saturating_add(delta as u64)
        } else {
            topic.total_dislikes.saturating_sub((-delta) as u64)
        };
        let _ = ctx.db.topic().try_insert(Topic { total_dislikes: new_dislikes, ..topic });
    }
}

#[reducer]
pub fn like_video(ctx: &ReducerContext, block_id: u64) -> Result<(), String> {
    let caller = ctx.sender().to_hex().to_string();

    let block = ctx
        .db
        .block()
        .id()
        .find(block_id)
        .ok_or("Block not found")?;

    if block.status != "claimed" {
        return Err("Block has no video".to_string());
    }

    if block.owner_identity == caller {
        return Err("Cannot like your own video".to_string());
    }

    for like in ctx.db.like_record().iter() {
        if like.block_id == block_id && like.user_identity == caller {
            return Err("Already liked this video".to_string());
        }
    }

    let mut dislike_to_remove: Option<u64> = None;
    for dislike in ctx.db.dislike_record().iter() {
        if dislike.block_id == block_id && dislike.user_identity == caller {
            dislike_to_remove = Some(dislike.id);
            break;
        }
    }
    let dislikes_delta = if let Some(did) = dislike_to_remove {
        ctx.db.dislike_record().id().delete(did);
        if block.dislikes > 0 { 1u64 } else { 0 }
    } else {
        0
    };

    ctx.db.like_record().try_insert(LikeRecord {
        id: 0,
        block_id,
        user_identity: caller.clone(),
        created_at: now_micros(ctx),
    }).map_err(|e| format!("Insert failed: {e}"))?;

    ctx.db.block().id().delete(block_id);
    ctx.db.block().try_insert(Block {
        likes: block.likes + 1,
        dislikes: block.dislikes.saturating_sub(dislikes_delta),
        ..block.clone()
    }).map_err(|e| format!("Insert failed: {e}"))?;

    update_topic_likes(ctx, block.topic_id, 1);
    if dislikes_delta > 0 {
        update_topic_dislikes(ctx, block.topic_id, -1);
    }

    insert_video_like_notification(ctx, block.owner_identity, caller, block_id);

    Ok(())
}

#[reducer]
pub fn unlike_video(ctx: &ReducerContext, block_id: u64) -> Result<(), String> {
    let caller = ctx.sender().to_hex().to_string();

    let block = ctx
        .db
        .block()
        .id()
        .find(block_id)
        .ok_or("Block not found")?;

    let mut found_like_id: Option<u64> = None;
    for like in ctx.db.like_record().iter() {
        if like.block_id == block_id && like.user_identity == caller {
            found_like_id = Some(like.id);
            break;
        }
    }

    let like_id = found_like_id.ok_or("You haven't liked this video")?;
    ctx.db.like_record().id().delete(like_id);

    let new_likes = if block.likes > 0 { block.likes - 1 } else { 0 };
    ctx.db.block().id().delete(block_id);
    ctx.db.block().try_insert(Block {
        likes: new_likes,
        ..block.clone()
    }).map_err(|e| format!("Insert failed: {e}"))?;

    update_topic_likes(ctx, block.topic_id, -1);

    Ok(())
}

#[reducer]
pub fn dislike_video(ctx: &ReducerContext, block_id: u64) -> Result<(), String> {
    let caller = ctx.sender().to_hex().to_string();

    let block = ctx
        .db
        .block()
        .id()
        .find(block_id)
        .ok_or("Block not found")?;

    if block.status != "claimed" {
        return Err("Block has no video".to_string());
    }

    if block.owner_identity == caller {
        return Err("Cannot dislike your own video".to_string());
    }

    for dislike in ctx.db.dislike_record().iter() {
        if dislike.block_id == block_id && dislike.user_identity == caller {
            return Err("Already disliked this video".to_string());
        }
    }

    let mut like_to_remove: Option<u64> = None;
    for like in ctx.db.like_record().iter() {
        if like.block_id == block_id && like.user_identity == caller {
            like_to_remove = Some(like.id);
            break;
        }
    }
    let likes_delta = if let Some(lid) = like_to_remove {
        ctx.db.like_record().id().delete(lid);
        if block.likes > 0 { 1u64 } else { 0 }
    } else {
        0
    };

    ctx.db.dislike_record().try_insert(DislikeRecord {
        id: 0,
        block_id,
        user_identity: caller,
        created_at: now_micros(ctx),
    }).map_err(|e| format!("Insert failed: {e}"))?;

    ctx.db.block().id().delete(block_id);
    ctx.db.block().try_insert(Block {
        likes: block.likes.saturating_sub(likes_delta),
        dislikes: block.dislikes + 1,
        ..block.clone()
    }).map_err(|e| format!("Insert failed: {e}"))?;

    update_topic_dislikes(ctx, block.topic_id, 1);
    if likes_delta > 0 {
        update_topic_likes(ctx, block.topic_id, -1);
    }

    Ok(())
}

#[reducer]
pub fn undislike_video(ctx: &ReducerContext, block_id: u64) -> Result<(), String> {
    let caller = ctx.sender().to_hex().to_string();

    let block = ctx
        .db
        .block()
        .id()
        .find(block_id)
        .ok_or("Block not found")?;

    let mut found_dislike_id: Option<u64> = None;
    for dislike in ctx.db.dislike_record().iter() {
        if dislike.block_id == block_id && dislike.user_identity == caller {
            found_dislike_id = Some(dislike.id);
            break;
        }
    }

    let dislike_id = found_dislike_id.ok_or("You haven't disliked this video")?;
    ctx.db.dislike_record().id().delete(dislike_id);

    let new_dislikes = if block.dislikes > 0 { block.dislikes - 1 } else { 0 };
    ctx.db.block().id().delete(block_id);
    ctx.db.block().try_insert(Block {
        dislikes: new_dislikes,
        ..block.clone()
    }).map_err(|e| format!("Insert failed: {e}"))?;

    update_topic_dislikes(ctx, block.topic_id, -1);

    Ok(())
}
