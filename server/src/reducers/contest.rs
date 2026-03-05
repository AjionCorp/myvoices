use spacetimedb::{reducer, ReducerContext, Table};
use crate::tables::*;

fn now_micros(ctx: &ReducerContext) -> u64 {
    ctx.timestamp.to_micros_since_unix_epoch() as u64
}

#[reducer]
pub fn create_contest(
    ctx: &ReducerContext,
    duration_days: u64,
    prize_pool: u64,
) -> Result<(), String> {
    let caller = ctx.sender().to_hex().to_string();
    let user = ctx.db.user_profile().identity().find(caller);
    if !user.map(|u| u.is_admin).unwrap_or(false) {
        return Err("Only admins can create contests".to_string());
    }

    for c in ctx.db.contest().iter() {
        if c.status == "active" {
            return Err("There is already an active contest".to_string());
        }
    }

    let now = now_micros(ctx);
    let end_at = now + duration_days * 86_400_000_000;

    ctx.db.contest().try_insert(Contest {
        id: 0,
        start_at: now,
        end_at,
        prize_pool,
        status: "active".to_string(),
    }).map_err(|e| format!("Insert failed: {e}"))?;

    Ok(())
}

#[reducer]
pub fn finalize_contest(ctx: &ReducerContext, contest_id: u64) -> Result<(), String> {
    let caller = ctx.sender().to_hex().to_string();
    let user = ctx.db.user_profile().identity().find(caller);
    if !user.map(|u| u.is_admin).unwrap_or(false) {
        return Err("Only admins can finalize contests".to_string());
    }

    let contest = ctx
        .db
        .contest()
        .id()
        .find(contest_id)
        .ok_or("Contest not found")?;

    if contest.status != "active" {
        return Err("Contest is not active".to_string());
    }

    ctx.db.contest().id().delete(contest_id);
    ctx.db.contest().try_insert(Contest {
        status: "finalizing".to_string(),
        ..contest.clone()
    }).map_err(|e| format!("Insert failed: {e}"))?;

    let mut claimed_blocks: Vec<Block> = ctx
        .db
        .block()
        .iter()
        .filter(|b| b.status == "claimed")
        .collect();

    claimed_blocks.sort_by(|a, b| b.likes.cmp(&a.likes));

    let top_count = 2.min(claimed_blocks.len());
    let prize_per_winner = if top_count > 0 {
        contest.prize_pool / top_count as u64
    } else {
        0
    };

    for (i, block) in claimed_blocks.iter().take(top_count).enumerate() {
        ctx.db.contest_winner().try_insert(ContestWinner {
            id: 0,
            contest_id,
            block_id: block.id,
            owner_identity: block.owner_identity.clone(),
            owner_name: block.owner_name.clone(),
            video_id: block.video_id.clone(),
            platform: block.platform.clone(),
            likes: block.likes,
            rank: (i + 1) as u32,
            prize_amount: prize_per_winner,
        }).map_err(|e| format!("Insert failed: {e}"))?;
    }

    ctx.db.contest().id().delete(contest_id);
    ctx.db.contest().try_insert(Contest {
        status: "completed".to_string(),
        ..contest
    }).map_err(|e| format!("Insert failed: {e}"))?;

    log::info!(
        "Contest {} finalized with {} winners",
        contest_id,
        top_count
    );
    Ok(())
}

#[reducer]
pub fn register_user(
    ctx: &ReducerContext,
    clerk_user_id: String,
    username: String,
    display_name: String,
    email: String,
) -> Result<(), String> {
    let caller = ctx.sender().to_hex().to_string();

    if ctx.db.user_profile().identity().find(caller.clone()).is_some() {
        return Err("User already registered".to_string());
    }

    const SIGNUP_CREDITS: u64 = 10;
    let now = now_micros(ctx);

    ctx.db.user_profile().try_insert(UserProfile {
        identity: caller.clone(),
        clerk_user_id,
        username,
        display_name,
        email,
        stripe_account_id: String::new(),
        total_earnings: 0,
        credits: SIGNUP_CREDITS,
        is_admin: false,
        created_at: now,
        bio: None,
        location: None,
        website_url: None,
        social_x: None,
        social_youtube: None,
        social_tiktok: None,
        social_instagram: None,
    }).map_err(|e| format!("Insert failed: {e}"))?;

    ctx.db.credit_transaction_log().try_insert(CreditTransactionLog {
        id: 0,
        user_identity: caller,
        tx_type: "signup_bonus".to_string(),
        amount: SIGNUP_CREDITS as i64,
        balance_after: SIGNUP_CREDITS,
        stripe_payment_id: String::new(),
        description: "Welcome bonus".to_string(),
        created_at: now,
    }).map_err(|e| format!("Credit log insert failed: {e}"))?;

    Ok(())
}

