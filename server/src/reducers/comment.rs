use spacetimedb::{reducer, ReducerContext, Table};
use crate::tables::*;

fn now_micros(ctx: &ReducerContext) -> u64 {
    ctx.timestamp.to_micros_since_unix_epoch() as u64
}

fn caller_str(ctx: &ReducerContext) -> String {
    ctx.sender().to_hex().to_string()
}

fn caller_name(ctx: &ReducerContext) -> String {
    let identity = caller_str(ctx);
    ctx.db
        .user_profile()
        .identity()
        .find(identity)
        .map(|u| u.display_name)
        .unwrap_or_else(|| "Anonymous".to_string())
}

fn is_caller_admin(ctx: &ReducerContext) -> bool {
    let identity = caller_str(ctx);
    ctx.db
        .user_profile()
        .identity()
        .find(identity)
        .map(|u| u.is_admin)
        .unwrap_or(false)
}

fn insert_notification(
    ctx: &ReducerContext,
    recipient_identity: String,
    actor_identity: String,
    actor_name: String,
    notification_type: &str,
    block_id: u64,
    comment_id: u64,
) {
    // Never notify yourself
    if recipient_identity == actor_identity {
        return;
    }
    let _ = ctx.db.notification().try_insert(Notification {
        id: 0,
        recipient_identity,
        actor_identity,
        actor_name,
        notification_type: notification_type.to_string(),
        block_id,
        comment_id,
        is_read: false,
        created_at: now_micros(ctx),
    });
}

// ─── add_comment ─────────────────────────────────────────────────────────────

#[reducer]
pub fn add_comment(
    ctx: &ReducerContext,
    block_id: u64,
    text: String,
    parent_comment_id: Option<u64>,
) -> Result<(), String> {
    let caller = caller_str(ctx);

    let block = ctx.db.block().id().find(block_id).ok_or("Block not found")?;
    if block.status != "claimed" {
        return Err("Block has no video".to_string());
    }

    let trimmed = text.trim().to_string();
    if trimmed.is_empty() {
        return Err("Comment cannot be empty".to_string());
    }
    if trimmed.len() > 280 {
        return Err("Comment too long (max 280 chars)".to_string());
    }

    // Validate parent exists if this is a reply
    if let Some(parent_id) = parent_comment_id {
        let parent = ctx
            .db
            .comment()
            .id()
            .find(parent_id)
            .ok_or("Parent comment not found")?;

        // Insert the reply
        let comment_id = ctx
            .db
            .comment()
            .try_insert(Comment {
                id: 0,
                block_id,
                user_identity: caller.clone(),
                user_name: caller_name(ctx),
                text: trimmed,
                created_at: now_micros(ctx),
                parent_comment_id: Some(parent_id),
                repost_of_id: None,
                likes_count: 0,
                replies_count: 0,
                reposts_count: 0,
                edited_at: 0,
            })
            .map_err(|e| format!("Insert failed: {e}"))?
            .id;

        // Increment parent's reply count
        let updated_parent = Comment {
            replies_count: parent.replies_count + 1,
            ..parent
        };
        ctx.db.comment().id().update(updated_parent.clone());

        // Notify the parent comment author
        insert_notification(
            ctx,
            updated_parent.user_identity,
            caller,
            caller_name(ctx),
            "comment_reply",
            block_id,
            comment_id,
        );
    } else {
        // Top-level comment
        ctx.db
            .comment()
            .try_insert(Comment {
                id: 0,
                block_id,
                user_identity: caller,
                user_name: caller_name(ctx),
                text: trimmed,
                created_at: now_micros(ctx),
                parent_comment_id: None,
                repost_of_id: None,
                likes_count: 0,
                replies_count: 0,
                reposts_count: 0,
                edited_at: 0,
            })
            .map_err(|e| format!("Insert failed: {e}"))?;
    }

    Ok(())
}

// ─── repost_comment ───────────────────────────────────────────────────────────

#[reducer]
pub fn repost_comment(
    ctx: &ReducerContext,
    block_id: u64,
    original_comment_id: u64,
    text: String,
) -> Result<(), String> {
    let caller = caller_str(ctx);

    let block = ctx.db.block().id().find(block_id).ok_or("Block not found")?;
    if block.status != "claimed" {
        return Err("Block has no video".to_string());
    }

    let original = ctx
        .db
        .comment()
        .id()
        .find(original_comment_id)
        .ok_or("Original comment not found")?;

    let trimmed = text.trim().to_string();
    if trimmed.len() > 280 {
        return Err("Quote text too long (max 280 chars)".to_string());
    }

    let comment_id = ctx
        .db
        .comment()
        .try_insert(Comment {
            id: 0,
            block_id,
            user_identity: caller.clone(),
            user_name: caller_name(ctx),
            text: trimmed,
            created_at: now_micros(ctx),
            parent_comment_id: None,
            repost_of_id: Some(original_comment_id),
            likes_count: 0,
            replies_count: 0,
            reposts_count: 0,
            edited_at: 0,
        })
        .map_err(|e| format!("Insert failed: {e}"))?
        .id;

    // Increment original's repost count
    let updated_original = Comment {
        reposts_count: original.reposts_count + 1,
        ..original.clone()
    };
    ctx.db.comment().id().update(updated_original);

    // Notify original author
    insert_notification(
        ctx,
        original.user_identity,
        caller,
        caller_name(ctx),
        "comment_repost",
        block_id,
        comment_id,
    );

    Ok(())
}

// ─── like_comment ─────────────────────────────────────────────────────────────

