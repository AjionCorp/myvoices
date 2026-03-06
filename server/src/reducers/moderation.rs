use spacetimedb::{reducer, ReducerContext, Table};
use crate::tables::*;

fn now_micros(ctx: &ReducerContext) -> u64 {
    ctx.timestamp.to_micros_since_unix_epoch() as u64
}

fn caller_str(ctx: &ReducerContext) -> String {
    ctx.sender().to_hex().to_string()
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

/// Check if either user has blocked the other.
/// Public so follow.rs and messages.rs can use it as a guard.
pub fn is_blocked(ctx: &ReducerContext, a: &str, b: &str) -> bool {
    ctx.db.user_block().iter().any(|bl| {
        (bl.blocker_identity == a && bl.blocked_identity == b)
            || (bl.blocker_identity == b && bl.blocked_identity == a)
    })
}

// ─── block_user ──────────────────────────────────────────────────────────────

#[reducer]
pub fn block_user(
    ctx: &ReducerContext,
    target_identity: String,
) -> Result<(), String> {
    let caller = caller_str(ctx);

    if caller == target_identity {
        return Err("Cannot block yourself".to_string());
    }

    // Verify target exists
    ctx.db
        .user_profile()
        .identity()
        .find(target_identity.clone())
        .ok_or("User not found")?;

    // Check not already blocked
    let already = ctx.db.user_block().iter().any(|bl| {
        bl.blocker_identity == caller && bl.blocked_identity == target_identity
    });
    if already {
        return Err("User is already blocked".to_string());
    }

    ctx.db
        .user_block()
        .try_insert(UserBlock {
            id: 0,
            blocker_identity: caller.clone(),
            blocked_identity: target_identity.clone(),
            created_at: now_micros(ctx),
        })
        .map_err(|e| format!("Insert failed: {e}"))?;

    // Remove follows in both directions
    let follows_to_remove: Vec<u64> = ctx
        .db
        .user_follow()
        .iter()
        .filter(|f| {
            (f.follower_identity == caller && f.following_identity == target_identity)
                || (f.follower_identity == target_identity && f.following_identity == caller)
        })
        .map(|f| f.id)
        .collect();

    let removed_count = follows_to_remove.len();
    for id in follows_to_remove {
        ctx.db.user_follow().id().delete(id);
    }

    log::info!(
        "User {} blocked {}. Removed {} follow relationships.",
        &caller[..12.min(caller.len())],
        &target_identity[..12.min(target_identity.len())],
        removed_count
    );

    Ok(())
}

// ─── unblock_user ────────────────────────────────────────────────────────────

#[reducer]
pub fn unblock_user(
    ctx: &ReducerContext,
    target_identity: String,
) -> Result<(), String> {
    let caller = caller_str(ctx);

    let block = ctx
        .db
        .user_block()
        .iter()
        .find(|bl| bl.blocker_identity == caller && bl.blocked_identity == target_identity)
        .ok_or("User is not blocked")?;

    ctx.db.user_block().id().delete(block.id);

    Ok(())
}

// ─── mute_user ───────────────────────────────────────────────────────────────

#[reducer]
pub fn mute_user(
    ctx: &ReducerContext,
    target_identity: String,
) -> Result<(), String> {
    let caller = caller_str(ctx);

    if caller == target_identity {
        return Err("Cannot mute yourself".to_string());
    }

    ctx.db
        .user_profile()
        .identity()
        .find(target_identity.clone())
        .ok_or("User not found")?;

    let already = ctx.db.user_mute().iter().any(|m| {
        m.muter_identity == caller && m.muted_identity == target_identity
    });
    if already {
        return Err("User is already muted".to_string());
    }

    ctx.db
        .user_mute()
        .try_insert(UserMute {
            id: 0,
            muter_identity: caller,
            muted_identity: target_identity,
            created_at: now_micros(ctx),
        })
        .map_err(|e| format!("Insert failed: {e}"))?;

    Ok(())
}

// ─── unmute_user ─────────────────────────────────────────────────────────────

#[reducer]
pub fn unmute_user(
    ctx: &ReducerContext,
    target_identity: String,
) -> Result<(), String> {
    let caller = caller_str(ctx);

    let mute = ctx
        .db
        .user_mute()
        .iter()
        .find(|m| m.muter_identity == caller && m.muted_identity == target_identity)
        .ok_or("User is not muted")?;

    ctx.db.user_mute().id().delete(mute.id);

    Ok(())
}

// ─── report_user ─────────────────────────────────────────────────────────────

const VALID_REASONS: &[&str] = &["spam", "harassment", "hate_speech", "impersonation", "other"];

#[reducer]
pub fn report_user(
    ctx: &ReducerContext,
    target_identity: String,
    reason: String,
    description: String,
) -> Result<(), String> {
    let caller = caller_str(ctx);

    if caller == target_identity {
        return Err("Cannot report yourself".to_string());
    }

    ctx.db
        .user_profile()
        .identity()
        .find(target_identity.clone())
        .ok_or("User not found")?;

    if !VALID_REASONS.contains(&reason.as_str()) {
        return Err(format!(
            "Invalid reason. Must be one of: {}",
            VALID_REASONS.join(", ")
        ));
    }

    if description.len() > 500 {
        return Err("Description too long (max 500 chars)".to_string());
    }

    ctx.db
        .user_report()
        .try_insert(UserReport {
            id: 0,
            reporter_identity: caller,
            reported_identity: target_identity,
            reason,
            description,
            status: "pending".to_string(),
            reviewed_by: String::new(),
            created_at: now_micros(ctx),
            reviewed_at: 0,
        })
        .map_err(|e| format!("Insert failed: {e}"))?;

    Ok(())
}

// ─── review_report (admin) ───────────────────────────────────────────────────

#[reducer]
pub fn review_report(
    ctx: &ReducerContext,
    report_id: u64,
    action: String,
) -> Result<(), String> {
    if !is_caller_admin(ctx) {
        return Err("Only admins can review reports".to_string());
    }

    if action != "reviewed" && action != "dismissed" {
        return Err("Action must be 'reviewed' or 'dismissed'".to_string());
    }

    let report = ctx
        .db
        .user_report()
        .id()
        .find(report_id)
        .ok_or("Report not found")?;

    if report.status != "pending" {
        return Err("Report has already been reviewed".to_string());
    }

    let caller = caller_str(ctx);

    ctx.db.user_report().id().delete(report_id);
    ctx.db
        .user_report()
        .try_insert(UserReport {
            status: action,
            reviewed_by: caller,
            reviewed_at: now_micros(ctx),
            ..report
        })
        .map_err(|e| format!("Insert failed: {e}"))?;

    Ok(())
}

// ─── ban_user_from_topic ────────────────────────────────────────────────────

#[reducer]
pub fn ban_user_from_topic(
    ctx: &ReducerContext,
    topic_id: u64,
    target_identity: String,
    reason: String,
) -> Result<(), String> {
    let caller = caller_str(ctx);

    if caller == target_identity {
        return Err("Cannot ban yourself".to_string());
    }

    let topic = ctx.db.topic().id().find(topic_id).ok_or("Topic not found")?;

    // Must be topic owner, moderator, or admin
    let is_topic_owner = topic.creator_identity == caller;
    let is_mod = ctx.db.topic_moderator().iter().any(|m| m.topic_id == topic_id && m.identity == caller && m.status == "active");
    if !is_topic_owner && !is_mod && !is_caller_admin(ctx) {
        return Err("Not authorized — must be topic owner, moderator, or admin".to_string());
    }

    // Check not already banned
    let already = ctx.db.topic_ban().iter().any(|b| b.topic_id == topic_id && b.banned_identity == target_identity);
    if already {
        return Err("User is already banned from this topic".to_string());
    }

    if reason.len() > 500 {
        return Err("Reason too long (max 500 chars)".to_string());
    }

    ctx.db.topic_ban().try_insert(TopicBan {
        id: 0,
        topic_id,
        banned_identity: target_identity,
        banned_by: caller,
        reason,
        created_at: now_micros(ctx),
    }).map_err(|e| format!("Ban insert failed: {e}"))?;

    Ok(())
}

// ─── unban_user_from_topic ──────────────────────────────────────────────────

#[reducer]
pub fn unban_user_from_topic(
    ctx: &ReducerContext,
    topic_id: u64,
    target_identity: String,
) -> Result<(), String> {
    let caller = caller_str(ctx);

    let topic = ctx.db.topic().id().find(topic_id).ok_or("Topic not found")?;

    let is_topic_owner = topic.creator_identity == caller;
    let is_mod = ctx.db.topic_moderator().iter().any(|m| m.topic_id == topic_id && m.identity == caller && m.status == "active");
    if !is_topic_owner && !is_mod && !is_caller_admin(ctx) {
        return Err("Not authorized".to_string());
    }

    let ban = ctx.db.topic_ban().iter()
        .find(|b| b.topic_id == topic_id && b.banned_identity == target_identity)
        .ok_or("User is not banned from this topic")?;

    ctx.db.topic_ban().id().delete(ban.id);

    Ok(())
}
