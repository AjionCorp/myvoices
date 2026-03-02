use spacetimedb::{reducer, ReducerContext, Table};
use crate::tables::*;
use crate::reducers::topic::spiral_coords;

fn now_micros(ctx: &ReducerContext) -> u64 {
    ctx.timestamp.to_micros_since_unix_epoch() as u64
}

/// Dev utility — wipes all user_profile and clerk_identity_map rows.
/// Security relies on SPACETIMEDB_SERVER_TOKEN being kept secret.
#[reducer]
pub fn dev_clear_all_users(ctx: &ReducerContext) -> Result<(), String> {
    let identities: Vec<String> = ctx
        .db
        .user_profile()
        .iter()
        .map(|u| u.identity.clone())
        .collect();

    for id in identities {
        ctx.db.user_profile().identity().delete(id);
    }

    let clerk_ids: Vec<String> = ctx
        .db
        .clerk_identity_map()
        .iter()
        .map(|m| m.clerk_user_id.clone())
        .collect();

    for id in clerk_ids {
        ctx.db.clerk_identity_map().clerk_user_id().delete(id);
    }

    log::info!("[dev] All user profiles cleared");
    Ok(())
}

/// Dev utility — sets a user as admin by identity without requiring the caller to be admin.
/// Security relies on SPACETIMEDB_SERVER_TOKEN being kept secret.
#[reducer]
pub fn dev_set_admin(ctx: &ReducerContext, identity: String, is_admin: bool) -> Result<(), String> {
    let user = ctx
        .db
        .user_profile()
        .identity()
        .find(identity.clone())
        .ok_or_else(|| format!("User not found: {}", identity))?;

    ctx.db.user_profile().identity().delete(identity.clone());
    ctx.db.user_profile().try_insert(UserProfile {
        is_admin,
        ..user
    }).map_err(|e| format!("Insert failed: {e}"))?;

    log::info!("[dev] Set is_admin={} for {}", is_admin, identity.chars().take(16).collect::<String>());
    Ok(())
}

/// Dev utility — creates a topic and seeds it with fake blocks for testing.
/// Security relies on SPACETIMEDB_SERVER_TOKEN being kept secret.
#[reducer]
pub fn dev_seed_topic(
    ctx: &ReducerContext,
    title: String,
    category: String,
    block_count: u32,
) -> Result<(), String> {
    let base_slug = title
        .to_lowercase()
        .chars()
        .map(|c| if c.is_alphanumeric() { c } else { '-' })
        .collect::<String>()
        .split('-')
        .filter(|s| !s.is_empty())
        .collect::<Vec<_>>()
        .join("-");

    let slug = if ctx.db.topic().slug().find(base_slug.clone()).is_none() {
        base_slug
    } else {
        let count = ctx.db.topic().iter().count();
        format!("{}-{}", base_slug, count)
    };

    let now = now_micros(ctx);

    let topic = ctx.db.topic().try_insert(Topic {
        id: 0,
        slug,
        title,
        description: String::new(),
        category,
        creator_identity: "dev".to_string(),
        video_count: block_count as u64,
        total_likes: 0,
        total_dislikes: 0,
        total_views: 0,
        is_active: true,
        created_at: now,
    }).map_err(|e| format!("Topic insert failed: {e}"))?;

    // Sample YouTube video IDs for seeding
    let sample_ids = [
        "dQw4w9WgXcQ", "9bZkp7q19f0", "kJQP7kiw5Fk", "OPf0YbXqDm0",
        "hTWKbfoikeg", "fJ9rUzIMcZQ", "JGwWNGJdvx8", "CevxZvSJLk8",
        "y6120QOlsfU", "YqeW9_5kURI",
    ];

    let n = (block_count as usize).min(10000);
    for i in 0..n {
        let (x, y) = spiral_coords(i as u64);
        let vid = sample_ids[i % sample_ids.len()];
        ctx.db.block().try_insert(Block {
            id: 0,
            topic_id: topic.id,
            x,
            y,
            video_id: vid.to_string(),
            platform: "youtube".to_string(),
            owner_identity: format!("dev_user_{}", i % 20),
            owner_name: format!("Dev User {}", i % 20),
            likes: (i as u64 % 50),
            dislikes: (i as u64 % 10),
            yt_views: 0,
            yt_likes: 0,
            status: "claimed".to_string(),
            ad_image_url: String::new(),
            ad_link_url: String::new(),
            claimed_at: now,
        }).map_err(|e| format!("Block insert failed at {i}: {e}"))?;
    }

    log::info!("[dev] Seeded topic '{}' (id={}) with {} blocks", topic.title, topic.id, n);
    Ok(())
}