#[reducer]
pub fn like_comment(ctx: &ReducerContext, comment_id: u64) -> Result<(), String> {
    let caller = caller_str(ctx);

    let comment = ctx
        .db
        .comment()
        .id()
        .find(comment_id)
        .ok_or("Comment not found")?;

    // Idempotent: skip if already liked
    let already_liked = ctx
        .db
        .comment_like()
        .iter()
        .any(|l| l.comment_id == comment_id && l.user_identity == caller);

    if already_liked {
        return Ok(());
    }

    ctx.db
        .comment_like()
        .try_insert(CommentLike {
            id: 0,
            comment_id,
            user_identity: caller.clone(),
            created_at: now_micros(ctx),
        })
        .map_err(|e| format!("Insert failed: {e}"))?;

    // Increment like count
    let updated = Comment {
        likes_count: comment.likes_count + 1,
        ..comment.clone()
    };
    ctx.db.comment().id().update(updated);

    // Notify comment author
    insert_notification(
        ctx,
        comment.user_identity,
        caller,
        caller_name(ctx),
        "comment_like",
        comment.block_id,
        comment_id,
    );

    Ok(())
}

// ─── unlike_comment ───────────────────────────────────────────────────────────

#[reducer]
pub fn unlike_comment(ctx: &ReducerContext, comment_id: u64) -> Result<(), String> {
    let caller = caller_str(ctx);

    let comment = ctx
        .db
        .comment()
        .id()
        .find(comment_id)
        .ok_or("Comment not found")?;

    // Find and remove the like record
    let like_row = ctx
        .db
        .comment_like()
        .iter()
        .find(|l| l.comment_id == comment_id && l.user_identity == caller);

    if let Some(like) = like_row {
        ctx.db.comment_like().id().delete(like.id);

        let updated = Comment {
            likes_count: comment.likes_count.saturating_sub(1),
            ..comment
        };
        ctx.db.comment().id().update(updated);
    }

    Ok(())
}

// ─── edit_comment ────────────────────────────────────────────────────────────

#[reducer]
pub fn edit_comment(
    ctx: &ReducerContext,
    comment_id: u64,
    new_text: String,
) -> Result<(), String> {
    let caller = caller_str(ctx);

    let comment = ctx
        .db
        .comment()
        .id()
        .find(comment_id)
        .ok_or("Comment not found")?;

    if comment.user_identity != caller {
        return Err("Not authorized to edit this comment".to_string());
    }

    let trimmed = new_text.trim().to_string();
    if trimmed.is_empty() {
        return Err("Comment cannot be empty".to_string());
    }
    if trimmed.len() > 280 {
        return Err("Comment too long (max 280 chars)".to_string());
    }

    let updated = Comment {
        text: trimmed,
        edited_at: now_micros(ctx),
        ..comment
    };
    ctx.db.comment().id().update(updated);

    Ok(())
}

// ─── delete_comment ───────────────────────────────────────────────────────────

#[reducer]
pub fn delete_comment(ctx: &ReducerContext, comment_id: u64) -> Result<(), String> {
    let caller = caller_str(ctx);

    let comment = ctx
        .db
        .comment()
        .id()
        .find(comment_id)
        .ok_or("Comment not found")?;

    if comment.user_identity != caller && !is_caller_admin(ctx) {
        return Err("Not authorized".to_string());
    }

    // Cascade: delete all likes on this comment
    let like_ids: Vec<u64> = ctx
        .db
        .comment_like()
        .iter()
        .filter(|l| l.comment_id == comment_id)
        .map(|l| l.id)
        .collect();
    for id in like_ids {
        ctx.db.comment_like().id().delete(id);
    }

    // Cascade: delete all direct replies
    let reply_ids: Vec<u64> = ctx
        .db
        .comment()
        .iter()
        .filter(|c| c.parent_comment_id == Some(comment_id))
        .map(|c| c.id)
        .collect();
    for rid in reply_ids {
        // Also delete likes on each reply
        let child_like_ids: Vec<u64> = ctx
            .db
            .comment_like()
            .iter()
            .filter(|l| l.comment_id == rid)
            .map(|l| l.id)
            .collect();
        for lid in child_like_ids {
            ctx.db.comment_like().id().delete(lid);
        }
        ctx.db.comment().id().delete(rid);
    }

    // Update parent's reply count if this was a reply
    if let Some(parent_id) = comment.parent_comment_id {
        if let Some(parent) = ctx.db.comment().id().find(parent_id) {
            let updated = Comment {
                replies_count: parent.replies_count.saturating_sub(1),
                ..parent
            };
            ctx.db.comment().id().update(updated);
        }
    }

    ctx.db.comment().id().delete(comment_id);
    Ok(())
}

// ─── mark_notification_read ───────────────────────────────────────────────────

#[reducer]
pub fn mark_notification_read(
    ctx: &ReducerContext,
    notification_id: u64,
) -> Result<(), String> {
    let caller = caller_str(ctx);

    let notif = ctx
        .db
        .notification()
        .id()
        .find(notification_id)
        .ok_or("Notification not found")?;

    if notif.recipient_identity != caller {
        return Err("Not authorized".to_string());
    }

    let updated = Notification {
        is_read: true,
        ..notif
    };
    ctx.db.notification().id().update(updated);

    Ok(())
}

// ─── mark_all_notifications_read ─────────────────────────────────────────────

#[reducer]
pub fn mark_all_notifications_read(ctx: &ReducerContext) -> Result<(), String> {
    let caller = caller_str(ctx);

    let to_update: Vec<Notification> = ctx
        .db
        .notification()
        .iter()
        .filter(|n| n.recipient_identity == caller && !n.is_read)
        .collect();

    for notif in to_update {
        let updated = Notification {
            is_read: true,
            ..notif
        };
        ctx.db.notification().id().update(updated);
    }

    Ok(())
}
