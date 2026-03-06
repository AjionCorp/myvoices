use spacetimedb::{reducer, ReducerContext, Table};
use crate::tables::*;

fn now_micros(ctx: &ReducerContext) -> u64 {
    ctx.timestamp.to_micros_since_unix_epoch() as u64
}

/// Called server-side (from Next.js API route) to register a new API key.
/// No caller auth check — security relies on SPACETIMEDB_SERVER_TOKEN.
#[reducer]
pub fn server_register_api_key(
    ctx: &ReducerContext,
    key_hash: String,
    key_prefix: String,
    name: String,
    email: String,
) -> Result<(), String> {
    if key_hash.is_empty() || key_prefix.is_empty() {
        return Err("key_hash and key_prefix are required".to_string());
    }
    if name.is_empty() || name.len() > 100 {
        return Err("name must be 1-100 characters".to_string());
    }
    if email.is_empty() || !email.contains('@') || email.len() > 200 {
        return Err("Invalid email".to_string());
    }

    // Check for duplicate hash
    for existing in ctx.db.api_key().iter() {
        if existing.key_hash == key_hash {
            return Err("API key already exists".to_string());
        }
    }

    let now = now_micros(ctx);
    let prefix_display = key_prefix.clone();

    ctx.db.api_key().try_insert(ApiKey {
        id: 0,
        key_hash,
        key_prefix,
        name,
        email,
        credits: 0,
        total_requests: 0,
        is_active: true,
        created_at: now,
        last_used_at: 0,
    }).map_err(|e| format!("Insert failed: {e}"))?;

    log::info!("API key registered: {}", prefix_display);
    Ok(())
}

/// Called server-side to revoke an API key.
#[reducer]
pub fn server_revoke_api_key(
    ctx: &ReducerContext,
    key_id: u64,
) -> Result<(), String> {
    let key = ctx.db.api_key().id().find(key_id)
        .ok_or("API key not found")?;

    ctx.db.api_key().id().delete(key_id);
    ctx.db.api_key().try_insert(ApiKey {
        is_active: false,
        ..key
    }).map_err(|e| format!("Insert failed: {e}"))?;

    log::info!("API key revoked: {}", key_id);
    Ok(())
}

/// Called server-side to add credits to an API key (after Stripe payment).
/// `stripe_session_id` is used for idempotency — duplicate calls with the same
/// session ID are silently ignored rather than double-crediting the key.
#[reducer]
pub fn server_add_api_credits(
    ctx: &ReducerContext,
    key_id: u64,
    amount: u64,
    stripe_session_id: String,
    description: String,
) -> Result<(), String> {
    if amount == 0 {
        return Err("amount must be > 0".to_string());
    }

    // Idempotency: reject if this Stripe session has already been processed.
    let already_processed = ctx.db.api_usage_log().iter()
        .any(|r| r.endpoint == stripe_session_id && r.api_key_id == key_id);
    if already_processed {
        log::warn!("server_add_api_credits: duplicate session {} for key {} — skipping", stripe_session_id, key_id);
        return Ok(());
    }

    let key = ctx.db.api_key().id().find(key_id)
        .ok_or("API key not found")?;

    if !key.is_active {
        return Err("API key is revoked".to_string());
    }

    let new_credits = key.credits.saturating_add(amount);

    ctx.db.api_key().id().delete(key_id);
    ctx.db.api_key().try_insert(ApiKey {
        credits: new_credits,
        ..key
    }).map_err(|e| format!("Insert failed: {e}"))?;

    // Record a sentinel usage-log row so we can detect replays above.
    let now = ctx.timestamp.to_micros_since_unix_epoch() as u64;
    let today = {
        let secs = now / 1_000_000;
        let d = secs / 86400;
        // YYYYMMDD approximation from days-since-epoch
        let y = 1970 + d / 365;
        let m = (d % 365) / 30 + 1;
        let day = (d % 365) % 30 + 1;
        (y * 10000 + m * 100 + day) as u32
    };
    let _ = ctx.db.api_usage_log().try_insert(crate::tables::ApiUsageLog {
        id: 0,
        api_key_id: key_id,
        endpoint: stripe_session_id.clone(),
        request_count: 0,
        day: today,
        created_at: now,
    });

    log::info!("API key {} credits +{}: {} ({}, session={})", key_id, amount, new_credits, description, stripe_session_id);
    Ok(())
}

/// Called server-side to record API usage and deduct credits if over free tier.
#[reducer]
pub fn server_record_api_usage(
    ctx: &ReducerContext,
    key_id: u64,
    endpoint: String,
    day: u32,
    count: u64,
    credits_to_deduct: u64,
) -> Result<(), String> {
    let key = ctx.db.api_key().id().find(key_id)
        .ok_or("API key not found")?;

    let new_total = key.total_requests.saturating_add(count);
    let new_credits = if credits_to_deduct > 0 {
        key.credits.saturating_sub(credits_to_deduct)
    } else {
        key.credits
    };
    let now = now_micros(ctx);

    ctx.db.api_key().id().delete(key_id);
    ctx.db.api_key().try_insert(ApiKey {
        total_requests: new_total,
        credits: new_credits,
        last_used_at: now,
        ..key
    }).map_err(|e| format!("Insert failed: {e}"))?;

    // Upsert usage log for this day+endpoint
    let mut found = false;
    for log_entry in ctx.db.api_usage_log().iter() {
        if log_entry.api_key_id == key_id && log_entry.endpoint == endpoint && log_entry.day == day {
            let log_id = log_entry.id;
            let new_count = log_entry.request_count.saturating_add(count);
            ctx.db.api_usage_log().id().delete(log_id);
            ctx.db.api_usage_log().try_insert(ApiUsageLog {
                request_count: new_count,
                ..log_entry
            }).map_err(|e| format!("Log insert failed: {e}"))?;
            found = true;
            break;
        }
    }

    if !found {
        ctx.db.api_usage_log().try_insert(ApiUsageLog {
            id: 0,
            api_key_id: key_id,
            endpoint,
            request_count: count,
            day,
            created_at: now,
        }).map_err(|e| format!("Log insert failed: {e}"))?;
    }

    Ok(())
}