#[reducer]
pub fn update_profile(
    ctx: &ReducerContext,
    username: String,
    display_name: String,
    email: String,
) -> Result<(), String> {
    let caller = ctx.sender().to_hex().to_string();

    let user = ctx
        .db
        .user_profile()
        .identity()
        .find(caller.clone())
        .ok_or("User not found")?;

    let updated = UserProfile {
        username: if username.is_empty() { user.username.clone() } else { username },
        display_name: if display_name.is_empty() { user.display_name.clone() } else { display_name },
        email: if email.is_empty() { user.email.clone() } else { email },
        ..user
    };

    ctx.db.user_profile().identity().delete(caller);
    ctx.db.user_profile().try_insert(updated)
        .map_err(|e| format!("Insert failed: {e}"))?;

    Ok(())
}

#[reducer]
pub fn update_profile_details(
    ctx: &ReducerContext,
    bio: String,
    location: String,
    website_url: String,
    social_x: String,
    social_youtube: String,
    social_tiktok: String,
    social_instagram: String,
) -> Result<(), String> {
    let caller = ctx.sender().to_hex().to_string();

    let user = ctx
        .db
        .user_profile()
        .identity()
        .find(caller.clone())
        .ok_or("User not found")?;

    // Validate lengths
    if bio.len() > 160 {
        return Err("Bio too long (max 160 chars)".to_string());
    }
    if location.len() > 100 {
        return Err("Location too long (max 100 chars)".to_string());
    }
    if website_url.len() > 200 {
        return Err("Website URL too long (max 200 chars)".to_string());
    }

    fn opt(s: String) -> Option<String> {
        if s.is_empty() { None } else { Some(s) }
    }

    let updated = UserProfile {
        bio: opt(bio),
        location: opt(location),
        website_url: opt(website_url),
        social_x: opt(social_x),
        social_youtube: opt(social_youtube),
        social_tiktok: opt(social_tiktok),
        social_instagram: opt(social_instagram),
        ..user
    };

    ctx.db.user_profile().identity().delete(caller);
    ctx.db.user_profile().try_insert(updated)
        .map_err(|e| format!("Insert failed: {e}"))?;

    Ok(())
}

#[reducer]
pub fn update_stripe_account(
    ctx: &ReducerContext,
    stripe_account_id: String,
) -> Result<(), String> {
    let caller = ctx.sender().to_hex().to_string();

    let user = ctx
        .db
        .user_profile()
        .identity()
        .find(caller.clone())
        .ok_or("User not found")?;

    ctx.db.user_profile().identity().delete(caller);
    ctx.db.user_profile().try_insert(UserProfile {
        stripe_account_id,
        ..user
    }).map_err(|e| format!("Insert failed: {e}"))?;

    Ok(())
}

/// Called by the client on first connect to store the Clerk user ID → SpacetimeDB identity mapping.
/// Safe to call multiple times (upserts).
#[reducer]
pub fn store_clerk_mapping(ctx: &ReducerContext, clerk_user_id: String) -> Result<(), String> {
    if clerk_user_id.is_empty() {
        return Err("clerk_user_id cannot be empty".to_string());
    }
    let caller = ctx.sender().to_hex().to_string();
    ctx.db.clerk_identity_map().clerk_user_id().delete(clerk_user_id.clone());
    ctx.db.clerk_identity_map().try_insert(ClerkIdentityMap {
        clerk_user_id,
        spacetimedb_identity: caller,
    }).map_err(|e| format!("Insert failed: {e}"))?;
    Ok(())
}

/// Called server-side (from Clerk webhook) to sync username / display_name / email changes.
/// No caller auth check — security relies on SPACETIMEDB_SERVER_TOKEN being kept secret.
#[reducer]
pub fn server_update_profile(
    ctx: &ReducerContext,
    clerk_user_id: String,
    username: String,
    display_name: String,
    email: String,
) -> Result<(), String> {
    let mapping = ctx
        .db
        .clerk_identity_map()
        .clerk_user_id()
        .find(clerk_user_id.clone())
        .ok_or_else(|| format!("No mapping found for clerk_user_id: {}", clerk_user_id))?;

    let user = ctx
        .db
        .user_profile()
        .identity()
        .find(mapping.spacetimedb_identity.clone())
        .ok_or("User profile not found")?;

    let updated = UserProfile {
        username: if username.is_empty() { user.username.clone() } else { username },
        display_name: if display_name.is_empty() { user.display_name.clone() } else { display_name },
        email: if email.is_empty() { user.email.clone() } else { email },
        ..user
    };

    ctx.db.user_profile().identity().delete(mapping.spacetimedb_identity);
    ctx.db.user_profile().try_insert(updated)
        .map_err(|e| format!("Insert failed: {e}"))?;

    Ok(())
}

