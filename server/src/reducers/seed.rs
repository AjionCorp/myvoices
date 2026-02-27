use spacetimedb::{reducer, ReducerContext, Table};
use crate::tables::*;

const GRID_COLS: i32 = 1250;
const GRID_ROWS: i32 = 800;
const CENTER_X: i32 = GRID_COLS / 2;
const CENTER_Y: i32 = GRID_ROWS / 2;

const VIDEO_COUNT: usize = 100_000;
const SHORTS_RATIO: f64 = 0.35;
const SEED: u32 = 42;

// 12,500+ real YouTube IDs scraped via yt-dlp
include!("../youtube_ids.rs");

const BLOCKS_PER_RING: usize = 3000;
const MIN_FIRST_RING: i32 = 4;

struct Mulberry32 {
    state: u32,
}

impl Mulberry32 {
    fn new(seed: u32) -> Self {
        Self { state: seed }
    }

    fn next(&mut self) -> f64 {
        self.state = self.state.wrapping_add(0x6d2b79f5);
        let mut t = self.state ^ (self.state >> 15);
        t = t.wrapping_mul(1 | self.state);
        t = (t.wrapping_add(t ^ (t >> 7)).wrapping_mul(61 | t)) ^ t;
        ((t ^ (t >> 14)) as f64) / 4294967296.0
    }
}

fn build_dynamic_ad_slots(claimed_count: usize) -> Vec<(i32, i32)> {
    let ring_count = (claimed_count as f64 / BLOCKS_PER_RING as f64).round().max(1.0) as usize;
    let content_radius =
        ((claimed_count.max(1) as f64 / std::f64::consts::PI).sqrt()).ceil() as i32;
    let outer_edge = content_radius + MIN_FIRST_RING;

    let mut distances: Vec<i32> = Vec::new();
    let mut spacings: Vec<i32> = Vec::new();
    for i in 0..ring_count {
        let t = if ring_count == 1 {
            0.5
        } else {
            i as f64 / (ring_count - 1) as f64
        };
        let d = (MIN_FIRST_RING as f64 + t * (outer_edge - MIN_FIRST_RING) as f64).round() as i32;
        if !distances.is_empty() && d <= *distances.last().unwrap() {
            continue;
        }
        distances.push(d);
        spacings.push((3 + (distances.len() as i32 / 3) * 2).min(7));
    }

    let mut slots: Vec<(i32, i32)> = Vec::new();
    let mut set = std::collections::HashSet::new();

    for ri in 0..distances.len() {
        let d = distances[ri];
        let sp = spacings[ri];

        let corners = [
            (CENTER_X - d, CENTER_Y - d),
            (CENTER_X + d, CENTER_Y - d),
            (CENTER_X - d, CENTER_Y + d),
            (CENTER_X + d, CENTER_Y + d),
        ];
        for c in &corners {
            if set.insert(*c) {
                slots.push(*c);
            }
        }

        let mut dx = -d + sp;
        while dx <= d - sp {
            let top = (CENTER_X + dx, CENTER_Y - d);
            let bot = (CENTER_X + dx, CENTER_Y + d);
            if set.insert(top) {
                slots.push(top);
            }
            if set.insert(bot) {
                slots.push(bot);
            }
            dx += sp;
        }

        let mut dy = -d + sp;
        while dy <= d - sp {
            let left = (CENTER_X - d, CENTER_Y + dy);
            let right = (CENTER_X + d, CENTER_Y + dy);
            if set.insert(left) {
                slots.push(left);
            }
            if set.insert(right) {
                slots.push(right);
            }
            dy += sp;
        }
    }

    slots
}

fn batch_spiral_skip_ads(
    count: usize,
    ad_set: &std::collections::HashSet<(i32, i32)>,
) -> Vec<(i32, i32)> {
    let mut coords = Vec::with_capacity(count);
    if count == 0 {
        return coords;
    }

    let mut x: i32 = 0;
    let mut y: i32 = 0;
    let mut dx: i32 = 1;
    let mut dy: i32 = 0;
    let mut seg_len: usize = 1;
    let mut seg_passed: usize = 0;
    let mut turns: usize = 0;

    let ax = CENTER_X;
    let ay = CENTER_Y;
    if !ad_set.contains(&(ax, ay)) && ax >= 0 && ax < GRID_COLS && ay >= 0 && ay < GRID_ROWS {
        coords.push((ax, ay));
        if coords.len() >= count {
            return coords;
        }
    }

    for _ in 0..2_000_000usize {
        x += dx;
        y += dy;
        seg_passed += 1;
        if seg_passed == seg_len {
            seg_passed = 0;
            let tmp = dx;
            dx = -dy;
            dy = tmp;
            turns += 1;
            if turns % 2 == 0 {
                seg_len += 1;
            }
        }
        let abs_x = ax + x;
        let abs_y = ay + y;
        if abs_x < 0 || abs_x >= GRID_COLS || abs_y < 0 || abs_y >= GRID_ROWS {
            continue;
        }
        if ad_set.contains(&(abs_x, abs_y)) {
            continue;
        }
        coords.push((abs_x, abs_y));
        if coords.len() >= count {
            return coords;
        }
    }

    coords
}

