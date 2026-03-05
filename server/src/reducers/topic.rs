use spacetimedb::{reducer, ReducerContext, Table};
use crate::tables::*;
use std::collections::{HashMap, HashSet};

const REAPPLY_COOLDOWN_MICROS: u64 = 24 * 60 * 60 * 1_000_000;

// ---------------------------------------------------------------------------
// Category allowlist — must mirror src/lib/constants.ts CATEGORIES.
// ---------------------------------------------------------------------------
const VALID_CATEGORIES: &[&str] = &[
    // Discourse & Ideas
    "Ideas & Solutions",
    "Politics",
    "News & Media",
    "Geopolitics & War",
    "Society & Culture",
    "LGBTQ+",
    "Conspiracy & Alternative",
    "Paranormal & Supernatural",
    "Philosophy & Ethics",
    "Religion & Spirituality",
    "Nonprofits & Activism",
    // Knowledge
    "History",
    "Science",
    "Space & Astronomy",
    "Technology",
    "Artificial Intelligence",
    "Education",
    "Literature & Books",
    "Science Fiction & Fantasy",
    "Psychology & Behavior",
    "Language & Linguistics",
    "Environment",
    // Life & Wellbeing
    "Health & Wellness",
    "Mental Health",
    "Fitness & Exercise",
    "Self-Improvement & Motivation",
    "Parenting & Family",
    "Relationships & Dating",
    "Business & Finance",
    "Cryptocurrency & Web3",
    "Real Estate & Housing",
    "Law & Crime",
    // Entertainment & Media
    "Entertainment",
    "Film & Animation",
    "Anime & Manga",
    "Music",
    "Sports",
    "Martial Arts & Combat Sports",
    "Gaming",
    "Tabletop & Board Games",
    "Celebrity & Pop Culture",
    "Comedy",
    // Lifestyle
    "Food & Cooking",
    "Travel",
    "Fashion & Beauty",
    "Art & Creativity",
    "Photography & Film Production",
    "DIY & Hobbies",
    "Howto & Style",
    "Architecture & Interior Design",
    "Outdoors & Adventure",
    "Survival & Preparedness",
    "Automotive",
    "Animals & Nature",
    "People & Blogs",
    "Cultures & Traditions",
    "Other",
];

fn validate_category(category: &str) -> Result<(), String> {
    let trimmed = category.trim();
    if trimmed.is_empty() {
        return Err("Category cannot be empty".to_string());
    }
    if VALID_CATEGORIES.contains(&trimmed) {
        Ok(())
    } else {
        Err(format!(
            "Invalid category \"{trimmed}\". Must be one of the allowed categories."
        ))
    }
}

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

fn slug_from_name(name: &str) -> String {
    let raw: String = name
        .to_lowercase()
        .chars()
        .map(|c| if c.is_alphanumeric() { c } else { '-' })
        .collect();
    raw.split('-')
        .filter(|s| !s.is_empty())
        .collect::<Vec<_>>()
        .join("-")
}

fn is_admin(ctx: &ReducerContext, caller: &str) -> bool {
    ctx.db
        .user_profile()
        .identity()
        .find(caller.to_string())
        .map(|u| u.is_admin)
        .unwrap_or(false)
}

fn can_moderate_topic(ctx: &ReducerContext, caller: &str, topic_id: u64) -> bool {
    if is_admin(ctx, caller) {
        return true;
    }

    if let Some(topic) = ctx.db.topic().id().find(topic_id) {
        if topic.creator_identity == caller {
            return true;
        }
    }

    ctx.db
        .topic_moderator()
        .iter()
        .any(|m| m.topic_id == topic_id && m.identity == caller && m.status == "active")
}