/// Called server-side (from Clerk webhook) when a user deletes their account.
/// Anonymises the profile rather than hard-deleting so existing block/content history is preserved.
#[reducer]
pub fn server_delete_user(ctx: &ReducerContext, clerk_user_id: String) -> Result<(), String> {
    let mapping = ctx
        .db
        .clerk_identity_map()
        .clerk_user_id()
        .find(clerk_user_id.clone());

    let Some(mapping) = mapping else {
        // User may never have logged in — nothing to anonymise.
        return Ok(());
    };

    let identity = mapping.spacetimedb_identity.clone();

    if let Some(user) = ctx.db.user_profile().identity().find(identity.clone()) {
        ctx.db.user_profile().identity().delete(identity.clone());
        ctx.db.user_profile().try_insert(UserProfile {
            clerk_user_id: String::new(),
            username: String::new(),
            display_name: "Deleted User".to_string(),
            email: String::new(),
            stripe_account_id: String::new(),
            credits: 0,
            is_admin: false,
            ..user
        }).map_err(|e| format!("Insert failed: {e}"))?;
    }

    // Cascade: clean up all related records for this identity

    // User follows (both directions)
    let follow_ids: Vec<u64> = ctx.db.user_follow().iter()
        .filter(|f| f.follower_identity == identity || f.following_identity == identity)
        .map(|f| f.id).collect();
    for id in follow_ids { ctx.db.user_follow().id().delete(id); }

    // Topic follows
    let topic_follow_ids: Vec<u64> = ctx.db.topic_follow().iter()
        .filter(|f| f.follower_identity == identity)
        .map(|f| f.id).collect();
    for id in topic_follow_ids { ctx.db.topic_follow().id().delete(id); }

    // User blocks (both directions)
    let block_ids: Vec<u64> = ctx.db.user_block().iter()
        .filter(|b| b.blocker_identity == identity || b.blocked_identity == identity)
        .map(|b| b.id).collect();
    for id in block_ids { ctx.db.user_block().id().delete(id); }

    // User mutes (both directions)
    let mute_ids: Vec<u64> = ctx.db.user_mute().iter()
        .filter(|m| m.muter_identity == identity || m.muted_identity == identity)
        .map(|m| m.id).collect();
    for id in mute_ids { ctx.db.user_mute().id().delete(id); }

    // Notifications (as recipient)
    let notif_ids: Vec<u64> = ctx.db.notification().iter()
        .filter(|n| n.recipient_identity == identity)
        .map(|n| n.id).collect();
    for id in notif_ids { ctx.db.notification().id().delete(id); }

    // Topic moderator applications
    let mod_app_ids: Vec<u64> = ctx.db.topic_moderator_application().iter()
        .filter(|a| a.applicant_identity == identity)
        .map(|a| a.id).collect();
    for id in mod_app_ids { ctx.db.topic_moderator_application().id().delete(id); }

    // Topic moderator records
    let mod_ids: Vec<u64> = ctx.db.topic_moderator().iter()
        .filter(|m| m.identity == identity)
        .map(|m| m.id).collect();
    for id in mod_ids { ctx.db.topic_moderator().id().delete(id); }

    // Topic bans
    let ban_ids: Vec<u64> = ctx.db.topic_ban().iter()
        .filter(|b| b.banned_identity == identity)
        .map(|b| b.id).collect();
    for id in ban_ids { ctx.db.topic_ban().id().delete(id); }

    // Direct messages — mark as deleted rather than removing (preserves other user's view)
    let msg_ids: Vec<u64> = ctx.db.direct_message().iter()
        .filter(|m| m.sender_identity == identity || m.recipient_identity == identity)
        .filter(|m| !m.is_deleted)
        .map(|m| m.id).collect();
    for id in msg_ids {
        if let Some(msg) = ctx.db.direct_message().id().find(id) {
            ctx.db.direct_message().id().delete(id);
            let _ = ctx.db.direct_message().try_insert(DirectMessage {
                is_deleted: true,
                ..msg
            });
        }
    }

    // Like records
    let like_ids: Vec<u64> = ctx.db.like_record().iter()
        .filter(|l| l.user_identity == identity)
        .map(|l| l.id).collect();
    for id in like_ids { ctx.db.like_record().id().delete(id); }

    // Dislike records
    let dislike_ids: Vec<u64> = ctx.db.dislike_record().iter()
        .filter(|d| d.user_identity == identity)
        .map(|d| d.id).collect();
    for id in dislike_ids { ctx.db.dislike_record().id().delete(id); }

    // Comment likes
    let comment_like_ids: Vec<u64> = ctx.db.comment_like().iter()
        .filter(|l| l.user_identity == identity)
        .map(|l| l.id).collect();
    for id in comment_like_ids { ctx.db.comment_like().id().delete(id); }

    // Saved blocks
    let saved_ids: Vec<u64> = ctx.db.saved_block().iter()
        .filter(|s| s.user_identity == identity)
        .map(|s| s.id).collect();
    for id in saved_ids { ctx.db.saved_block().id().delete(id); }

    ctx.db.clerk_identity_map().clerk_user_id().delete(clerk_user_id);
    Ok(())
}

