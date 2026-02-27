#!/usr/bin/env node
/**
 * Scrapes real YouTube video IDs using yt-dlp + fetch fallback.
 * No API key needed.
 *
 * Requires: pip install yt-dlp
 * Usage:    node scripts/fetch-youtube-ids.mjs
 * Output:   src/lib/youtube-ids.json → { regular: [...], shorts: [...] }
 */

import { writeFileSync, readFileSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { execFile } from "child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT = resolve(__dirname, "..", "src", "lib", "youtube-ids.json");

const TARGET_REGULAR = 12_000;
const TARGET_SHORTS = 3_000;

const YTDLP = "C:\\Users\\alesh\\AppData\\Roaming\\Python\\Python313\\Scripts\\yt-dlp.exe";

function ytdlpIds(url, max = 300) {
  return new Promise((resolve) => {
    const args = [
      "--flat-playlist", "--print", "id",
      "--playlist-end", String(max),
      "--no-warnings", "--quiet",
      url,
    ];
    execFile(YTDLP, args, { timeout: 60_000, maxBuffer: 10 * 1024 * 1024 }, (err, stdout) => {
      if (err) { resolve([]); return; }
      const ids = stdout.trim().split("\n").filter(l => /^[a-zA-Z0-9_-]{11}$/.test(l));
      resolve(ids);
    });
  });
}

// Upload playlists for top channels (UU prefix)
const UPLOAD_PLAYLISTS = [
  "UUq-Fj5jknLsUf-MWSy4_brA",  // T-Series
  "UU-lHJZR3Gqxm24_Vd_AJ5Yw",  // PewDiePie
  "UUbCmjCuTUZos6Inko4u57UQ",  // Cocomelon
  "UUEdvpU2pFRCVqU6yIPyTpMQ",  // SET India
  "UUS9y3LeSBv25sBVabTm2rkA",  // Zee Music
  "UUX6OQ3DkcsbYNE6H8uQQuVA",  // MrBeast
  "UUsBjURrPoezykLs9EqgamOA",  // Fireship
  "UURkBDiQUPqAl5ACm-v3Q_A",   // Linus Tech Tips
  "UUJ5v_MCY6GNUBTO8-D3XoAg",  // WWE
  "UUBcRF18a7Qf58cCRy5xuWwQ",  // FLAVOR TOWN
  "UUvjgXvBlCQOmhyGQVHHBSRg",  // 5-Minute Crafts
  "UUlQREKjkMSIr3MGs-IaNbDw",  // PowerfulJRE
  "UU8butISFwT-Wl7EV0hUK0BQ",  // freeCodeCamp
  "UUwRXb5dN1oSR8MflPINZ2lg",  // Dhar Mann
  "UUiGm_E4ZwYSHV3bcW1pnSeQ",  // Sidemen
  "UUsXVk37bltHxD1rDPwtNM8Q",  // Kurzgesagt
  "UUo8bcnLyZH8tBIH9V1mLgqQ",  // 3Blue1Brown
  "UULXo7UDZvByw2ixzpQCufnA",  // Vox
  "UUsooa4yRKGN_zEE8iknghZA",  // TED-Ed
  "UU0intLFzLaudFG-xAvUEO-A",  // Mark Rober
  "UU7cs8q-gJRlGwj4A8OmCmXg",  // Alex Hormozi
  "UU6nSFpj9HTCZ5t-N3Rm3HA",   // Vsauce
  "UUkQO3QsgTpNTsOw6ujimT5Q",  // Dude Perfect
  "UUBnZ16ahKA2DZ_T5W0FPUXg",  // MKBHD
  "UUZ5XnGb-MYGc1m3YK1Q7Gdg",  // Gordon Ramsay
  "UUHnyfMqiRRG1u-2MsSQLbXA",  // Veritasium
  "UUpko_-a4wgz2u_DgDgd9rqA",  // Tom Scott
  "UUvK4bOhULCpmLabd2pDMtnA",  // Steve Mould
  "UU4QZ_LsYcvcq7qOsOhpAIg",  // ColdFusion
  "UUAuUUnT6oDeKwE6v1NGQxug",  // TED
  "UU7IcJI8PUf5Z3zKxnZvTBog",  // School of Life
  "UUYen28t8k0SYamqg5cVnOlg",  // AsapSCIENCE
  "UUnz-ZXXER4jOvuED5-Wkjyw",  // Jubilee
  "UUF1CdDzPEoIizEDCT-JnKBg",  // Slow Mo Guys
  "UUOpcACMWblDls9Z6GERNTlw",  // Tasty
  "UUWqr7KOwM4PqxkqcsNEbung",  // NileRed
  "UU2Qw1dzXDBAZPwS7at6Lsag",  // Real Engineering
  "UU9-y-6csu5WGm29I7JiwpnA",  // Computerphile
  "UUESLWHGPl2Fq7gip9C_yQQ",   // Numberphile
  "UUe_vXdMem8S-9pMBOH8mBag",  // Philip DeFranco
  "UUaWd5_7JhbQBe4dknZhsHJg",  // SciShow
  "UUxH0sRvvJHo_ULPExrOVG-A",  // SmarterEveryDay
  "UUpNCbECmEOJ_LdKJOh5grw",   // Practical Eng
  "UUDVjAoWRuE-5O_5CbjF3vw",   // Stuff Made Here
  "UUHPHVSb2_dpxrH-HAtV4Okw",  // Game Theory
  "UUFnQC_A0HoL1pPBNHBFnmiw",  // FailArmy
  "UUPDXXXJj9nax0fr0Wfc048g",  // CollegeHumor
  "UUe-tkd8A_xnwdMD36_uQEMg",  // New Rockstars
  "UUMCgOm8GZkHp8zJ6l7_hIuA",  // Vice
  "UUpyTe_eFKNYqKgLy8Kyllg",   // Insider
];

const SEARCH_QUERIES = [
  "music video 2024", "tutorial beginner", "gaming highlights",
  "cooking recipe easy", "workout home", "travel vlog 2024",
  "tech review", "comedy skit", "science explained",
  "documentary 2024", "diy project", "dance tutorial",
  "street food tour", "nature documentary", "history documentary",
  "math explained", "piano cover popular", "guitar tutorial beginner",
  "art tutorial", "photography vlog", "coding python",
  "startup business", "chess tutorial", "basketball NBA",
  "soccer highlights", "football NFL", "boxing highlights",
  "minecraft lets play", "fortnite chapter", "horror game playthrough",
  "movie review 2024", "album review", "book summary",
  "astronomy stars", "pop songs 2024", "hip hop beats",
  "rock music live", "jazz music", "kpop music video",
  "indian music", "spanish music", "french cooking",
  "japanese food", "korean food mukbang", "mexican street food",
  "thai cooking", "italian recipe pasta", "bbq grilling",
  "vegan cooking", "dessert recipe", "bread baking",
  "home renovation", "interior design", "tiny house tour",
  "van life", "camping adventure", "hiking mountains",
  "yoga beginner", "meditation relaxing", "skincare routine",
  "fashion lookbook", "makeup tutorial 2024", "hair tutorial",
  "stand up comedy", "magic trick", "prank funny",
  "asmr triggers", "satisfying compilation", "top 10 amazing",
  "celebrity interview", "anime review", "true crime story",
  "film analysis", "viral video", "stock market",
  "crypto analysis", "real estate tips", "passive income",
  "small business ideas", "marketing tips", "budget finance",
  "car review 2024", "motorcycle ride", "electric vehicle",
  "airplane cockpit", "train journey", "boat fishing",
  "oil painting", "digital drawing", "sculpture art",
  "woodworking project", "pottery making", "origami tutorial",
  "japan travel", "europe backpacking", "africa wildlife",
  "new york vlog", "london travel", "paris vlog",
  "tokyo food tour", "dubai luxury", "bali travel",
  "drone footage", "timelapse nature", "slow motion satisfying",
  "unboxing tech", "product review honest", "how things work",
  "day in my life", "extreme sports", "world record",
  "react js tutorial", "next js", "rust programming language",
  "machine learning project", "ai news 2024", "linux tutorial",
  "web design figma", "mobile app flutter", "game development unity",
  "nba playoff", "premier league match", "formula 1 race",
  "tennis match", "golf tips", "swimming tutorial",
  "ufc fight", "martial arts training", "skateboard tricks",
  "surf big waves", "rock climbing", "crossfit competition",
  "motivation speech", "ted talk best", "podcast episode full",
  "lofi hip hop stream", "study music", "sleep sounds rain",
  "electric guitar solo", "drum cover", "violin performance",
  "opera singing", "beat making fl studio", "music production",
  "film photography", "street photography", "landscape photography",
  "architecture tour", "museum virtual tour", "art gallery walk",
  "space exploration", "physics lecture", "chemistry experiment cool",
  "biology documentary ocean", "geology rocks minerals", "archaeology discovery",
  "ancient civilization", "world war documentary", "cold war explained",
  "philosophy lecture", "psychology explained", "economics crash course",
  "language learning tips", "learn spanish", "learn japanese",
  "calligraphy tutorial", "lego build", "model train",
  "aquarium setup", "pet dog training", "cat funny compilation",
  "horse riding", "farm life vlog", "beekeeping tutorial",
  "car restoration", "engine rebuild", "off road 4x4",
];

// Shorts playlists (channel shorts tabs)
const SHORTS_CHANNELS = [
  "UCX6OQ3DkcsbYNE6H8uQQuVA",  // MrBeast
  "UCq-Fj5jknLsUf-MWSy4_brA",  // T-Series
  "UC-lHJZR3Gqxm24_Vd_AJ5Yw",  // PewDiePie
  "UCam9AKLiqnMkHHPMOgDBNcA",  // Speed
  "UCsBjURrPoezykLs9EqgamOA",  // Fireship
  "UCiGm_E4ZwYSHV3bcW1pnSeQ",  // Sidemen
  "UCvjgXvBlCQOmhyGQVHHBSRg",  // 5-Minute Crafts
  "UCwRXb5dN1oSR8MflPINZ2lg",  // Dhar Mann
  "UCkQO3QsgTpNTsOw6ujimT5Q",  // Dude Perfect
  "UC0intLFzLaudFG-xAvUEO-A",  // Mark Rober
  "UCGbshtvS9t-8CHL9QKDp9Bw",  // ZHC
  "UCFnQC_A0HoL1pPBNHBFnmiw",  // FailArmy
  "UCnz-ZXXER4jOvuED5-Wkjyw",  // Jubilee
  "UCOpcACMWblDls9Z6GERNTlw",  // Tasty
  "UCBnZ16ahKA2DZ_T5W0FPUXg",  // MKBHD
];

async function main() {
  let existing = { regular: [], shorts: [] };
  if (existsSync(OUTPUT)) {
    try { existing = JSON.parse(readFileSync(OUTPUT, "utf-8")); } catch { /* fresh */ }
  }

  const regular = new Set(existing.regular);
  const shorts = new Set(existing.shorts);
  const startR = regular.size, startS = shorts.size;

  console.log(`Starting: ${regular.size} regular + ${shorts.size} shorts`);
  console.log(`Targets: ${TARGET_REGULAR} regular, ${TARGET_SHORTS} shorts\n`);

  // Phase 1: Upload playlists via yt-dlp (300 IDs each)
  if (regular.size < TARGET_REGULAR) {
    console.log(`--- Phase 1: Upload playlists via yt-dlp (${UPLOAD_PLAYLISTS.length} sources, 300 each) ---\n`);
    for (let i = 0; i < UPLOAD_PLAYLISTS.length; i++) {
      if (regular.size >= TARGET_REGULAR) break;
      const pid = UPLOAD_PLAYLISTS[i];
      const before = regular.size;
      const url = `https://www.youtube.com/playlist?list=${pid}`;
      const ids = await ytdlpIds(url, 300);
      for (const id of ids) regular.add(id);
      console.log(`  [${i + 1}/${UPLOAD_PLAYLISTS.length}] ${pid}: +${regular.size - before} (total: ${regular.size})`);
    }
  }

  // Phase 2: Search queries via yt-dlp
  if (regular.size < TARGET_REGULAR) {
    console.log(`\n--- Phase 2: Search queries via yt-dlp (${SEARCH_QUERIES.length} queries) ---\n`);
    for (let i = 0; i < SEARCH_QUERIES.length; i++) {
      if (regular.size >= TARGET_REGULAR) break;
      const q = SEARCH_QUERIES[i];
      const before = regular.size;
      const url = `ytsearch50:${q}`;
      const ids = await ytdlpIds(url, 50);
      for (const id of ids) regular.add(id);
      console.log(`  [${i + 1}/${SEARCH_QUERIES.length}] "${q}": +${regular.size - before} (total: ${regular.size})`);
    }
  }

  // Phase 3: Shorts via yt-dlp
  if (shorts.size < TARGET_SHORTS) {
    console.log(`\n--- Phase 3: Shorts via yt-dlp (${SHORTS_CHANNELS.length} channels, 200 each) ---\n`);
    for (let i = 0; i < SHORTS_CHANNELS.length; i++) {
      if (shorts.size >= TARGET_SHORTS) break;
      const cid = SHORTS_CHANNELS[i];
      const before = shorts.size;
      const url = `https://www.youtube.com/channel/${cid}/shorts`;
      const ids = await ytdlpIds(url, 200);
      for (const id of ids) shorts.add(id);
      console.log(`  [${i + 1}/${SHORTS_CHANNELS.length}] ${cid}: +${shorts.size - before} (total: ${shorts.size})`);
    }
  }

  // Remove overlap
  for (const id of shorts) regular.delete(id);

  const result = { regular: [...regular], shorts: [...shorts] };
  console.log(`\n=== Results ===`);
  console.log(`Regular: ${result.regular.length} (+${result.regular.length - startR} new)`);
  console.log(`Shorts:  ${result.shorts.length} (+${result.shorts.length - startS} new)`);
  console.log(`Total:   ${result.regular.length + result.shorts.length}`);

  writeFileSync(OUTPUT, JSON.stringify(result));
  console.log(`\nWritten to ${OUTPUT}`);
}

main().catch(console.error);