fn ensure_owner_moderator_row(
    ctx: &ReducerContext,
    topic_id: u64,
    owner_identity: &str,
    granted_by: &str,
) -> Result<(), String> {
    let prior_owner_rows: Vec<u64> = ctx
        .db
        .topic_moderator()
        .iter()
        .filter(|m| m.topic_id == topic_id && (m.identity == owner_identity || m.role == "owner"))
        .map(|m| m.id)
        .collect();
    for id in prior_owner_rows {
        ctx.db.topic_moderator().id().delete(id);
    }

    ctx.db
        .topic_moderator()
        .try_insert(TopicModerator {
            id: 0,
            topic_id,
            identity: owner_identity.to_string(),
            role: "owner".to_string(),
            status: "active".to_string(),
            granted_by: granted_by.to_string(),
            created_at: now_micros(ctx),
        })
        .map_err(|e| format!("Owner moderator insert failed: {e}"))?;

    Ok(())
}

fn get_or_create_top_level_taxonomy_node(
    ctx: &ReducerContext,
    category: &str,
) -> Result<Option<u64>, String> {
    let trimmed = category.trim();
    if trimmed.is_empty() {
        return Ok(None);
    }

    let slug = slug_from_name(trimmed);
    if slug.is_empty() {
        return Ok(None);
    }

    if let Some(existing) = ctx.db.topic_taxonomy_node().slug().find(slug.clone()) {
        return Ok(Some(existing.id));
    }

    let inserted = ctx
        .db
        .topic_taxonomy_node()
        .try_insert(TopicTaxonomyNode {
            id: 0,
            slug: slug.clone(),
            name: trimmed.to_string(),
            parent_id: None,
            path: slug,
            depth: 0,
            is_active: true,
            created_at: now_micros(ctx),
        })
        .map_err(|e| format!("Taxonomy insert failed: {e}"))?;

    Ok(Some(inserted.id))
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

    validate_category(&category)?;

    // Enforce globally unique titles (case-insensitive). First come, first served.
    let lower_title = trimmed.to_lowercase();
    if ctx.db.topic().iter().any(|t| t.title.to_lowercase() == lower_title) {
        return Err("A topic with this title already exists. Please choose a different title.".to_string());
    }

    // Slug is derived 1-to-1 from the unique title, so no suffix needed.
    let slug = base_slug;

    let taxonomy_node_id = get_or_create_top_level_taxonomy_node(ctx, &category)?;

    let topic = ctx.db.topic().try_insert(Topic {
        id: 0,
        slug,
        title: trimmed,
        description,
        category,
        taxonomy_node_id,
        creator_identity: caller,
        video_count: 0,
        total_likes: 0,
        total_dislikes: 0,
        total_views: 0,
        is_active: true,
        created_at: now_micros(ctx),
    }).map_err(|e| format!("Insert failed: {e}"))?;

    ensure_owner_moderator_row(ctx, topic.id, &topic.creator_identity, &topic.creator_identity)?;

    Ok(())
}

/// Combined score used to rank blocks within a topic.
/// Higher score → closer to the spiral centre.
pub fn block_score(b: &Block) -> i64 {
    let yt = std::cmp::max(b.yt_views, b.yt_likes) as i64;
    let platform = (b.likes as i64) - (b.dislikes as i64);
    yt + platform
}

#[derive(Clone, Copy, Default)]
struct ActivitySignal {
    claim_count: u64,
    comment_count: u64,
    moderation_action_count: u64,
    last_activity_at: u64,
}

fn add_activity_signal(
    scores: &mut HashMap<String, ActivitySignal>,
    identity: &str,
    claim_count: u64,
    comment_count: u64,
    moderation_action_count: u64,
    activity_at: u64,
) {
    let entry = scores
        .entry(identity.to_string())
        .or_insert(ActivitySignal::default());
    entry.claim_count = entry.claim_count.saturating_add(claim_count);
    entry.comment_count = entry.comment_count.saturating_add(comment_count);
    entry.moderation_action_count = entry
        .moderation_action_count
        .saturating_add(moderation_action_count);
    if activity_at > entry.last_activity_at {
        entry.last_activity_at = activity_at;
    }
}

