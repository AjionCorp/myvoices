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

// ─── follow_user ─────────────────────────────────────────────────────────────

#[reducer]
pub fn follow_user(
    ctx: &ReducerContext,
    target_identity: String,
) -> Result<(), String> {
    let caller = caller_str(ctx);

    if caller == target_identity {
        return Err("Cannot follow yourself".to_string());
    }

    if crate::reducers::moderation::is_blocked(ctx, &caller, &target_identity) {
        return Err("Cannot follow a blocked user".to_string());
    }

    // Verify target exists
    ctx.db
        .user_profile()
        .identity()
        .find(target_identity.clone())
        .ok_or("User not found")?;

    // Check not already following
    let already = ctx
        .db
        .user_follow()
        .iter()
        .any(|f| f.follower_identity == caller && f.following_identity == target_identity);
    if already {
        return Err("Already following this user".to_string());
    }

    ctx.db
        .user_follow()
        .try_insert(UserFollow {
            id: 0,
            follower_identity: caller.clone(),
            following_identity: target_identity.clone(),
            created_at: now_micros(ctx),
        })
        .map_err(|e| format!("Insert failed: {e}"))?;

    // Notify the target
    let actor_name = caller_name(ctx);
    let _ = ctx.db.notification().try_insert(Notification {
        id: 0,
        recipient_identity: target_identity.clone(),
        actor_identity: caller.clone(),
        actor_name,
        notification_type: "new_follow".to_string(),
        block_id: 0,
        comment_id: 0,
        is_read: false,
        created_at: now_micros(ctx),
    });

    // Check if this creates a mutual follow — if so, auto-upgrade any pending conversation
    let is_mutual = ctx
        .db
        .user_follow()
        .iter()
        .any(|f| f.follower_identity == target_identity && f.following_identity == caller);

    if is_mutual {
        // Find any request_pending conversation between these two users
        let (pa, pb) = canonical_pair(&caller, &target_identity);
        if let Some(conv) = ctx
            .db
            .conversation()
            .iter()
            .find(|c| c.participant_a == pa && c.participant_b == pb && c.status == "request_pending")
        {
            ctx.db.conversation().id().update(Conversation {
                status: "active".to_string(),
                updated_at: now_micros(ctx),
                ..conv
            });
        }
    }

    Ok(())
}

// ─── unfollow_user ───────────────────────────────────────────────────────────

#[reducer]
pub fn unfollow_user(
    ctx: &ReducerContext,
    target_identity: String,
) -> Result<(), String> {
    let caller = caller_str(ctx);

    let follow = ctx
        .db
        .user_follow()
        .iter()
        .find(|f| f.follower_identity == caller && f.following_identity == target_identity)
        .ok_or("Not following this user")?;

    ctx.db.user_follow().id().delete(follow.id);

    Ok(())
}

// ─── helpers ─────────────────────────────────────────────────────────────────

pub fn canonical_pair(a: &str, b: &str) -> (String, String) {
    if a < b {
        (a.to_string(), b.to_string())
    } else {
        (b.to_string(), a.to_string())
    }
}

// ─── follow_topic ───────────────────────────────────────────────────────────

#[reducer]
pub fn follow_topic(
    ctx: &ReducerContext,
    topic_id: u64,
) -> Result<(), String> {
    let caller = caller_str(ctx);

    // Verify topic exists
    ctx.db
        .topic()
        .id()
        .find(topic_id)
        .ok_or("Topic not found")?;

    // Check not already following
    let already = ctx
        .db
        .topic_follow()
        .iter()
        .any(|f| f.follower_identity == caller && f.topic_id == topic_id);
    if already {
        return Err("Already following this topic".to_string());
    }

    ctx.db
        .topic_follow()
        .try_insert(TopicFollow {
            id: 0,
            follower_identity: caller,
            topic_id,
            created_at: now_micros(ctx),
        })
        .map_err(|e| format!("Insert failed: {e}"))?;

    Ok(())
}

// ─── unfollow_topic ─────────────────────────────────────────────────────────

#[reducer]
pub fn unfollow_topic(
    ctx: &ReducerContext,
    topic_id: u64,
) -> Result<(), String> {
    let caller = caller_str(ctx);

    let follow = ctx
        .db
        .topic_follow()
        .iter()
        .find(|f| f.follower_identity == caller && f.topic_id == topic_id)
        .ok_or("Not following this topic")?;

    ctx.db.topic_follow().id().delete(follow.id);

    Ok(())
}

pub fn are_mutual_followers(ctx: &ReducerContext, a: &str, b: &str) -> bool {
    let a_follows_b = ctx
        .db
        .user_follow()
        .iter()
        .any(|f| f.follower_identity == a && f.following_identity == b);
    let b_follows_a = ctx
        .db
        .user_follow()
        .iter()
        .any(|f| f.follower_identity == b && f.following_identity == a);
    a_follows_b && b_follows_a
}