const FIRST_NAMES: &[&str] = &[
    "Alex", "Jordan", "Mira", "Taylor", "Casey", "Riley", "Morgan", "Quinn",
    "Sage", "Avery", "Dakota", "Finley", "Harper", "Kai", "Luna", "Nova",
    "Phoenix", "River", "Skyler", "Wren", "Ash", "Blake", "Charlie", "Drew",
    "Eden", "Frankie", "Gray", "Haven", "Indigo", "Jules", "Kit", "Lux",
    "Marley", "Niko", "Oakley", "Peyton", "Remy", "Sloan", "Teagan", "Val",
    "Zion", "Ari", "Briar", "Cruz", "Dylan", "Ellis", "Fern", "Greer",
    "Hollis", "Jude", "Lennox", "Milan", "Nico", "Onyx", "Palmer", "Reign",
    "Scout", "True", "Uri", "Winter", "Xan", "Yael", "Zara", "Beau",
    "Rowan", "Emery", "Hayden", "Kendall", "Logan", "Micah", "Reese", "Shiloh",
    "Tatum", "Sage", "Armani", "Bellamy", "Cleo", "Darcy", "Ezra", "Flynn",
    "Gio", "Harlow", "Ira", "Jax", "Kenji", "Lior", "Maddox", "Nola",
    "Orion", "Presley", "Quincy", "Rory", "Salem", "Thea", "Uma", "Vesper",
    "Wilder", "Xiomara", "Yuki", "Zen", "Amara", "Bodhi", "Cedar", "Dax",
    "Elio", "Felix", "Gemma", "Heath", "Ivy", "Juno", "Koa", "Laken",
    "Mars", "Nyx", "Otto", "Piper", "Quill", "Rex", "Soren", "Tova",
    "Umber", "Veda", "Wynn", "Xena", "York", "Zephyr", "Arden", "Bliss",
];

const LAST_NAMES: &[&str] = &[
    "Chen", "Park", "Kim", "Singh", "Ali", "Lopez", "Müller", "Silva",
    "Tanaka", "Costa", "Russo", "Novak", "Johansson", "Andersen", "Okafor",
    "Nguyen", "Patel", "Santos", "Meyer", "Yamamoto", "Rivera", "Kowalski",
    "Larsen", "Dubois", "Torres", "Fischer", "Nakamura", "Ferreira", "Weber",
    "Sato", "Ivanov", "Moreau", "Hansen", "Rossi", "Berg", "Volkov", "Ortiz",
    "Hernandez", "Schmidt", "Takahashi", "Petrov", "Kato", "Bianchi", "Lam",
    "Eriksson", "Popov", "Suzuki", "Jansen", "Fernandez", "Nilsson", "Aoki",
    "Greco", "Medvedev", "Watanabe", "Hartmann", "Delgado", "Morita", "Kozlov",
    "Colombo", "Lindgren", "Shimizu", "Sousa", "Bergman", "Inoue", "Strauss",
];

struct RawBlock {
    vid: String,
    first_name: String,
    last_name: String,
    likes: u64,
    dislikes: u64,
    claimed_at: u64,
    is_short: bool,
}

fn generate_all_raw(base_time: u64) -> Vec<RawBlock> {
    let mut rng = Mulberry32::new(SEED);
    let mut raw = Vec::with_capacity(VIDEO_COUNT);

    for _i in 0..VIDEO_COUNT {
        let is_short = rng.next() < SHORTS_RATIO;
        let vid = if is_short {
            YOUTUBE_SHORT_IDS[(rng.next() * YOUTUBE_SHORT_IDS.len() as f64) as usize]
        } else {
            YOUTUBE_IDS[(rng.next() * YOUTUBE_IDS.len() as f64) as usize]
        };
        let first_name = FIRST_NAMES[(rng.next() * FIRST_NAMES.len() as f64) as usize];
        let last_name = LAST_NAMES[(rng.next() * LAST_NAMES.len() as f64) as usize];
        let likes = (rng.next() * 50_000.0) as u64;
        let dislikes = (rng.next() * likes as f64 * 0.3) as u64;
        let claimed_at = base_time - (rng.next() * 86_400_000.0 * 30.0) as u64;

        raw.push(RawBlock {
            vid: vid.to_string(),
            first_name: first_name.to_string(),
            last_name: last_name.to_string(),
            likes,
            dislikes,
            claimed_at,
            is_short,
        });
    }

    raw.sort_by(|a, b| {
        let sa = a.likes as i64 - a.dislikes as i64;
        let sb = b.likes as i64 - b.dislikes as i64;
        sb.cmp(&sa)
    });

    raw
}