fn collect_topic_activity(ctx: &ReducerContext, topic_id: u64) -> HashMap<String, ActivitySignal> {
    let mut scores: HashMap<String, ActivitySignal> = HashMap::new();
    let topic_block_ids: HashSet<u64> = ctx
        .db
        .block()
        .iter()
        .filter(|b| b.topic_id == topic_id)
        .map(|b| b.id)
        .collect();

    for block in ctx
        .db
        .block()
        .iter()
        .filter(|b| b.topic_id == topic_id && b.status == "claimed")
    {
        add_activity_signal(&mut scores, &block.owner_identity, 1, 0, 0, block.claimed_at);
    }

    for comment in ctx
        .db
        .comment()
        .iter()
        .filter(|c| topic_block_ids.contains(&c.block_id))
    {
        add_activity_signal(&mut scores, &comment.user_identity, 0, 1, 0, comment.created_at);
    }

    for moderation in ctx
        .db
        .topic_moderator()
        .iter()
        .filter(|m| m.topic_id == topic_id)
    {
        add_activity_signal(&mut scores, &moderation.identity, 0, 0, 1, moderation.created_at);
    }

    for application in ctx
        .db
        .topic_moderator_application()
        .iter()
        .filter(|a| a.topic_id == topic_id && !a.reviewed_by.is_empty() && a.reviewed_at > 0)
    {
        add_activity_signal(
            &mut scores,
            &application.reviewed_by,
            0,
            0,
            1,
            application.reviewed_at,
        );
    }

    scores
}

fn sort_identities_by_moderator_activity(
    identities: &mut [String],
    activity_scores: &HashMap<String, ActivitySignal>,
) {
    identities.sort_by(|a, b| {
        let a_score = activity_scores.get(a).copied().unwrap_or_default();
        let b_score = activity_scores.get(b).copied().unwrap_or_default();
        b_score
            .moderation_action_count
            .cmp(&a_score.moderation_action_count)
            .then(b_score.comment_count.cmp(&a_score.comment_count))
            .then(b_score.claim_count.cmp(&a_score.claim_count))
            .then(b_score.last_activity_at.cmp(&a_score.last_activity_at))
            .then_with(|| a.cmp(b))
    });
}

fn sort_identities_by_recent_activity(
    identities: &mut [String],
    activity_scores: &HashMap<String, ActivitySignal>,
) {
    identities.sort_by(|a, b| {
        let a_score = activity_scores.get(a).copied().unwrap_or_default();
        let b_score = activity_scores.get(b).copied().unwrap_or_default();
        b_score
            .last_activity_at
            .cmp(&a_score.last_activity_at)
            .then(b_score.comment_count.cmp(&a_score.comment_count))
            .then(b_score.claim_count.cmp(&a_score.claim_count))
            .then(b_score.moderation_action_count.cmp(&a_score.moderation_action_count))
            .then_with(|| a.cmp(b))
    });
}

fn select_successor(
    caller: &str,
    preferred_new_owner_identity: Option<String>,
    moderator_candidates: &[String],
    contributor_candidates: &[String],
    activity_scores: &HashMap<String, ActivitySignal>,
) -> Result<String, String> {
    let mut ranked_moderators = moderator_candidates.to_vec();
    let mut ranked_contributors = contributor_candidates.to_vec();

    let preferred = preferred_new_owner_identity
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty());

    if let Some(explicit_owner) = preferred {
        if explicit_owner == caller {
            return Err("Preferred new owner cannot be the deleting user".to_string());
        }
        let is_active_moderator = ranked_moderators.iter().any(|id| id == &explicit_owner);
        let is_contributor = ranked_contributors.iter().any(|id| id == &explicit_owner);
        if !is_active_moderator && !is_contributor {
            return Err(
                "Preferred new owner must be an active moderator or existing contributor"
                    .to_string(),
            );
        }
        return Ok(explicit_owner);
    }

    sort_identities_by_moderator_activity(&mut ranked_moderators, activity_scores);
    if let Some(best_moderator) = ranked_moderators.first() {
        return Ok(best_moderator.clone());
    }

    sort_identities_by_recent_activity(&mut ranked_contributors, activity_scores);
    ranked_contributors
        .first()
        .cloned()
        .ok_or_else(|| "No eligible successor found".to_string())
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
    thumbnail_url: String,
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

    // Reject banned users.
    let is_banned = ctx.db.topic_ban().iter().any(|b| b.topic_id == topic_id && b.banned_identity == caller);
    if is_banned {
        return Err("You are banned from posting in this topic".to_string());
    }

    // Reject duplicate video in same topic.
    let vid_trimmed = video_id.trim();
    for existing in ctx.db.block().iter() {
        if existing.topic_id == topic_id
            && existing.video_id == vid_trimmed
            && existing.status == "claimed"
        {
            return Err("This video is already in this topic".to_string());
        }
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
        thumbnail_url,
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

    if !can_moderate_topic(ctx, &caller, topic_id) {
        return Err("Only a topic moderator or an admin can update this topic".to_string());
    }

    ctx.db.topic().id().delete(topic_id);
    let next_category = if category.is_empty() {
        topic.category.clone()
    } else {
        validate_category(&category)?;
        category
    };
    let taxonomy_node_id = if topic.taxonomy_node_id.is_some() {
        topic.taxonomy_node_id
    } else {
        get_or_create_top_level_taxonomy_node(ctx, &next_category)?
    };

    ctx.db.topic().try_insert(Topic {
        title: if title.is_empty() { topic.title.clone() } else { title },
        description: if description.is_empty() { topic.description.clone() } else { description },
        category: next_category,
        taxonomy_node_id,
        ..topic
    }).map_err(|e| format!("Update failed: {e}"))?;

    Ok(())
}

