use spacetimedb::{reducer, ReducerContext, Table};
use crate::tables::*;

const GRID_COLS: i32 = 1250;
const GRID_ROWS: i32 = 800;
const CENTER_X: i32 = GRID_COLS / 2;
const CENTER_Y: i32 = GRID_ROWS / 2;

const VIDEO_COUNT: usize = 100_000;
const SHORTS_RATIO: f64 = 0.35;
const SEED: u32 = 42;

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

const YOUTUBE_IDS: &[&str] = &[
    "dQw4w9WgXcQ", "9bZkp7q19f0", "kJQP7kiw5Fk", "RgKAFK5djSk",
    "JGwWNGJdvx8", "fJ9rUzIMcZQ", "hT_nvWreIhg", "OPf0YbXqDm0",
    "CevxZvSJLk8", "09R8_2nJtjg", "YQHsXMglC9A", "lp-EO5I60KA",
    "bo_efYhYU2A", "7wtfhZwyrcc", "e-ORhEE9VVg", "kXYiU_JCYtU",
    "2Vv-BfVoq4g", "60ItHLz5WEA", "hLQl3WQQoQ0", "pRpeEdMmmQ0",
    "LsoLEjrDogU", "nfWlot6h_JM", "HP-MbfHFUqs", "DyDfgMOUjCI",
    "pt8VYOfr8To", "QYh6mYIJG2Y", "YR5ApYxkU-U", "fRh_vgS2dFE",
    "KQ6zr6kCPj8", "XqZsoesa55w", "bx1Bh8ZvH84", "SlPhMPnQ58k",
    "RBumgq5yVrA", "AJtDXIazrMo", "lWA2pjMjpBs", "FTQbiNvZqaY",
    "oRdxUFDoQe0", "YkgkThdzX-8", "0KSOMA3QBU0", "Zi_XLOBDo_Y",
    "iS1g8G_njx8", "SiMHTK15Pik", "3tmd-ClpJxA", "L_jWHffIx5E",
    "WMweEpGlu_U", "ebXbLfLB6ng", "pUjE9H8QlA4", "uO59tfQ2TbA",
    "YVkUvmDQ3HY", "papuvlVeZg8", "k4V3Mo61fJM", "gdZLi9oWNZg",
    "IcrbM1l_BoI", "nSDgHBxUbVQ", "n1WpP7iowLc", "lYBUbBu4W08",
    "N_qFfQ4Xn_I", "tgbNymZ7vqY", "HGy9i8vvCxk", "wyz_2DEah4o",
    "JRfuAukYTKg", "5GL9JoH4Sws", "QK8mJJJvaes", "xWggTb45brM",
    "uelHwf8o7_U", "PIh2xe4jnpk", "ZbZSe6N_BXs", "1k8craCGpgs",
    "vjW8wmF5VWc", "8SbUC-UaAxE", "NUYvbT6vTPs", "TUVcZfQe-Kw",
    "mWRsgZuwf_8", "IwzUs1IMdyQ", "auSo1MyWf8g", "BjR__MnC5_0",
    "F90Cw4l-8NY", "nVjsGKrE6E8", "pBkHHoOIIn8", "AC33f65act0",
    "KolfEhV-KiA", "djV11Xbc914", "2zNSgSzhBfM", "y6120QOlsfU",
    "rYEDA3JcQqw", "6Ejga4kJUts", "rtOvBOTyX00", "8UVNT4wvIGY",
    "aiRn3Zlw3Rw", "hHW1oY26kxQ", "PT2_F-1esPk", "oofSnsGkops",
    "ru0K8uYEZWw", "PGNiXGX2nLU", "Dkk9gvTmCXY", "btPJPFnesV4",
    "M11SvDtPBhA", "Pkh8UtuejGw", "1VQ_3sBZEm0",
    "JGwWNGJdvx8", "lWA2pjMjpBs", "450p7goxZqg", "nfs8NYg7yQM",
    "hLQl3WQQoQ0", "YBHQbu5rbdQ", "fKopy74weus", "qEmFfKo7KyI",
    "DK_0jXPuIr0", "k7Cih8IAhMo", "EXe_JB4pScA", "Nj2U6rhnucI",
    "gBAfejjUQoA", "U9BwWKXjVaI", "OrHeg77LF68", "YnP0YyQRBFI",
    "hTWKbfoikeg", "fNFzfwLM72c", "dHk2lLaDzlM", "tAGnKpE4NCI",
    "YlUKcNNmywk", "oOg5VxrRTi0", "k2C5TjS2sh4", "CdqoNKCCt7A",
    "FTQbiNvZqaY", "lDK9QqIzhwk", "Gs069dndIYk", "bWcASV2bnZg",
    "9jK-NcRmVcw", "RfinBST-RV4", "L0MK7qz13bU", "1w7OgIMMRc4",
    "2vjPBrBU-TM", "IxxstCcJlsc", "gCYcHz2k5x0", "nOubjLM9Cbc",
    "sPbuPE0bSAo", "qrO4YZeyl0I", "EPo5wWmKEaI", "3O1_3zBUKM8",
    "93ASUImTedo", "QpbQ4I3Ht1Q", "1y6smkh6c-0", "pFgUluV_URc",
    "jNQXAC9IVRw", "QH2-TGUlwu4", "9Deg7VrpHbM", "0EqSXDwTq6U",
    "kfVsfOSbJY0", "dMH0bHeiRNg", "feA64wXhbjo", "TKfS5zVfGBc",
    "EE-xtCF3T94", "b1WWpKEPdT4", "C0DPdy98e4c", "ZZ5LpwO-An4",
    "ASO_zypdnsQ", "BQ0mxQXmLsk", "J---aiyznGQ", "GtL1huin9EE",
    "l_MyUGq7pgs", "vTIIMJ9tUc8", "nA5IJBNm_GI", "BddP6PYo2gs",
    "luQSQuCHtcI", "aJOTlE1K90k", "KEI4qSrkPAs", "DpHo1qs4sOA",
    "S2PY0XcjZ4k", "BBAyRBTfsOU", "jTLhHBGzKcg", "YxGbTVOruBo",
    "DroTMxBr1qk", "kkx-7fsiWgg", "WPkMUU9tUqk", "X9G3ExRTmXE",
    "bDmhlPKPD60", "o7_OWYrLVOU", "TTbMNkFljG8", "PMivT7MJ41M",
    "GeZp2Rrg8RU", "MazSzQMBjpM", "ig8XOzWJFCQ", "LOZuxwVk7TU",
    "qV0LbCMzo6Y", "O91DT1pR1ew", "tVlcKp3bWH8", "dQw4w9WgXcQ",
    "XbGs_qK2PQA", "DHjqpvDnNGE", "M930FDIaSLA", "4Y1lZQsyuSQ",
    "eVTXPUF4Oz4", "GRVgtLXoWkA", "rfscVS0vtbw", "aqz-KE-bpKQ",
    "WNeLUngb-Xg", "FuXNumBwDOM", "V-_O7nl0Ii0", "MTW4sIL9Dpw",
];