#[reducer]
pub fn seed_data(ctx: &ReducerContext, batch_start: u32, batch_count: u32) -> Result<(), String> {
    let caller = ctx.sender().to_hex().to_string();
    let user = ctx.db.user_profile().identity().find(caller);
    if !user.map(|u| u.is_admin).unwrap_or(false) {
        return Err("Only admins can seed data".to_string());
    }

    let base_time = ctx.timestamp.to_micros_since_unix_epoch() as u64;
    let raw = generate_all_raw(base_time);

    let ad_slots_vec = build_dynamic_ad_slots(raw.len());
    let ad_set: std::collections::HashSet<(i32, i32)> =
        ad_slots_vec.iter().cloned().collect();
    let coords = batch_spiral_skip_ads(raw.len(), &ad_set);

    let start = batch_start as usize;
    let end = (start + batch_count as usize).min(raw.len());

    for i in start..end {
        let rb = &raw[i];
        if i >= coords.len() {
            break;
        }
        let (gx, gy) = coords[i];
        let block_id = (gy * GRID_COLS + gx) as u32;

        if ctx.db.block().id().find(block_id).is_some() {
            ctx.db.block().id().delete(block_id);
        }

        let platform = if rb.is_short {
            "youtube_short".to_string()
        } else {
            "youtube".to_string()
        };

        ctx.db
            .block()
            .try_insert(Block {
                id: block_id,
                x: gx,
                y: gy,
                video_id: rb.vid.clone(),
                platform,
                owner_identity: format!("user_{}", i),
                owner_name: format!("{} {}", rb.first_name, rb.last_name),
                likes: rb.likes,
                dislikes: rb.dislikes,
                status: "claimed".to_string(),
                ad_image_url: String::new(),
                ad_link_url: String::new(),
                claimed_at: rb.claimed_at,
            })
            .map_err(|e| format!("Insert failed at index {i}: {e}"))?;
    }

    log::info!(
        "Seeded blocks {}..{} ({} blocks)",
        start,
        end,
        end - start
    );
    Ok(())
}

#[reducer]
pub fn seed_ads(ctx: &ReducerContext) -> Result<(), String> {
    let caller = ctx.sender().to_hex().to_string();
    let user = ctx.db.user_profile().identity().find(caller);
    if !user.map(|u| u.is_admin).unwrap_or(false) {
        return Err("Only admins can seed data".to_string());
    }

    let claimed_count = ctx.db.block().iter().filter(|b| b.status == "claimed").count();
    let ad_slots = build_dynamic_ad_slots(claimed_count);

    let mut inserted = 0u32;
    for (col, row) in &ad_slots {
        let block_id = (row * GRID_COLS + col) as u32;
        if ctx.db.block().id().find(block_id).is_some() {
            continue;
        }
        ctx.db
            .block()
            .try_insert(Block {
                id: block_id,
                x: *col,
                y: *row,
                video_id: String::new(),
                platform: String::new(),
                owner_identity: String::new(),
                owner_name: String::new(),
                likes: 0,
                dislikes: 0,
                status: "ad".to_string(),
                ad_image_url: String::new(),
                ad_link_url: String::new(),
                claimed_at: 0,
            })
            .map_err(|e| format!("Ad insert failed: {e}"))?;
        inserted += 1;
    }

    log::info!("Seeded {} ad placeholder blocks", inserted);
    Ok(())
}

#[reducer]
pub fn clear_all_blocks(ctx: &ReducerContext) -> Result<(), String> {
    let caller = ctx.sender().to_hex().to_string();
    let user = ctx.db.user_profile().identity().find(caller);
    if !user.map(|u| u.is_admin).unwrap_or(false) {
        return Err("Only admins can clear data".to_string());
    }

    let ids: Vec<u32> = ctx.db.block().iter().map(|b| b.id).collect();
    for id in &ids {
        ctx.db.block().id().delete(*id);
    }

    log::info!("Cleared {} blocks", ids.len());
    Ok(())
}