/// Delete a topic.
///
/// - If the caller owns all claimed blocks (or there are none) → delete all blocks and the topic.
/// - If other users have blocks:
///   1) optional explicit successor (if eligible),
///   2) otherwise the best active moderator by activity,
///   3) otherwise the last-active non-caller contributor.
///   Then remove caller blocks and rebalance.
#[reducer]
pub fn delete_topic(
    ctx: &ReducerContext,
    topic_id: u64,
    preferred_new_owner_identity: Option<String>,
) -> Result<(), String> {
    let caller = ctx.sender().to_hex().to_string();

    let topic = ctx
        .db
        .topic()
        .id()
        .find(topic_id)
        .ok_or("Topic not found")?;

    let is_admin = is_admin(ctx, &caller);

    if topic.creator_identity != caller && !is_admin {
        return Err("Only the topic creator or an admin can delete this topic".to_string());
    }

    let all_claimed: Vec<Block> = ctx
        .db
        .block()
        .iter()
        .filter(|b| b.topic_id == topic_id && b.status == "claimed")
        .collect();

    let has_others = all_claimed.iter().any(|b| b.owner_identity != caller);

    if !has_others {
        // Sole owner (or empty topic) — delete all blocks and the topic itself.
        for b in &all_claimed {
            ctx.db.block().id().delete(b.id);
        }
        let mod_rows: Vec<u64> = ctx
            .db
            .topic_moderator()
            .iter()
            .filter(|m| m.topic_id == topic_id)
            .map(|m| m.id)
            .collect();
        for id in mod_rows {
            ctx.db.topic_moderator().id().delete(id);
        }
        let application_rows: Vec<u64> = ctx
            .db
            .topic_moderator_application()
            .iter()
            .filter(|a| a.topic_id == topic_id)
            .map(|a| a.id)
            .collect();
        for id in application_rows {
            ctx.db.topic_moderator_application().id().delete(id);
        }
        ctx.db.topic().id().delete(topic_id);
    } else {
        // Other users have posts — transfer ownership, remove caller's blocks, rebalance.
        let mut contributor_candidates: Vec<String> = all_claimed
            .iter()
            .filter(|b| b.owner_identity != caller)
            .map(|b| b.owner_identity.clone())
            .collect::<HashSet<_>>()
            .into_iter()
            .collect();

        let mut moderator_candidates: Vec<String> = ctx
            .db
            .topic_moderator()
            .iter()
            .filter(|m| m.topic_id == topic_id && m.status == "active" && m.identity != caller)
            .map(|m| m.identity)
            .collect::<HashSet<_>>()
            .into_iter()
            .collect();

        let activity_scores = collect_topic_activity(ctx, topic_id);
        let new_owner = select_successor(
            &caller,
            preferred_new_owner_identity,
            &moderator_candidates,
            &contributor_candidates,
            &activity_scores,
        )?;

        // Transfer ownership.
        ctx.db.topic().id().delete(topic_id);
        let updated_topic = ctx.db.topic().try_insert(Topic {
            creator_identity: new_owner,
            ..topic
        }).map_err(|e| format!("Ownership transfer failed: {e}"))?;
        ensure_owner_moderator_row(ctx, updated_topic.id, &updated_topic.creator_identity, &caller)?;

        // Remove caller's blocks.
        for b in all_claimed.iter().filter(|b| b.owner_identity == caller) {
            ctx.db.block().id().delete(b.id);
        }

        // Rebalance remaining blocks and update video_count.
        let mut remaining: Vec<Block> = ctx
            .db
            .block()
            .iter()
            .filter(|b| b.topic_id == topic_id && b.status == "claimed")
            .collect();

        remaining.sort_by(|a, b| block_score(b).cmp(&block_score(a)));

        for (i, block) in remaining.iter().enumerate() {
            let (new_x, new_y) = spiral_coords(i as u64);
            if block.x != new_x || block.y != new_y {
                ctx.db.block().id().delete(block.id);
                ctx.db.block().try_insert(Block {
                    x: new_x,
                    y: new_y,
                    ..block.clone()
                }).map_err(|e| format!("Rebalance failed: {e}"))?;
            }
        }

        let new_count = remaining.len() as u64;
        if let Some(updated_topic) = ctx.db.topic().id().find(topic_id) {
            ctx.db.topic().id().delete(topic_id);
            ctx.db.topic().try_insert(Topic {
                video_count: new_count,
                ..updated_topic
            }).map_err(|e| format!("video_count update failed: {e}"))?;
        }
    }

    Ok(())
}