const YOUTUBE_SHORT_IDS: &[&str] = &[
    "ZTjoppSiEPA", "gQlMMD0e5Q0", "HZ5GjRJqLCo", "vTJdVE_gjI0",
    "xvFZjo5PgG0", "3AtDnEC4zak", "PNjG22Gp6m0", "CD-E-LDc384",
    "0e3GPea1Zrg", "pXRviuL6vMY", "GD3Oak4jZxQ", "Kbj2Zss-5GY",
    "dNL6RwymoNg", "Sj_9CiNkkn4", "tQ0yjYUFKAE", "W6NZfDfJ1DU",
    "a3ICNMQW7Ok", "7P0JM3h1IQk", "wXhTHyIgQ_U", "4K6Sh1tsKRs",
    "2IK3DFHRFfw", "NLqAF9hrVbY", "EG6jlBMnDOo", "nIjVOBGUx1Q",
    "rJSfVpb3A1E", "grd-K33tOSM", "V2LyhJTHIEg", "6xJGQR3cFhE",
    "s7L2PVdrb_8", "0JgF4CMXU9M", "X9tV6MjlBMA", "2lAe1cqCOXo",
    "lGaneyDfyls", "6Nqf5MbHFDk", "HgiYpSqGKOc", "tTc3hRYBqnU",
    "YnopHCL1Jk8", "LXb3EKWsInQ", "QwZT7T-TXT0", "cV2gBU6hKfY",
    "GPYzY9I78CI", "q0hyYWKXF0Q", "3jWRrafhO7M", "SqcY0GlETPk",
    "F1B9Fk_SgI0", "x7Krla_UxRg", "U4oB28CRwAo", "8vNxjwt2AqY",
    "mXB7GRWMzUc", "bE1lHGDqxqA", "X4QYV5GTz7o", "TeeJvaEIyVo",
    "7lCDEYXw3mM", "YRT4GmjBmZY", "xTjLjErS03I", "1SfxAvCJv0Y",
    "ZgkNGF2qBd0", "5K1RcKJVbHA", "KZvsrvraSwA", "Wd1Btl3U27s",
    "j4BkXJLfN_c", "B09kHlOhTJE", "YOBGcG0d9LY", "jLZ3gMHTEP0",
    "8SoTaJsiA_s", "dUp1XJ40yDE", "qQzdAsjWGPg", "6o6ahJJx2MI",
    "r-MdRNHfNpU", "OaHrS7aMfDY", "kpGo2_d3oYE", "RjwKj12LAHY",
    "TJIfnNBqjMQ", "m2uTFF_3MaA", "WfVcFkWbEDc", "fIkZOLsnoqY",
    "QYbV04b3Ajs", "sZLGXQfHPYo", "HNJhn4_vM9c", "epQkEnOAhbA",
    "j7EYxMeK36Y", "ULwUzF1q5w4", "5H_aRMODvIo", "E4pgGBRmtsA",
    "SLsTskCmFRU", "Ej3mKZbGOgg", "Kx8DOGT3gVA", "lYkPrmBOTeI",
    "Wy1SYXLHIOE", "wBQlsQ4GNLI", "RXNsGlXknPA", "P0oCBixCqxA",
    "ck3OF8L6jCQ", "Dxv7EwR_fKo", "E7a5N6kRj7Q", "N5MMi_eC-qU",
    "bY9dT7GOagI", "QxEkPuzYE7c", "ILCw1jhSCmI", "VVqEBMIGmPM",
    "tPMKm6Xnizs", "SLP9mbCuhJc", "AjWfY7SnMBI", "QOTlFnFhGGk",
    "rGx1QNdAkvY", "vB3RJwKHaKU", "Z3ZAGBL6UBA", "oFDoo3M-hIk",
    "7T2RonyJ_Ts", "N7iSSNUYhGI", "1Za8BtLgKv8", "MtN1YnoL46Q",
    "9VDvgL58h_Y", "5JnMutdy6Fw", "GoW8OCyKJ28", "HffWFd_6bJ0",
    "akFZtK0GBOs", "G4Sn91t1V4g", "W86cTIoMv2U", "z_AbfPXTKms",
    "p_IoglLh3IU", "sWt8ZIgDA9I", "RtWbpOEgPHs", "6xKWiCMKKJg",
    "3qN0DnRsIiY", "W1ilCy6XrmI", "Ec-8A5k16Ak", "VF9-sEbqDvU",
    "ICjkHCL0e4Y", "PWoAivHMaRk", "NggUSbgRUhc", "3LN_3W2YfSc",
    "jFMA5ggFsYU", "3KtWfp0UQnc", "S9uPNppGR7o", "NuwkVhj14ZE",
    "VIUEOwJaSmg", "wVyu7NB7W6Y", "Vaw6-pNBOpc", "K5pGNqGsfDQ",
    "OQyMLaP38rk", "Kkq8a6AV3HM", "VTVA0LOkjFg", "wQnm9MuLd0U",
    "Yy49qIxBHHM", "bAojxWZRVKk", "7kQsW3gZJhc", "UBRML0rXwWQ",
    "eK4UxpnTpRE", "kK42LZqO0wA", "t1TcDHrkQYg", "7gjfZABX8AI",
    "HO7bEOQ19QI", "fYMBvR0WAnI", "JZjAg6fK-BQ", "T-VWbvULnMo",
];

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

        let (video_url, platform) = if rb.is_short {
            (
                format!("https://youtube.com/shorts/{}", rb.vid),
                "youtube_short".to_string(),
            )
        } else {
            (
                format!("https://youtube.com/watch?v={}", rb.vid),
                "youtube".to_string(),
            )
        };
        let thumbnail_url = format!("https://img.youtube.com/vi/{}/mqdefault.jpg", rb.vid);

        ctx.db
            .block()
            .try_insert(Block {
                id: block_id,
                x: gx,
                y: gy,
                video_url,
                thumbnail_url,
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
                video_url: String::new(),
                thumbnail_url: String::new(),
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
