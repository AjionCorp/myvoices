use spacetimedb::table;

#[derive(Debug, Clone, PartialEq)]
pub enum Platform {
    YouTube,
    YouTubeShort,
    TikTok,
}

#[derive(Debug, Clone, PartialEq)]
pub enum BlockStatus {
    Empty,
    Claimed,
    Ad,
}

#[derive(Debug, Clone, PartialEq)]
pub enum ContestStatus {
    Upcoming,
    Active,
    Finalizing,
    Completed,
}

/// A user-created topic — each topic has its own block grid.
#[table(accessor = topic, public)]
#[derive(Clone)]
pub struct Topic {
    #[primary_key]
    #[auto_inc]
    pub id: u64,
    /// URL-safe identifier, e.g. "hottest-woman"
    #[unique]
    pub slug: String,
    pub title: String,
    pub description: String,
    /// Free-text category, e.g. "Entertainment", "Music"
    pub category: String,
    pub creator_identity: String,
    /// Monotonically increasing — used to derive next spiral position.
    pub video_count: u64,
    pub total_likes: u64,
    pub total_dislikes: u64,
    pub total_views: u64,
    pub is_active: bool,
    pub created_at: u64,
    /// Optional taxonomy assignment for hierarchical categories.
    /// Added at end + default for automatic migration compatibility.
    #[default(None::<u64>)]
    pub taxonomy_node_id: Option<u64>,
}

/// Hierarchical taxonomy node used to group topics, e.g. Science > Physics.
#[table(accessor = topic_taxonomy_node, public)]
#[derive(Clone)]
pub struct TopicTaxonomyNode {
    #[primary_key]
    #[auto_inc]
    pub id: u64,
    #[unique]
    pub slug: String,
    pub name: String,
    pub parent_id: Option<u64>,
    /// Cached normalized path, e.g. "science/physics".
    pub path: String,
    pub depth: u32,
    pub is_active: bool,
    pub created_at: u64,
}

/// Users with elevated privileges inside a topic.
#[table(accessor = topic_moderator, public)]
#[derive(Clone)]
pub struct TopicModerator {
    #[primary_key]
    #[auto_inc]
    pub id: u64,
    pub topic_id: u64,
    pub identity: String,
    /// owner | moderator
    pub role: String,
    /// active | removed
    pub status: String,
    pub granted_by: String,
    pub created_at: u64,
}

/// Application row for users requesting moderator status.
#[table(accessor = topic_moderator_application, public)]
#[derive(Clone)]
pub struct TopicModeratorApplication {
    #[primary_key]
    #[auto_inc]
    pub id: u64,
    pub topic_id: u64,
    pub applicant_identity: String,
    pub message: String,
    /// pending | approved | rejected
    pub status: String,
    pub reviewed_by: String,
    pub created_at: u64,
    pub reviewed_at: u64,
}

/// A claimed block within a topic's grid. Blocks are created on demand (no pre-seeding).
#[table(accessor = block, public)]
#[derive(Clone)]
pub struct Block {
    #[primary_key]
    #[auto_inc]
    pub id: u64,
    pub topic_id: u64,
    pub x: i32,
    pub y: i32,
    pub video_id: String,
    pub platform: String,
    pub owner_identity: String,
    pub owner_name: String,
    pub likes: u64,
    pub dislikes: u64,
    pub status: String,
    pub yt_views: u64,
    pub yt_likes: u64,
    pub thumbnail_url: String,
    pub ad_image_url: String,
    pub ad_link_url: String,
    pub claimed_at: u64,
}

#[table(accessor = user_profile, public)]
#[derive(Clone)]
pub struct UserProfile {
    #[primary_key]
    pub identity: String,
    pub clerk_user_id: String,
    pub username: String,
    pub display_name: String,
    pub email: String,
    pub stripe_account_id: String,
    pub total_earnings: u64,
    pub credits: u64,
    pub is_admin: bool,
    pub created_at: u64,
}

