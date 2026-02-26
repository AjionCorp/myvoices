use spacetimedb::{table, Identity, Timestamp};

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

#[table(name = block, public)]
pub struct Block {
    #[primary_key]
    pub id: u32,
    pub x: i32,
    pub y: i32,
    pub video_url: String,
    pub thumbnail_url: String,
    pub platform: String,
    pub owner_identity: String,
    pub owner_name: String,
    pub likes: u64,
    pub dislikes: u64,
    pub status: String,
    pub ad_image_url: String,
    pub ad_link_url: String,
    pub claimed_at: u64,
}

#[table(name = user_profile, public)]
pub struct UserProfile {
    #[primary_key]
    pub identity: String,
    pub display_name: String,
    pub email: String,
    pub stripe_account_id: String,
    pub total_earnings: u64,
    pub is_admin: bool,
    pub created_at: u64,
}

#[table(name = like_record, public)]
pub struct LikeRecord {
    #[primary_key]
    #[auto_inc]
    pub id: u64,
    pub block_id: u32,
    pub user_identity: String,
    pub created_at: u64,
}

#[table(name = dislike_record, public)]
pub struct DislikeRecord {
    #[primary_key]
    #[auto_inc]
    pub id: u64,
    pub block_id: u32,
    pub user_identity: String,
    pub created_at: u64,
}

#[table(name = ad_placement, public)]
pub struct AdPlacement {
    #[primary_key]
    #[auto_inc]
    pub id: u64,
    pub block_ids_json: String,
    pub ad_image_url: String,
    pub ad_link_url: String,
    pub owner_identity: String,
    pub paid: bool,
    pub created_at: u64,
    pub expires_at: u64,
}

#[table(name = contest, public)]
pub struct Contest {
    #[primary_key]
    #[auto_inc]
    pub id: u64,
    pub start_at: u64,
    pub end_at: u64,
    pub prize_pool: u64,
    pub status: String,
}

#[table(name = transaction_log, public)]
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

#[table(name = contest_winner, public)]
pub struct ContestWinner {
    #[primary_key]
    #[auto_inc]
    pub id: u64,
    pub contest_id: u64,
    pub block_id: u32,
    pub owner_identity: String,
    pub owner_name: String,
    pub video_url: String,
    pub thumbnail_url: String,
    pub platform: String,
    pub likes: u64,
    pub rank: u32,
    pub prize_amount: u64,
}
