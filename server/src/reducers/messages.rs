use spacetimedb::{reducer, ReducerContext, Table};
use crate::tables::*;
use crate::reducers::follow::{canonical_pair, are_mutual_followers};

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

/// Find an existing conversation between two users (canonical pair lookup).
fn find_conversation(ctx: &ReducerContext, a: &str, b: &str) -> Option<Conversation> {
    let (pa, pb) = canonical_pair(a, b);
    ctx.db
        .conversation()
        .iter()
        .find(|c| c.participant_a == pa && c.participant_b == pb)
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

    if crate::reducers::moderation::is_blocked(ctx, &caller, &recipient_identity) {
        return Err("Cannot message a blocked user".to_string());
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

    let now = now_micros(ctx);
    let mutual = are_mutual_followers(ctx, &caller, &recipient_identity);

    // Find or create conversation
    let conv = match find_conversation(ctx, &caller, &recipient_identity) {
        Some(existing) => {
            // If conversation was declined, only the original request_recipient can re-initiate
            if existing.status == "request_declined" {
                // Allow re-sending: reopen the conversation
                let new_status = if mutual {
                    "active".to_string()
                } else {
                    "request_pending".to_string()
                };
                let request_recipient = if mutual {
                    String::new()
                } else {
                    recipient_identity.clone()
                };
                let updated = Conversation {
                    status: new_status,
                    request_recipient,
                    updated_at: now,
                    ..existing
                };
                ctx.db.conversation().id().update(updated.clone());
                updated
            } else {
                // Update timestamp
                let updated = Conversation {
                    updated_at: now,
                    ..existing
                };
                ctx.db.conversation().id().update(updated.clone());
                updated
            }
        }
        None => {
            let (pa, pb) = canonical_pair(&caller, &recipient_identity);
            let status = if mutual {
                "active".to_string()
            } else {
                "request_pending".to_string()
            };
            let request_recipient = if mutual {
                String::new()
            } else {
                recipient_identity.clone()
            };
            ctx.db
                .conversation()
                .try_insert(Conversation {
                    id: 0,
                    participant_a: pa,
                    participant_b: pb,
                    status,
                    request_recipient,
                    created_at: now,
                    updated_at: now,
                })
                .map_err(|e| format!("Conversation insert failed: {e}"))?
        }
    };

    // Insert the message
    ctx.db
        .direct_message()
        .try_insert(DirectMessage {
            id: 0,
            conversation_id: conv.id,
            sender_identity: caller.clone(),
            recipient_identity: recipient_identity.clone(),
            text: trimmed,
            is_read: false,
            is_deleted: false,
            created_at: now,
        })
        .map_err(|e| format!("Message insert failed: {e}"))?;

    // Notify the recipient
    let actor_name = caller_name(ctx);
    let notif_type = if conv.status == "request_pending" {
        "message_request"
    } else {
        "new_message"
    };
    let _ = ctx.db.notification().try_insert(Notification {
        id: 0,
        recipient_identity,
        actor_identity: caller,
        actor_name,
        notification_type: notif_type.to_string(),
        block_id: 0,
        comment_id: 0,
        is_read: false,
        created_at: now,
    });

    Ok(())
}

// ─── accept_message_request ──────────────────────────────────────────────────

#[reducer]
pub fn accept_message_request(
    ctx: &ReducerContext,
    conversation_id: u64,
) -> Result<(), String> {
    let caller = caller_str(ctx);

    let conv = ctx
        .db
        .conversation()
        .id()
        .find(conversation_id)
        .ok_or("Conversation not found")?;

    if conv.request_recipient != caller {
        return Err("Not authorized".to_string());
    }
    if conv.status != "request_pending" {
        return Err("Not a pending request".to_string());
    }

    ctx.db.conversation().id().update(Conversation {
        status: "active".to_string(),
        request_recipient: String::new(),
        updated_at: now_micros(ctx),
        ..conv
    });

    Ok(())
}

// ─── decline_message_request ─────────────────────────────────────────────────

#[reducer]
pub fn decline_message_request(
    ctx: &ReducerContext,
    conversation_id: u64,
) -> Result<(), String> {
    let caller = caller_str(ctx);

    let conv = ctx
        .db
        .conversation()
        .id()
        .find(conversation_id)
        .ok_or("Conversation not found")?;

    if conv.request_recipient != caller {
        return Err("Not authorized".to_string());
    }
    if conv.status != "request_pending" {
        return Err("Not a pending request".to_string());
    }

    ctx.db.conversation().id().update(Conversation {
        status: "request_declined".to_string(),
        updated_at: now_micros(ctx),
        ..conv
    });

    Ok(())
}

// ─── delete_conversation ─────────────────────────────────────────────────────

#[reducer]
pub fn delete_conversation(
    ctx: &ReducerContext,
    conversation_id: u64,
) -> Result<(), String> {
    let caller = caller_str(ctx);

    let conv = ctx
        .db
        .conversation()
        .id()
        .find(conversation_id)
        .ok_or("Conversation not found")?;

    // Verify caller is a participant
    if conv.participant_a != caller && conv.participant_b != caller {
        return Err("Not authorized".to_string());
    }

    // Soft-delete all messages in this conversation
    let msgs: Vec<DirectMessage> = ctx
        .db
        .direct_message()
        .iter()
        .filter(|m| m.conversation_id == conversation_id && !m.is_deleted)
        .collect();

    for msg in msgs {
        ctx.db.direct_message().id().update(DirectMessage {
            is_deleted: true,
            ..msg
        });
    }

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

    ctx.db.direct_message().id().update(DirectMessage {
        is_read: true,
        ..msg
    });

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
        ctx.db.direct_message().id().update(DirectMessage {
            is_read: true,
            ..msg
        });
    }

    Ok(())
}
