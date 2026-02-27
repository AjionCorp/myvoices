use spacetimedb::{reducer, ReducerContext, Table};
use crate::tables::*;

fn now_micros(ctx: &ReducerContext) -> u64 {
    ctx.timestamp.to_micros_since_unix_epoch() as u64
}

#[reducer]
pub fn add_comment(
    ctx: &ReducerContext,
    block_id: u32,
    text: String,
) -> Result<(), String> {
    let caller = ctx.sender().to_hex().to_string();

    let block = ctx.db.block().id().find(block_id).ok_or("Block not found")?;
    if block.status != "claimed" {
        return Err("Block has no video".to_string());
    }

    if text.trim().is_empty() {
        return Err("Comment cannot be empty".to_string());
    }
    if text.len() > 500 {
        return Err("Comment too long (max 500 chars)".to_string());
    }

    let user = ctx.db.user_profile().identity().find(caller.clone());
    let user_name = user.map(|u| u.display_name).unwrap_or_else(|| "Anonymous".to_string());

    ctx.db.comment().try_insert(Comment {
        id: 0,
        block_id,
        user_identity: caller,
        user_name,
        text,
        created_at: now_micros(ctx),
    }).map_err(|e| format!("Insert failed: {e}"))?;

    Ok(())
}

#[reducer]
pub fn delete_comment(ctx: &ReducerContext, comment_id: u64) -> Result<(), String> {
    let caller = ctx.sender().to_hex().to_string();

    let comment = ctx.db.comment().id().find(comment_id).ok_or("Comment not found")?;

    let user = ctx.db.user_profile().identity().find(caller.clone());
    let is_admin = user.map(|u| u.is_admin).unwrap_or(false);

    if comment.user_identity != caller && !is_admin {
        return Err("Not authorized".to_string());
    }

    ctx.db.comment().id().delete(comment_id);
    Ok(())
}