/// Create a taxonomy node.
///
/// Rules:
/// - Top-level nodes (no parent) are admin-only.
/// - Child nodes (subcategories) can be created by any registered user.
#[reducer]
pub fn create_topic_taxonomy_node(
    ctx: &ReducerContext,
    name: String,
    parent_id: Option<u64>,
) -> Result<(), String> {
    let caller = ctx.sender().to_hex().to_string();
    if ctx.db.user_profile().identity().find(caller.clone()).is_none() {
        return Err("Must be registered to create taxonomy nodes".to_string());
    }
    if parent_id.is_none() && !is_admin(ctx, &caller) {
        return Err("Only admins can create top-level taxonomy nodes".to_string());
    }

    let trimmed = name.trim().to_string();
    if trimmed.is_empty() {
        return Err("Taxonomy name cannot be empty".to_string());
    }

    let slug = slug_from_name(&trimmed);
    if slug.is_empty() {
        return Err("Taxonomy name must contain alphanumeric characters".to_string());
    }

    let (depth, path) = if let Some(pid) = parent_id {
        let parent = ctx
            .db
            .topic_taxonomy_node()
            .id()
            .find(pid)
            .ok_or("Parent taxonomy node not found")?;
        (parent.depth + 1, format!("{}/{}", parent.path, slug))
    } else {
        (0, slug.clone())
    };

    if ctx.db.topic_taxonomy_node().iter().any(|n| n.path == path) {
        return Err("A taxonomy node with this path already exists".to_string());
    }

    ctx.db
        .topic_taxonomy_node()
        .try_insert(TopicTaxonomyNode {
            id: 0,
            slug,
            name: trimmed,
            parent_id,
            path,
            depth,
            is_active: true,
            created_at: now_micros(ctx),
        })
        .map_err(|e| format!("Taxonomy insert failed: {e}"))?;

    Ok(())
}

/// Assign a topic to a taxonomy node. Topic moderators and admins can set this.
#[reducer]
pub fn set_topic_taxonomy(
    ctx: &ReducerContext,
    topic_id: u64,
    taxonomy_node_id: u64,
) -> Result<(), String> {
    let caller = ctx.sender().to_hex().to_string();
    if !can_moderate_topic(ctx, &caller, topic_id) {
        return Err("Only topic moderators or admins can set taxonomy".to_string());
    }

    let topic = ctx.db.topic().id().find(topic_id).ok_or("Topic not found")?;
    let node = ctx
        .db
        .topic_taxonomy_node()
        .id()
        .find(taxonomy_node_id)
        .ok_or("Taxonomy node not found")?;

    ctx.db.topic().id().delete(topic_id);
    ctx.db
        .topic()
        .try_insert(Topic {
            taxonomy_node_id: Some(node.id),
            category: node.name,
            ..topic
        })
        .map_err(|e| format!("Topic update failed: {e}"))?;

    Ok(())
}

