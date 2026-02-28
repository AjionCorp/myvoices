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
    display_name: String,
    email: String,
) -> Result<(), String> {
    let caller = ctx.sender().to_hex().to_string();

    if ctx.db.user_profile().identity().find(caller.clone()).is_some() {
        return Err("User already registered".to_string());
    }

    ctx.db.user_profile().try_insert(UserProfile {
        identity: caller,
        display_name,
        email,
        stripe_account_id: String::new(),
        total_earnings: 0,
        is_admin: false,
        created_at: now_micros(ctx),
    }).map_err(|e| format!("Insert failed: {e}"))?;

    Ok(())
}

#[reducer]
pub fn update_profile(
    ctx: &ReducerContext,
    display_name: String,
    email: String,
) -> Result<(), String> {
    let caller = ctx.sender().to_hex().to_string();

    let mut user = ctx
        .db
        .user_profile()
        .identity()
        .find(caller)
        .ok_or("User not found")?;

    if !display_name.is_empty() {
        user.display_name = display_name;
    }
    if !email.is_empty() {
        user.email = email;
    }

    ctx.db.user_profile().identity().update(user);
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
