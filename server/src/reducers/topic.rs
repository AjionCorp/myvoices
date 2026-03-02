use spacetimedb::{reducer, ReducerContext, Table};
use crate::tables::*;

fn now_micros(ctx: &ReducerContext) -> u64 {
    ctx.timestamp.to_micros_since_unix_epoch() as u64
}

/// Convert a title into a URL-safe slug, e.g. "Hottest Woman!" → "hottest-woman"
fn slug_from_title(title: &str) -> String {
    let raw: String = title
        .to_lowercase()
        .chars()
        .map(|c| if c.is_alphanumeric() { c } else { '-' })
        .collect();
    raw.split('-')
        .filter(|s| !s.is_empty())
        .collect::<Vec<_>>()
        .join("-")
}

/// Compute the (x, y) grid coordinates for the n-th block in a topic's spiral.
///
/// Uses a clockwise outward square spiral starting at (0, 0):
///   Ring 0: (0, 0)
///   Ring 1: 8 cells around the centre
///   Ring k: 8k cells, indices (2k−1)² … (2k+1)²−1
pub fn spiral_coords(n: u64) -> (i32, i32) {
    if n == 0 {
        return (0, 0);
    }
    // Find ring k such that (2k-1)^2 <= n < (2k+1)^2.
    // Correct formula: k = floor((sqrt(n) + 1) / 2).
    // Using ceil with an offset inside sqrt gives k values that are 1 too high
    // for most inputs, producing wrong and duplicate spiral positions.
    let k = {
        let sq = (n as f64).sqrt();
        ((sq + 1.0) / 2.0) as i64  // truncation == floor for positive values
    };
    let ring_start = (2 * k - 1) * (2 * k - 1);
    let offset = n as i64 - ring_start;
    let side = 2 * k;
    let seg = offset / side;
    let pos = offset % side;

    let (x, y): (i64, i64) = match seg {
        0 => (-k + 1 + pos, -k),      // top: left → right
        1 => (k, -k + 1 + pos),       // right: top → bottom
        2 => (k - 1 - pos, k),        // bottom: right → left
        _ => (-k, k - 1 - pos),       // left: bottom → top
    };
    (x as i32, y as i32)
}

/// Create a new topic. Any registered user can create topics for free.
#[reducer]
pub fn create_topic(
    ctx: &ReducerContext,
    title: String,
    description: String,
    category: String,
) -> Result<(), String> {
    let caller = ctx.sender().to_hex().to_string();

    if ctx.db.user_profile().identity().find(caller.clone()).is_none() {
        return Err("Must be registered to create a topic".to_string());
    }

    let trimmed = title.trim().to_string();
    if trimmed.is_empty() {
        return Err("Title cannot be empty".to_string());
    }

    let base_slug = slug_from_title(&trimmed);
    if base_slug.is_empty() {
        return Err("Title must contain at least one alphanumeric character".to_string());
    }

    // Make slug unique by appending a count suffix when the base already exists.
    let slug = if ctx.db.topic().slug().find(base_slug.clone()).is_none() {
        base_slug
    } else {
        let count = ctx.db.topic().iter().count();
        format!("{}-{}", base_slug, count)
    };

    ctx.db.topic().try_insert(Topic {
        id: 0,
        slug,
        title: trimmed,
        description,
        category,
        creator_identity: caller,
        video_count: 0,
        total_likes: 0,
        total_dislikes: 0,
        total_views: 0,
        is_active: true,
        created_at: now_micros(ctx),
    }).map_err(|e| format!("Insert failed: {e}"))?;

    Ok(())
}

/// Combined score used to rank blocks within a topic.
/// Higher score → closer to the spiral centre.
pub fn block_score(b: &Block) -> i64 {
    let yt = std::cmp::max(b.yt_views, b.yt_likes) as i64;
    let platform = (b.likes as i64) - (b.dislikes as i64);
    yt + platform
}