/// User applies to moderate a topic.
#[reducer]
pub fn apply_topic_moderator(
    ctx: &ReducerContext,
    topic_id: u64,
    message: String,
) -> Result<(), String> {
    let caller = ctx.sender().to_hex().to_string();
    if ctx.db.user_profile().identity().find(caller.clone()).is_none() {
        return Err("Must be registered to apply as moderator".to_string());
    }

    let _topic = ctx.db.topic().id().find(topic_id).ok_or("Topic not found")?;

    if can_moderate_topic(ctx, &caller, topic_id) {
        return Err("You are already a moderator for this topic".to_string());
    }

    if ctx
        .db
        .topic_moderator_application()
        .iter()
        .any(|a| a.topic_id == topic_id && a.applicant_identity == caller && a.status == "pending")
    {
        return Err("You already have a pending moderator application".to_string());
    }

    let now = now_micros(ctx);
    if let Some(last_reject) = ctx
        .db
        .topic_moderator_application()
        .iter()
        .filter(|a| a.topic_id == topic_id && a.applicant_identity == caller && a.status == "rejected")
        .max_by_key(|a| a.reviewed_at)
    {
        if now < last_reject.reviewed_at.saturating_add(REAPPLY_COOLDOWN_MICROS) {
            return Err("Please wait before re-applying to moderate this topic".to_string());
        }
    }

    ctx.db
        .topic_moderator_application()
        .try_insert(TopicModeratorApplication {
            id: 0,
            topic_id,
            applicant_identity: caller,
            message,
            status: "pending".to_string(),
            reviewed_by: String::new(),
            created_at: now,
            reviewed_at: 0,
        })
        .map_err(|e| format!("Application insert failed: {e}"))?;

    Ok(())
}

/// Approve or reject a moderator application. Topic moderators/admins can review.
#[reducer]
pub fn review_topic_moderator_application(
    ctx: &ReducerContext,
    application_id: u64,
    approve: bool,
) -> Result<(), String> {
    let caller = ctx.sender().to_hex().to_string();
    let application = ctx
        .db
        .topic_moderator_application()
        .id()
        .find(application_id)
        .ok_or("Application not found")?;

    if application.status != "pending" {
        return Err("Application has already been reviewed".to_string());
    }

    if !can_moderate_topic(ctx, &caller, application.topic_id) {
        return Err("Only topic moderators or admins can review applications".to_string());
    }

    let now = now_micros(ctx);
    ctx.db.topic_moderator_application().id().delete(application_id);
    ctx.db
        .topic_moderator_application()
        .try_insert(TopicModeratorApplication {
            status: if approve { "approved".to_string() } else { "rejected".to_string() },
            reviewed_by: caller.clone(),
            reviewed_at: now,
            ..application.clone()
        })
        .map_err(|e| format!("Application update failed: {e}"))?;

    if approve {
        if let Some(existing) = ctx
            .db
            .topic_moderator()
            .iter()
            .find(|m| m.topic_id == application.topic_id && m.identity == application.applicant_identity)
        {
            ctx.db.topic_moderator().id().delete(existing.id);
        }

        ctx.db
            .topic_moderator()
            .try_insert(TopicModerator {
                id: 0,
                topic_id: application.topic_id,
                identity: application.applicant_identity,
                role: "moderator".to_string(),
                status: "active".to_string(),
                granted_by: caller,
                created_at: now,
            })
            .map_err(|e| format!("Moderator insert failed: {e}"))?;
    }

    Ok(())
}

