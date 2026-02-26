import { type Block } from "@/stores/blocks-store";
import { GRID_COLS, BlockStatus, Platform, CENTER_X, CENTER_Y, isAdSlot, getAdSlots } from "@/lib/constants";
import { batchSpiralCoordinates } from "@/lib/canvas/spiral-layout";

function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const YOUTUBE_IDS = [
  "dQw4w9WgXcQ", "jNQXAC9IVRw", "9bZkp7q19f0", "kJQP7kiw5Fk",
  "RgKAFK5djSk", "fJ9rUzIMcZQ", "JGwWNGJdvx8", "hT_nvWreIhg",
  "OPf0YbXqDm0", "CevxZvSJLk8", "09R8_2nJtjg", "YQHsXMglC9A",
  "lp-EO5I60KA", "bo_efYhYU2A", "7wtfhZwyrcc", "e-ORhEE9VVg",
  "kXYiU_JCYtU", "2Vv-BfVoq4g", "60ItHLz5WEA", "hLQl3WQQoQ0",
  "pRpeEdMmmQ0", "LsoLEjrDogU", "nfWlot6h_JM", "HP-MbfHFUqs",
  "DyDfgMOUjCI", "pt8VYOfr8To", "QYh6mYIJG2Y", "YR5ApYxkU-U",
  "fRh_vgS2dFE", "KQ6zr6kCPj8", "XqZsoesa55w", "bx1Bh8ZvH84",
  "SlPhMPnQ58k", "RBumgq5yVrA", "AJtDXIazrMo", "lWA2pjMjpBs",
  "FTQbiNvZqaY", "oRdxUFDoQe0", "YkgkThdzX-8", "0KSOMA3QBU0",
  "Zi_XLOBDo_Y", "iS1g8G_njx8", "SiMHTK15Pik", "3tmd-ClpJxA",
  "L_jWHffIx5E", "WMweEpGlu_U", "ebXbLfLB6ng", "pUjE9H8QlA4",
  "uO59tfQ2TbA", "YVkUvmDQ3HY", "papuvlVeZg8", "k4V3Mo61fJM",
  "gdZLi9oWNZg", "IcrbM1l_BoI", "nSDgHBxUbVQ", "n1WpP7iowLc",
  "lYBUbBu4W08", "N_qFfQ4Xn_I", "tgbNymZ7vqY", "HGy9i8vvCxk",
  "wyz_2DEah4o", "JRfuAukYTKg", "5GL9JoH4Sws", "QK8mJJJvaes",
  "xWggTb45brM", "uelHwf8o7_U", "PIh2xe4jnpk", "ZbZSe6N_BXs",
  "1k8craCGpgs", "vjW8wmF5VWc", "8SbUC-UaAxE", "NUYvbT6vTPs",
  "TUVcZfQe-Kw", "mWRsgZuwf_8", "IwzUs1IMdyQ", "auSo1MyWf8g",
  "BjR__MnC5_0", "F90Cw4l-8NY", "nVjsGKrE6E8", "pBkHHoOIIn8",
  "AC33f65act0", "KolfEhV-KiA", "djV11Xbc914", "2zNSgSzhBfM",
  "y6120QOlsfU", "rYEDA3JcQqw", "6Ejga4kJUts", "rtOvBOTyX00",
  "8UVNT4wvIGY", "aiRn3Zlw3Rw", "hHW1oY26kxQ", "PT2_F-1esPk",
  "oofSnsGkops", "ru0K8uYEZWw", "PGNiXGX2nLU", "Dkk9gvTmCXY",
  "btPJPFnesV4", "M11SvDtPBhA", "Pkh8UtuejGw", "1VQ_3sBZEm0",
];

const YOUTUBE_SHORT_IDS = [
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
];

const FIRST_NAMES = [
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

const LAST_NAMES = [
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

const SHORTS_RATIO = 0.35;
const VIDEO_COUNT = 30_000;
const SEED = 42;

export function generateMockBlocks(): Block[] {
  const rng = mulberry32(SEED);

  // 1. Generate raw video blocks with random scores
  const raw: Array<{
    vid: string; firstName: string; lastName: string;
    likes: number; dislikes: number; claimedAt: number;
    isShort: boolean;
  }> = [];

  for (let i = 0; i < VIDEO_COUNT; i++) {
    const isShort = rng() < SHORTS_RATIO;
    const vid = isShort
      ? YOUTUBE_SHORT_IDS[Math.floor(rng() * YOUTUBE_SHORT_IDS.length)]
      : YOUTUBE_IDS[Math.floor(rng() * YOUTUBE_IDS.length)];
    const firstName = FIRST_NAMES[Math.floor(rng() * FIRST_NAMES.length)];
    const lastName = LAST_NAMES[Math.floor(rng() * LAST_NAMES.length)];
    const likes = Math.floor(rng() * 50_000);
    const dislikes = Math.floor(rng() * likes * 0.3);
    const claimedAt = Date.now() - Math.floor(rng() * 86_400_000 * 30);
    raw.push({ vid, firstName, lastName, likes, dislikes, claimedAt, isShort });
  }

  // 2. Sort by net score descending — highest score goes to center
  raw.sort((a, b) => (b.likes - b.dislikes) - (a.likes - a.dislikes));

  // 3. Assign spiral positions (skipping ad slots) — single incremental walk
  const blocks: Block[] = [];
  const coords = batchSpiralCoordinates(raw.length);

  for (let i = 0; i < raw.length; i++) {
    const { vid, firstName, lastName, likes, dislikes, claimedAt, isShort } = raw[i];
    const coord = coords[i];
    const gx = coord.x;
    const gy = coord.y;
    const id = gy * GRID_COLS + gx;

    blocks.push({
      id,
      x: gx,
      y: gy,
      videoUrl: isShort
        ? `https://youtube.com/shorts/${vid}`
        : `https://youtube.com/watch?v=${vid}`,
      thumbnailUrl: `https://img.youtube.com/vi/${vid}/mqdefault.jpg`,
      platform: isShort ? Platform.YouTubeShort : Platform.YouTube,
      ownerIdentity: `user_${i}`,
      ownerName: `${firstName} ${lastName}`,
      likes,
      dislikes,
      status: BlockStatus.Claimed,
      adImageUrl: null,
      adLinkUrl: null,
      claimedAt,
    });
  }

  // 4. Add ad placeholder blocks at all reserved ad slots
  const adSlots = getAdSlots();
  for (const slot of adSlots) {
    const adId = slot.row * GRID_COLS + slot.col;
    if (blocks.some((b) => b.id === adId)) continue;
    blocks.push({
      id: adId,
      x: slot.col,
      y: slot.row,
      videoUrl: null,
      thumbnailUrl: null,
      platform: null,
      ownerIdentity: null,
      ownerName: null,
      likes: 0,
      dislikes: 0,
      status: BlockStatus.Ad,
      adImageUrl: null,
      adLinkUrl: null,
      claimedAt: null,
    });
  }

  return blocks;
}