#[reducer]
pub fn set_admin(
    ctx: &ReducerContext,
    target_identity: String,
    is_admin: bool,
) -> Result<(), String> {
    let caller = ctx.sender().to_hex().to_string();
    let caller_user = ctx.db.user_profile().identity().find(caller);
    if !caller_user.map(|u| u.is_admin).unwrap_or(false) {
        return Err("Only admins can set admin status".to_string());
    }

    let target = ctx
        .db
        .user_profile()
        .identity()
        .find(target_identity.clone())
        .ok_or("Target user not found")?;

    ctx.db
        .user_profile()
        .identity()
        .delete(target_identity);
    ctx.db.user_profile().try_insert(UserProfile {
        is_admin,
        ..target
    }).map_err(|e| format!("Insert failed: {e}"))?;

    Ok(())
}

/// Called server-side (from Stripe webhook) to add purchased credits to a user.
/// No caller auth check — security relies on SPACETIMEDB_SERVER_TOKEN being kept secret.
#[reducer]
pub fn add_credits(
    ctx: &ReducerContext,
    identity: String,
    amount: u64,
    stripe_payment_id: String,
    description: String,
) -> Result<(), String> {
    if amount == 0 {
        return Err("amount must be > 0".to_string());
    }

    let user = ctx
        .db
        .user_profile()
        .identity()
        .find(identity.clone())
        .ok_or_else(|| format!("User not found: {}", identity))?;

    let new_balance = user.credits.saturating_add(amount);

    ctx.db.user_profile().identity().delete(identity.clone());
    ctx.db.user_profile().try_insert(UserProfile {
        credits: new_balance,
        ..user
    }).map_err(|e| format!("Insert failed: {e}"))?;

    ctx.db.credit_transaction_log().try_insert(CreditTransactionLog {
        id: 0,
        user_identity: identity,
        tx_type: "purchase".to_string(),
        amount: amount as i64,
        balance_after: new_balance,
        stripe_payment_id,
        description,
        created_at: now_micros(ctx),
    }).map_err(|e| format!("Credit log insert failed: {e}"))?;

    Ok(())
}

/// Called by the authenticated client to spend credits for an in-app action.
#[reducer]
pub fn spend_credits(
    ctx: &ReducerContext,
    amount: u64,
    description: String,
) -> Result<(), String> {
    if amount == 0 {
        return Err("amount must be > 0".to_string());
    }

    let caller = ctx.sender().to_hex().to_string();

    let user = ctx
        .db
        .user_profile()
        .identity()
        .find(caller.clone())
        .ok_or("User not found")?;

    if user.credits < amount {
        return Err(format!("Insufficient credits: have {}, need {}", user.credits, amount));
    }

    let new_balance = user.credits - amount;

    ctx.db.user_profile().identity().delete(caller.clone());
    ctx.db.user_profile().try_insert(UserProfile {
        credits: new_balance,
        ..user
    }).map_err(|e| format!("Insert failed: {e}"))?;

    ctx.db.credit_transaction_log().try_insert(CreditTransactionLog {
        id: 0,
        user_identity: caller,
        tx_type: "spend".to_string(),
        amount: -(amount as i64),
        balance_after: new_balance,
        stripe_payment_id: String::new(),
        description,
        created_at: now_micros(ctx),
    }).map_err(|e| format!("Credit log insert failed: {e}"))?;

    Ok(())
}
