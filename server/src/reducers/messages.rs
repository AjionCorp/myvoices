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

// ─── send_message ─────────────────────────────────────────────────────────────

#[reducer]
pub fn send_message(
    ctx: &ReducerContext,
    recipient_identity: String,
    text: String,
) -> Result<(), String> {
    let caller = caller_str(ctx);

    if caller == recipient_identity {
        return Err("Cannot send a message to yourself".to_string());
    }

    let trimmed = text.trim().to_string();
    if trimmed.is_empty() {
        return Err("Message cannot be empty".to_string());
    }
    if trimmed.len() > 1000 {
        return Err("Message too long (max 1000 chars)".to_string());
    }

    // Verify recipient exists
    ctx.db
        .user_profile()
        .identity()
        .find(recipient_identity.clone())
        .ok_or("Recipient not found")?;

    ctx.db
        .direct_message()
        .try_insert(DirectMessage {
            id: 0,
            sender_identity: caller.clone(),
            recipient_identity: recipient_identity.clone(),
            text: trimmed,
            is_read: false,
            created_at: now_micros(ctx),
        })
        .map_err(|e| format!("Insert failed: {e}"))?;

    // Notify the recipient
    let actor_name = caller_name(ctx);
    let _ = ctx.db.notification().try_insert(Notification {
        id: 0,
        recipient_identity,
        actor_identity: caller,
        actor_name,
        notification_type: "new_message".to_string(),
        block_id: 0,
        comment_id: 0,
        is_read: false,
        created_at: now_micros(ctx),
    });

    Ok(())
}

// ─── mark_message_read ────────────────────────────────────────────────────────

#[reducer]
pub fn mark_message_read(ctx: &ReducerContext, message_id: u64) -> Result<(), String> {
    let caller = caller_str(ctx);

    let msg = ctx
        .db
        .direct_message()
        .id()
        .find(message_id)
        .ok_or("Message not found")?;

    if msg.recipient_identity != caller {
        return Err("Not authorized".to_string());
    }

    let updated = DirectMessage {
        is_read: true,
        ..msg
    };
    ctx.db.direct_message().id().update(updated);

    Ok(())
}

// ─── mark_all_messages_read ───────────────────────────────────────────────────

#[reducer]
pub fn mark_all_messages_read(
    ctx: &ReducerContext,
    other_identity: String,
) -> Result<(), String> {
    let caller = caller_str(ctx);

    let to_update: Vec<DirectMessage> = ctx
        .db
        .direct_message()
        .iter()
        .filter(|m| {
            m.recipient_identity == caller
                && m.sender_identity == other_identity
                && !m.is_read
        })
        .collect();

    for msg in to_update {
        let updated = DirectMessage {
            is_read: true,
            ..msg
        };
        ctx.db.direct_message().id().update(updated);
    }

    Ok(())
}