/// Remove a moderator assignment from a topic.
#[reducer]
pub fn remove_topic_moderator(
    ctx: &ReducerContext,
    topic_id: u64,
    identity: String,
) -> Result<(), String> {
    let caller = ctx.sender().to_hex().to_string();
    let topic = ctx.db.topic().id().find(topic_id).ok_or("Topic not found")?;
    let caller_is_admin = is_admin(ctx, &caller);
    if !caller_is_admin && topic.creator_identity != caller {
        return Err("Only topic owner or admin can remove moderators".to_string());
    }

    let mod_row = ctx
        .db
        .topic_moderator()
        .iter()
        .find(|m| m.topic_id == topic_id && m.identity == identity)
        .ok_or("Moderator not found")?;

    if mod_row.role == "owner" {
        return Err("Owner role cannot be removed".to_string());
    }

    ctx.db.topic_moderator().id().delete(mod_row.id);
    ctx.db
        .topic_moderator()
        .try_insert(TopicModerator {
            status: "removed".to_string(),
            ..mod_row
        })
        .map_err(|e| format!("Moderator update failed: {e}"))?;

    Ok(())
}

/// Backfill taxonomy nodes from existing topic categories.
#[reducer]
pub fn backfill_topic_taxonomy_from_categories(ctx: &ReducerContext) -> Result<(), String> {
    let caller = ctx.sender().to_hex().to_string();
    if !is_admin(ctx, &caller) {
        return Err("Only admins can run taxonomy backfill".to_string());
    }

    let topics: Vec<Topic> = ctx.db.topic().iter().collect();
    for topic in topics {
        if topic.taxonomy_node_id.is_some() {
            continue;
        }
        if let Some(node_id) = get_or_create_top_level_taxonomy_node(ctx, &topic.category)? {
            ctx.db.topic().id().delete(topic.id);
            ctx.db
                .topic()
                .try_insert(Topic {
                    taxonomy_node_id: Some(node_id),
                    ..topic
                })
                .map_err(|e| format!("Topic backfill update failed: {e}"))?;
        }
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn id(value: &str) -> String {
        value.to_string()
    }

    #[test]
    fn select_successor_prefers_explicit_candidate_when_valid() {
        let mut activity = HashMap::new();
        add_activity_signal(&mut activity, "mod_a", 0, 0, 2, 100);
        add_activity_signal(&mut activity, "user_b", 3, 1, 0, 200);

        let selected = select_successor(
            "owner",
            Some("user_b".to_string()),
            &[id("mod_a")],
            &[id("user_b")],
            &activity,
        )
        .expect("explicit candidate should be accepted");

        assert_eq!(selected, "user_b");
    }

    #[test]
    fn select_successor_rejects_invalid_explicit_candidate() {
        let activity = HashMap::new();
        let result = select_successor(
            "owner",
            Some("outsider".to_string()),
            &[id("mod_a")],
            &[id("user_b")],
            &activity,
        );

        assert!(result.is_err());
    }

    #[test]
    fn select_successor_auto_picks_top_moderator_first() {
        let mut activity = HashMap::new();
        add_activity_signal(&mut activity, "mod_low", 1, 1, 1, 300);
        add_activity_signal(&mut activity, "mod_top", 2, 3, 5, 200);
        add_activity_signal(&mut activity, "user_z", 10, 10, 0, 500);

        let selected = select_successor(
            "owner",
            None,
            &[id("mod_low"), id("mod_top")],
            &[id("user_z")],
            &activity,
        )
        .expect("moderator should be selected");

        assert_eq!(selected, "mod_top");
    }

    #[test]
    fn select_successor_falls_back_to_last_active_contributor() {
        let mut activity = HashMap::new();
        add_activity_signal(&mut activity, "user_old", 2, 0, 0, 100);
        add_activity_signal(&mut activity, "user_new", 1, 0, 0, 250);

        let selected = select_successor(
            "owner",
            None,
            &[],
            &[id("user_old"), id("user_new")],
            &activity,
        )
        .expect("fallback contributor should be selected");

        assert_eq!(selected, "user_new");
    }

    #[test]
    fn select_successor_errors_when_no_candidates_exist() {
        let activity = HashMap::new();
        let result = select_successor("owner", None, &[], &[], &activity);
        assert!(result.is_err());
    }
}
