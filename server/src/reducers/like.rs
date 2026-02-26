use spacetimedb::reducer;
use spacetimedb::ReducerContext;
use crate::tables::*;

#[reducer]
pub fn like_video(ctx: &ReducerContext, block_id: u32) -> Result<(), String> {
    let caller = ctx.sender().to_hex();

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

    // Remove any existing dislike from this user
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

    ctx.db.like_record().insert(LikeRecord {
        id: 0,
        block_id,
        user_identity: caller,
        created_at: ctx.timestamp.to_micros_since_epoch(),
    });

    ctx.db.block().id().delete(block_id);
    ctx.db.block().insert(Block {
        likes: block.likes + 1,
        dislikes: block.dislikes.saturating_sub(dislikes_delta),
        ..block
    });

    Ok(())
}

#[reducer]
pub fn unlike_video(ctx: &ReducerContext, block_id: u32) -> Result<(), String> {
    let caller = ctx.sender().to_hex();

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
    ctx.db.block().insert(Block {
        likes: new_likes,
        ..block
    });

    Ok(())
}

#[reducer]
pub fn dislike_video(ctx: &ReducerContext, block_id: u32) -> Result<(), String> {
    let caller = ctx.sender().to_hex();

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

    // Remove any existing like from this user
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

    ctx.db.dislike_record().insert(DislikeRecord {
        id: 0,
        block_id,
        user_identity: caller,
        created_at: ctx.timestamp.to_micros_since_epoch(),
    });

    ctx.db.block().id().delete(block_id);
    ctx.db.block().insert(Block {
        likes: block.likes.saturating_sub(likes_delta),
        dislikes: block.dislikes + 1,
        ..block
    });

    Ok(())
}

#[reducer]
pub fn undislike_video(ctx: &ReducerContext, block_id: u32) -> Result<(), String> {
    let caller = ctx.sender().to_hex();

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
    ctx.db.block().insert(Block {
        dislikes: new_dislikes,
        ..block
    });

    Ok(())
}
