use spacetimedb::reducer;
use spacetimedb::ReducerContext;
use crate::tables::*;

#[reducer]
pub fn create_contest(
    ctx: &ReducerContext,
    duration_days: u64,
    prize_pool: u64,
) -> Result<(), String> {
    let caller = ctx.sender().to_hex();
    let user = ctx.db.user_profile().identity().find(caller);
    if !user.map(|u| u.is_admin).unwrap_or(false) {
        return Err("Only admins can create contests".to_string());
    }

    for c in ctx.db.contest().iter() {
        if c.status == "active" {
            return Err("There is already an active contest".to_string());
        }
    }

    let now = ctx.timestamp.to_micros_since_epoch();
    let end_at = now + duration_days * 86_400_000_000;

    ctx.db.contest().insert(Contest {
        id: 0,
        start_at: now,
        end_at,
        prize_pool,
        status: "active".to_string(),
    });

    Ok(())
}

#[reducer]
pub fn finalize_contest(ctx: &ReducerContext, contest_id: u64) -> Result<(), String> {
    let caller = ctx.sender().to_hex();
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
    ctx.db.contest().insert(Contest {
        status: "finalizing".to_string(),
        ..contest.clone()
    });

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
        ctx.db.contest_winner().insert(ContestWinner {
            id: 0,
            contest_id,
            block_id: block.id,
            owner_identity: block.owner_identity.clone(),
            owner_name: block.owner_name.clone(),
            video_url: block.video_url.clone(),
            thumbnail_url: block.thumbnail_url.clone(),
            platform: block.platform.clone(),
            likes: block.likes,
            rank: (i + 1) as u32,
            prize_amount: prize_per_winner,
        });
    }

    ctx.db.contest().id().delete(contest_id);
    ctx.db.contest().insert(Contest {
        status: "completed".to_string(),
        ..contest
    });

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
    let caller = ctx.sender().to_hex();

    if ctx.db.user_profile().identity().find(caller.clone()).is_some() {
        return Err("User already registered".to_string());
    }

    ctx.db.user_profile().insert(UserProfile {
        identity: caller,
        display_name,
        email,
        stripe_account_id: String::new(),
        total_earnings: 0,
        is_admin: false,
        created_at: ctx.timestamp.to_micros_since_epoch(),
    });

    Ok(())
}

#[reducer]
pub fn update_stripe_account(
    ctx: &ReducerContext,
    stripe_account_id: String,
) -> Result<(), String> {
    let caller = ctx.sender().to_hex();

    let user = ctx
        .db
        .user_profile()
        .identity()
        .find(caller.clone())
        .ok_or("User not found")?;

    ctx.db.user_profile().identity().delete(caller.clone());
    ctx.db.user_profile().insert(UserProfile {
        stripe_account_id,
        ..user
    });

    Ok(())
}

#[reducer]
pub fn set_admin(
    ctx: &ReducerContext,
    target_identity: String,
    is_admin: bool,
) -> Result<(), String> {
    let caller = ctx.sender().to_hex();
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
    ctx.db.user_profile().insert(UserProfile {
        is_admin,
        ..target
    });

    Ok(())
}