/// Claim a block in a topic's spiral grid with YouTube metadata.
///
/// After inserting, all claimed blocks in the topic are re-sorted by score
/// and assigned spiral positions so higher-scored videos stay near the centre.
#[reducer]
pub fn claim_block_in_topic(
    ctx: &ReducerContext,
    topic_id: u64,
    video_id: String,
    platform: String,
    owner_name: String,
    yt_views: u64,
    yt_likes: u64,
) -> Result<(), String> {
    let caller = ctx.sender().to_hex().to_string();

    if ctx.db.user_profile().identity().find(caller.clone()).is_none() {
        return Err("Must be registered to claim a block".to_string());
    }

    if video_id.trim().is_empty() {
        return Err("video_id cannot be empty".to_string());
    }

    let topic = ctx
        .db
        .topic()
        .id()
        .find(topic_id)
        .ok_or("Topic not found")?;

    if !topic.is_active {
        return Err("Topic is not active".to_string());
    }

    // Temporary position; will be corrected by the rebalance below.
    let (temp_x, temp_y) = spiral_coords(topic.video_count);

    ctx.db.block().try_insert(Block {
        id: 0,
        topic_id,
        x: temp_x,
        y: temp_y,
        video_id,
        platform,
        owner_identity: caller,
        owner_name,
        likes: 0,
        dislikes: 0,
        yt_views,
        yt_likes,
        status: "claimed".to_string(),
        ad_image_url: String::new(),
        ad_link_url: String::new(),
        claimed_at: now_micros(ctx),
    }).map_err(|e| format!("Block insert failed: {e}"))?;

    // Increment video count.
    ctx.db.topic().id().delete(topic_id);
    ctx.db.topic().try_insert(Topic {
        video_count: topic.video_count + 1,
        ..topic
    }).map_err(|e| format!("Topic update failed: {e}"))?;

    // --- Auto-rebalance: sort all claimed blocks by score, reassign spiral positions ---
    let mut claimed: Vec<Block> = ctx
        .db
        .block()
        .iter()
        .filter(|b| b.topic_id == topic_id && b.status == "claimed")
        .collect();

    claimed.sort_by(|a, b| block_score(b).cmp(&block_score(a)));

    for (i, block) in claimed.iter().enumerate() {
        let (new_x, new_y) = spiral_coords(i as u64);
        if block.x != new_x || block.y != new_y {
            ctx.db.block().id().delete(block.id);
            ctx.db.block().try_insert(Block {
                x: new_x,
                y: new_y,
                ..block.clone()
            }).map_err(|e| format!("Rebalance insert failed: {e}"))?;
        }
    }

    Ok(())
}

/// Increment the view counter for a topic (call when a user opens the topic page).
#[reducer]
pub fn increment_topic_views(ctx: &ReducerContext, topic_id: u64) -> Result<(), String> {
    let topic = ctx
        .db
        .topic()
        .id()
        .find(topic_id)
        .ok_or("Topic not found")?;

    ctx.db.topic().id().delete(topic_id);
    ctx.db.topic().try_insert(Topic {
        total_views: topic.total_views + 1,
        ..topic
    }).map_err(|e| format!("Update failed: {e}"))?;

    Ok(())
}

/// Update topic metadata. Only the creator or an admin may do this.
#[reducer]
pub fn update_topic(
    ctx: &ReducerContext,
    topic_id: u64,
    title: String,
    description: String,
    category: String,
) -> Result<(), String> {
    let caller = ctx.sender().to_hex().to_string();

    let topic = ctx
        .db
        .topic()
        .id()
        .find(topic_id)
        .ok_or("Topic not found")?;

    let is_admin = ctx
        .db
        .user_profile()
        .identity()
        .find(caller.clone())
        .map(|u| u.is_admin)
        .unwrap_or(false);

    if topic.creator_identity != caller && !is_admin {
        return Err("Only the topic creator or an admin can update this topic".to_string());
    }

    ctx.db.topic().id().delete(topic_id);
    ctx.db.topic().try_insert(Topic {
        title: if title.is_empty() { topic.title.clone() } else { title },
        description: if description.is_empty() { topic.description.clone() } else { description },
        category: if category.is_empty() { topic.category.clone() } else { category },
        ..topic
    }).map_err(|e| format!("Update failed: {e}"))?;

    Ok(())
}