#[table(accessor = like_record, public)]
pub struct LikeRecord {
    #[primary_key]
    #[auto_inc]
    pub id: u64,
    pub block_id: u64,
    pub user_identity: String,
    pub created_at: u64,
}

#[table(accessor = dislike_record, public)]
pub struct DislikeRecord {
    #[primary_key]
    #[auto_inc]
    pub id: u64,
    pub block_id: u64,
    pub user_identity: String,
    pub created_at: u64,
}

#[table(accessor = ad_placement, public)]
#[derive(Clone)]
pub struct AdPlacement {
    #[primary_key]
    #[auto_inc]
    pub id: u64,
    pub topic_id: u64,
    pub block_ids_json: String,
    pub ad_image_url: String,
    pub ad_link_url: String,
    pub owner_identity: String,
    pub paid: bool,
    pub created_at: u64,
    pub expires_at: u64,
}

#[table(accessor = contest, public)]
#[derive(Clone)]
pub struct Contest {
    #[primary_key]
    #[auto_inc]
    pub id: u64,
    pub start_at: u64,
    pub end_at: u64,
    pub prize_pool: u64,
    pub status: String,
}

#[table(accessor = transaction_log, public)]
pub struct TransactionLog {
    #[primary_key]
    #[auto_inc]
    pub id: u64,
    pub tx_type: String,
    pub amount: u64,
    pub from_identity: String,
    pub to_identity: String,
    pub stripe_id: String,
    pub description: String,
    pub created_at: u64,
}

#[table(accessor = credit_transaction_log, public)]
pub struct CreditTransactionLog {
    #[primary_key]
    #[auto_inc]
    pub id: u64,
    pub user_identity: String,
    pub tx_type: String,
    pub amount: i64,
    pub balance_after: u64,
    pub stripe_payment_id: String,
    pub description: String,
    pub created_at: u64,
}

#[table(accessor = comment, public)]
#[derive(Clone)]
pub struct Comment {
    #[primary_key]
    #[auto_inc]
    pub id: u64,
    pub block_id: u64,
    pub user_identity: String,
    pub user_name: String,
    pub text: String,
    pub created_at: u64,
    /// null = top-level comment; set = reply to that comment id
    #[default(None::<u64>)]
    pub parent_comment_id: Option<u64>,
    /// null = original; set = this is a repost of that comment id
    #[default(None::<u64>)]
    pub repost_of_id: Option<u64>,
    #[default(0u64)]
    pub likes_count: u64,
    #[default(0u64)]
    pub replies_count: u64,
    #[default(0u64)]
    pub reposts_count: u64,
}

#[table(accessor = comment_like, public)]
#[derive(Clone)]
pub struct CommentLike {
    #[primary_key]
    #[auto_inc]
    pub id: u64,
    pub comment_id: u64,
    pub user_identity: String,
    pub created_at: u64,
}

#[table(accessor = notification, public)]
#[derive(Clone)]
pub struct Notification {
    #[primary_key]
    #[auto_inc]
    pub id: u64,
    pub recipient_identity: String,
    pub actor_identity: String,
    pub actor_name: String,
    /// "comment_reply" | "comment_like" | "comment_repost"
    pub notification_type: String,
    pub block_id: u64,
    pub comment_id: u64,
    pub is_read: bool,
    pub created_at: u64,
}

#[table(accessor = clerk_identity_map, public)]
pub struct ClerkIdentityMap {
    #[primary_key]
    pub clerk_user_id: String,
    pub spacetimedb_identity: String,
}

#[table(accessor = contest_winner, public)]
pub struct ContestWinner {
    #[primary_key]
    #[auto_inc]
    pub id: u64,
    pub contest_id: u64,
    pub block_id: u64,
    pub owner_identity: String,
    pub owner_name: String,
    pub video_id: String,
    pub platform: String,
    pub likes: u64,
    pub rank: u32,
    pub prize_amount: u64,
}
