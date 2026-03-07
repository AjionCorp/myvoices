#!/usr/bin/env node
/**
 * Generates 65,000 mock topics (1,000 per category) + a full taxonomy tree
 * aligned with the 65 CATEGORIES defined in src/lib/constants.ts.
 * Real YouTube IDs from src/lib/youtube-ids.json are cycled as thumbnails.
 *
 * Usage:   node scripts/generate-mock-topics.mjs
 * Output:  src/lib/mock-topics.json  (compact JSON, ~25–30 MB)
 */

import { writeFileSync, readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const YT_IDS_PATH = resolve(__dirname, "..", "src", "lib", "youtube-ids.json");
const OUTPUT_PATH = resolve(__dirname, "..", "src", "lib", "mock-topics.json");

// Configurable — reduce if file size is a concern
const TOPICS_PER_CATEGORY = 1_000;

// ---------------------------------------------------------------------------
// Seeded RNG (Mulberry32 — matches the one used across the project)
// ---------------------------------------------------------------------------
function mulberry32(seed) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rng = mulberry32(42);
function randInt(min, max) { return min + Math.floor(rng() * (max - min + 1)); }
function slugify(str) {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

// ---------------------------------------------------------------------------
// Fallbacks (only used if youtube-ids.json is missing)
// ---------------------------------------------------------------------------
const FALLBACK_IDS = [
  "dQw4w9WgXcQ","9bZkp7q19f0","kJQP7kiw5Fk","RgKAFK5djSk","JGwWNGJdvx8",
  "fJ9rUzIMcZQ","hT_nvWreIhg","OPf0YbXqDm0","CevxZvSJLk8","09R8_2nJtjg",
];
const FALLBACK_SHORT_IDS = [
  "ZTjoppSiEPA","gQlMMD0e5Q0","HZ5GjRJqLCo","vTJdVE_gjI0","xvFZjo5PgG0",
];

// ---------------------------------------------------------------------------
// YouTube IDs — cycle through all available real IDs
// ---------------------------------------------------------------------------
let ytIds;
try {
  ytIds = JSON.parse(readFileSync(YT_IDS_PATH, "utf8"));
} catch {
  console.warn("⚠  youtube-ids.json not found — using fallback IDs");
  ytIds = { regular: FALLBACK_IDS, shorts: FALLBACK_SHORT_IDS };
}
const ALL_IDS = [...ytIds.regular, ...ytIds.shorts];
let ytCursor = 0;
function pickVideoId() {
  const id = ALL_IDS[ytCursor % ALL_IDS.length];
  ytCursor++;
  return id;
}
function thumbUrl(id) { return `https://img.youtube.com/vi/${id}/mqdefault.jpg`; }

// ---------------------------------------------------------------------------
// Taxonomy — all 65 categories from constants.ts, each with 5–7 subcategories
// and 4–5 leaf sub-subcategories. The top-level `category` string matches
// CATEGORIES in src/lib/constants.ts exactly.
// ---------------------------------------------------------------------------
const TAXONOMY = [
  // ── Discourse & Ideas ────────────────────────────────────────────────────
  {
    category: "Ideas & Solutions",
    subs: [
      { name: "Innovation & Startups",      subs: ["Product Design", "Disruptive Ideas", "Tech Startups", "Bootstrapping", "Lean Innovation"] },
      { name: "Policy & Governance",         subs: ["Policy Reform", "Local Government", "Global Policy", "Democracy & Voting"] },
      { name: "Social Entrepreneurship",     subs: ["Impact Business", "Community Projects", "NGO Strategy", "Grassroots Movements"] },
      { name: "Creative Problem Solving",    subs: ["Design Thinking", "Systems Thinking", "Lateral Thinking", "Brainstorming Methods"] },
      { name: "Future Ideas",                subs: ["Futurism", "Speculative Design", "Utopian Visions", "Tech Futures"] },
      { name: "Open Source Solutions",       subs: ["Open Hardware", "Civic Tech", "Collaborative Research", "Knowledge Commons"] },
    ],
  },
  {
    category: "Politics",
    subs: [
      { name: "US Politics",                 subs: ["Congress & Senate", "Presidential Politics", "Supreme Court", "Political Parties"] },
      { name: "European Politics",           subs: ["EU Policy", "Brexit Aftermath", "Far Right Rise", "Social Democrats"] },
      { name: "Political Theory",            subs: ["Liberalism", "Conservatism", "Socialism", "Libertarianism", "Anarchism"] },
      { name: "Elections & Democracy",       subs: ["Voting Systems", "Campaign Finance", "Election Security", "Voter Rights"] },
      { name: "Political Movements",         subs: ["Progressive Movements", "Populism", "Nationalist Movements", "Reform Coalitions"] },
      { name: "Global Politics",             subs: ["BRICS Nations", "G7 & G20", "UN & International Law", "Sanctions & Diplomacy"] },
    ],
  },
  {
    category: "News & Media",
    subs: [
      { name: "Breaking News",               subs: ["World Events", "Natural Disasters", "Political Crises", "Economic News"] },
      { name: "Investigative Journalism",    subs: ["Corporate Investigations", "Government Leaks", "War Reporting", "Data Journalism"] },
      { name: "Media Criticism",             subs: ["Bias & Framing", "Ownership & Power", "Social Media News", "Fake News"] },
      { name: "Independent Media",           subs: ["Citizen Journalism", "Newsletters", "Podcasts as News", "YouTube News"] },
      { name: "Fact Checking",               subs: ["Debunking Myths", "Political Fact Checks", "Health Claims", "Climate Facts"] },
      { name: "Digital Journalism",          subs: ["Newsletter Media", "Substack Writers", "Long-Form Online", "Multimedia Reporting"] },
    ],
  },
  {
    category: "Geopolitics & War",
    subs: [
      { name: "Current Conflicts",           subs: ["Middle East Tensions", "Eastern Europe", "Africa", "Asia-Pacific"] },
      { name: "Military Strategy",           subs: ["Modern Warfare", "Naval Strategy", "Air Power", "Cyber Warfare"] },
      { name: "Diplomacy & Treaties",        subs: ["NATO", "Peace Negotiations", "Trade Agreements", "International Law"] },
      { name: "Historical Wars",             subs: ["World War II", "Cold War", "Vietnam War", "Colonial Conflicts"] },
      { name: "Intelligence & Espionage",    subs: ["CIA & NSA", "Russian Intelligence", "Spy Stories", "Surveillance States"] },
      { name: "Economic Warfare",            subs: ["Sanctions", "Trade Wars", "Resource Conflicts", "Financial Warfare"] },
    ],
  },
  {
    category: "Society & Culture",
    subs: [
      { name: "Social Issues",               subs: ["Inequality", "Poverty", "Housing Crisis", "Immigration Debate"] },
      { name: "Cultural Trends",             subs: ["Gen Z Culture", "Millennial Shifts", "Pop Culture Impact", "Cancel Culture"] },
      { name: "Identity & Community",        subs: ["Race & Ethnicity", "Class & Status", "Gender Roles", "Community Building"] },
      { name: "Education & Society",         subs: ["University Culture", "School Systems", "Homeschooling", "Skills Gap"] },
      { name: "Technology & Society",        subs: ["Screen Time", "Algorithmic Life", "AI & Society", "Digital Divide"] },
      { name: "Demographics & Change",       subs: ["Aging Populations", "Urbanization", "Migration Patterns", "Birth Rate Decline"] },
    ],
  },
  {
    category: "LGBTQ+",
    subs: [
      { name: "Identity & Coming Out",       subs: ["Coming Out Stories", "Gender Identity", "Sexual Orientation", "Non-Binary Life"] },
      { name: "LGBTQ+ Rights",               subs: ["Marriage Equality", "Trans Rights", "Anti-Discrimination Law", "Global Rights"] },
      { name: "Queer Culture",               subs: ["Pride Events", "Drag Culture", "Queer Art & Film", "LGBTQ+ History"] },
      { name: "Health & Wellbeing",          subs: ["Mental Health in LGBTQ+", "Trans Healthcare", "HIV & AIDS", "Aging in LGBTQ+"] },
      { name: "Community & Support",         subs: ["LGBTQ+ Organizations", "Online Communities", "Allyship", "Youth Support"] },
    ],
  },
  {
    category: "Conspiracy & Alternative",
    subs: [
      { name: "Government Conspiracies",     subs: ["Deep State", "Secret Programs", "Political Cover-Ups", "Intelligence Ops"] },
      { name: "Health Conspiracies",         subs: ["Vaccine Debates", "Big Pharma", "Alternative Cures", "Medical Cover-Ups"] },
      { name: "Historical Revisionism",      subs: ["Moon Landing Theories", "Historical Alterations", "Hidden Histories", "Suppressed Science"] },
      { name: "Secret Societies",            subs: ["Illuminati", "Freemasonry", "Bilderberg Group", "Elite Networks"] },
      { name: "Alien & Fringe Theories",     subs: ["UFO Sightings", "Area 51", "Ancient Aliens", "Simulation Theory"] },
    ],
  },
  {
    category: "Paranormal & Supernatural",
    subs: [
      { name: "UFOs & Extraterrestrials",    subs: ["UAP Evidence", "Alien Abductions", "Government Disclosure", "SETI"] },
      { name: "Ghosts & Hauntings",          subs: ["Haunted Places", "Ghost Investigations", "Poltergeists", "EVP Evidence"] },
      { name: "Cryptids & Creatures",        subs: ["Bigfoot", "Loch Ness Monster", "Chupacabra", "Sea Monsters"] },
      { name: "Psychic Phenomena",           subs: ["ESP & Telepathy", "Remote Viewing", "Precognition", "Near-Death Experiences"] },
      { name: "Ancient Mysteries",           subs: ["Pyramids & Egypt", "Lost Civilizations", "Ancient Technology", "Stonehenge"] },
    ],
  },
  {
    category: "Philosophy & Ethics",
    subs: [
      { name: "Ethics & Morality",           subs: ["Utilitarianism", "Deontology", "Virtue Ethics", "Applied Ethics"] },
      { name: "Metaphysics",                 subs: ["Free Will", "Consciousness", "Time & Space", "Reality & Perception"] },
      { name: "Political Philosophy",        subs: ["Justice", "Rights & Liberty", "Social Contract", "Power & Authority"] },
      { name: "Existentialism",              subs: ["Meaning of Life", "Absurdism", "Nihilism", "Authenticity"] },
      { name: "Eastern Philosophy",          subs: ["Taoism", "Buddhism", "Confucianism", "Vedanta"] },
      { name: "Logic & Critical Thinking",   subs: ["Logical Fallacies", "Argumentation", "Epistemology", "Rationalism"] },
    ],
  },
  {
    category: "Religion & Spirituality",
    subs: [
      { name: "Christianity",                subs: ["Catholicism", "Evangelicalism", "Protestant Traditions", "Biblical Studies"] },
      { name: "Islam",                       subs: ["Sunni & Shia", "Sufism", "Islamic History", "Modern Islam"] },
      { name: "Buddhism",                    subs: ["Theravada", "Zen Buddhism", "Tibetan Buddhism", "Buddhist Practice"] },
      { name: "Hinduism",                    subs: ["Vedanta", "Yoga Philosophy", "Hindu Mythology", "Devotional Paths"] },
      { name: "New Age & Spirituality",      subs: ["Astrology", "Tarot & Divination", "Manifestation", "Energy Healing"] },
      { name: "Comparative Religion",        subs: ["World Religions", "Interfaith Dialogue", "Sacred Texts", "Religious History"] },
    ],
  },
  {
    category: "Nonprofits & Activism",
    subs: [
      { name: "Environmental Activism",      subs: ["Climate Protests", "Conservation Campaigns", "Green Policy", "Eco Movements"] },
      { name: "Human Rights",                subs: ["Civil Rights", "Refugee Rights", "Labor Rights", "Women's Rights"] },
      { name: "Animal Welfare",              subs: ["Animal Rights", "Wildlife Conservation", "Shelter & Rescue", "Factory Farming"] },
      { name: "Social Justice",              subs: ["Racial Justice", "Economic Justice", "Prison Reform", "Education Access"] },
      { name: "Community Organizing",        subs: ["Grassroots Campaigns", "Mutual Aid", "Voter Registration", "Coalition Building"] },
    ],
  },

  // ── Knowledge ─────────────────────────────────────────────────────────────
  {
    category: "History",
    subs: [
      { name: "Ancient Civilizations",       subs: ["Egypt & North Africa", "Greece & Rome", "Mesopotamia", "Mesoamerican Empires"] },
      { name: "Medieval History",            subs: ["Crusades", "Feudal Systems", "Black Plague", "Medieval Culture"] },
      { name: "Modern History",              subs: ["World Wars", "Cold War", "Decolonization", "Civil Rights Era"] },
      { name: "Military History",            subs: ["Famous Battles", "War Technology", "Great Generals", "Resistance Movements"] },
      { name: "Cultural History",            subs: ["Art History", "Music History", "Food History", "Fashion Through Ages"] },
      { name: "Hidden & Forgotten History",  subs: ["Forgotten Events", "Suppressed Narratives", "Alternative Perspectives", "Lost Civilizations"] },
    ],
  },
  {
    category: "Science",
    subs: [
      { name: "Physics",                     subs: ["Classical Mechanics", "Quantum Physics", "Relativity", "Particle Physics"] },
      { name: "Chemistry",                   subs: ["Organic Chemistry", "Chemical Reactions", "Materials Science", "Biochemistry"] },
      { name: "Biology",                     subs: ["Cell Biology", "Genetics", "Evolution", "Ecology"] },
      { name: "Earth Sciences",              subs: ["Geology", "Meteorology", "Oceanography", "Plate Tectonics"] },
      { name: "Scientific Method",           subs: ["Peer Review", "Replication Crisis", "Research Methods", "Scientific Thinking"] },
      { name: "Emerging Research",           subs: ["Breakthrough Studies", "New Discoveries", "Interdisciplinary Science", "Science News"] },
    ],
  },
  {
    category: "Space & Astronomy",
    subs: [
      { name: "Solar System",                subs: ["Planets & Moons", "Mars Exploration", "Asteroids & Comets", "The Sun"] },
      { name: "Deep Space",                  subs: ["Black Holes", "Neutron Stars", "Galaxies", "Exoplanets"] },
      { name: "Space Exploration",           subs: ["NASA Missions", "SpaceX & Commercial", "Moon Base Plans", "Mars Colonization"] },
      { name: "Cosmology",                   subs: ["Big Bang Theory", "Dark Matter", "Dark Energy", "The Multiverse"] },
      { name: "Space Technology",            subs: ["Rocket Science", "Telescopes", "Satellites", "Space Stations"] },
    ],
  },
  {
    category: "Technology",
    subs: [
      { name: "Software Development",        subs: ["Web Development", "Mobile Apps", "Backend Systems", "DevOps & CI/CD"] },
      { name: "Hardware & Gadgets",          subs: ["CPUs & GPUs", "Consumer Electronics", "Smart Home", "Wearables"] },
      { name: "Cybersecurity",               subs: ["Ethical Hacking", "Data Privacy", "Network Security", "Malware & Threats"] },
      { name: "Open Source",                 subs: ["Linux", "Open Source Projects", "Contributing to OSS", "Self-Hosting"] },
      { name: "Emerging Technology",         subs: ["Quantum Computing", "Nanotechnology", "Biotechnology", "Extended Reality"] },
      { name: "Tech Industry",               subs: ["Big Tech Companies", "Tech Startups", "Tech Policy & Regulation", "Silicon Valley Culture"] },
    ],
  },
  {
    category: "Artificial Intelligence",
    subs: [
      { name: "Machine Learning",            subs: ["Supervised Learning", "Unsupervised Learning", "Reinforcement Learning", "Neural Networks"] },
      { name: "Generative AI",               subs: ["Large Language Models", "AI Image Generation", "AI Video & Audio", "Multimodal AI"] },
      { name: "AI Applications",             subs: ["AI in Healthcare", "AI in Finance", "AI in Education", "AI in Creative Work"] },
      { name: "AI Ethics & Policy",          subs: ["Bias & Fairness", "AI Safety", "Regulation & Governance", "Alignment Problem"] },
      { name: "Robotics & Automation",       subs: ["Industrial Robots", "Humanoid Robots", "Autonomous Vehicles", "Drone Technology"] },
      { name: "AI Tools & Tutorials",        subs: ["ChatGPT & LLMs", "Midjourney & Diffusion", "AI Coding Tools", "Prompt Engineering"] },
    ],
  },
  {
    category: "Education",
    subs: [
      { name: "Learning Methods",            subs: ["Spaced Repetition", "Active Recall", "Mind Mapping", "Project-Based Learning"] },
      { name: "Higher Education",            subs: ["University Life", "College Admissions", "Research & Academia", "Student Finance"] },
      { name: "K-12 Education",              subs: ["Teaching Methods", "Curriculum Design", "Special Education", "School Reform"] },
      { name: "Online Learning",             subs: ["MOOCs", "Bootcamps", "YouTube Education", "Online Degrees"] },
      { name: "STEM Education",              subs: ["Math Education", "Science Experiments", "Coding for Kids", "Engineering Projects"] },
      { name: "Skill Development",           subs: ["Soft Skills", "Technical Skills", "Career Learning", "Self-Taught Journeys"] },
    ],
  },
  {
    category: "Literature & Books",
    subs: [
      { name: "Fiction",                     subs: ["Literary Fiction", "Genre Fiction", "Short Stories", "Experimental Writing"] },
      { name: "Non-Fiction",                 subs: ["Biographies & Memoirs", "History Books", "Science Writing", "Essays & Criticism"] },
      { name: "Book Reviews & Analysis",     subs: ["Contemporary Reviews", "Classic Analysis", "Reading Lists", "Book Clubs"] },
      { name: "Writing & Craft",             subs: ["Creative Writing", "Screenwriting", "Journalism", "Publishing Industry"] },
      { name: "Poetry & Spoken Word",        subs: ["Classic Poetry", "Modern Poetry", "Spoken Word", "Performance Poetry"] },
    ],
  },
  {
    category: "Science Fiction & Fantasy",
    subs: [
      { name: "Classic Science Fiction",     subs: ["Golden Age SF", "Cyberpunk", "Space Opera", "Hard SF"] },
      { name: "Modern Fantasy",              subs: ["Epic Fantasy", "Urban Fantasy", "Dark Fantasy", "Grimdark"] },
      { name: "Dystopian & Post-Apocalyptic",subs: ["Post-Apocalyptic", "Dystopian Societies", "Climate Fiction", "Survival Sci-Fi"] },
      { name: "Fantasy World Building",      subs: ["Magic Systems", "Fantasy Races", "Tolkien Legacy", "Map & Lore Design"] },
      { name: "Sci-Fi & Fantasy Media",      subs: ["Sci-Fi Films", "Fantasy Series", "Anime Adaptations", "Video Game Lore"] },
    ],
  },
  {
    category: "Psychology & Behavior",
    subs: [
      { name: "Cognitive Psychology",        subs: ["Memory & Learning", "Attention", "Decision Making", "Cognitive Biases"] },
      { name: "Social Psychology",           subs: ["Group Dynamics", "Conformity & Influence", "Prejudice", "Interpersonal Relations"] },
      { name: "Personality & Traits",        subs: ["Big Five Personality", "MBTI & Typology", "Dark Triad", "Emotional Intelligence"] },
      { name: "Behavioral Economics",        subs: ["Nudge Theory", "Loss Aversion", "Irrational Behavior", "Consumer Psychology"] },
      { name: "Neuroscience",                subs: ["Brain Structure", "Neuroplasticity", "Dopamine & Reward", "Sleep & the Brain"] },
      { name: "Positive Psychology",         subs: ["Flow State", "Resilience", "Well-being Science", "Happiness Research"] },
    ],
  },
  {
    category: "Language & Linguistics",
    subs: [
      { name: "Language Learning",           subs: ["Spanish", "Japanese", "Mandarin Chinese", "French & German"] },
      { name: "Linguistics",                 subs: ["Syntax & Grammar", "Phonetics", "Semantics", "Sociolinguistics"] },
      { name: "Etymology & Language History",subs: ["Word Origins", "Language Evolution", "Dead Languages", "Proto-Languages"] },
      { name: "Communication Skills",        subs: ["Public Speaking", "Persuasion", "Writing Skills", "Active Listening"] },
      { name: "Language & Identity",         subs: ["Dialects & Accents", "Code Switching", "Language Preservation", "Multilingualism"] },
    ],
  },
  {
    category: "Environment",
    subs: [
      { name: "Climate Change",              subs: ["Climate Science", "Global Warming", "Climate Policy", "Climate Solutions"] },
      { name: "Conservation",                subs: ["Wildlife Conservation", "Forest Protection", "Ocean Conservation", "Endangered Species"] },
      { name: "Sustainability",              subs: ["Zero Waste", "Renewable Energy", "Sustainable Living", "Circular Economy"] },
      { name: "Pollution & Waste",           subs: ["Plastic Pollution", "Air Quality", "Water Contamination", "E-Waste"] },
      { name: "Biodiversity",                subs: ["Ecosystem Health", "Invasive Species", "Rewilding", "Coral Reef Crisis"] },
    ],
  },

  // ── Life & Wellbeing ──────────────────────────────────────────────────────
  {
    category: "Health & Wellness",
    subs: [
      { name: "Nutrition & Diet",            subs: ["Balanced Nutrition", "Keto & Low Carb", "Plant-Based Diet", "Intermittent Fasting"] },
      { name: "Sleep & Recovery",            subs: ["Sleep Science", "Sleep Disorders", "Recovery Protocols", "Napping & Rest"] },
      { name: "Preventive Health",           subs: ["Screenings & Tests", "Gut Health", "Immune System", "Preventive Medicine"] },
      { name: "Chronic Conditions",          subs: ["Diabetes Management", "Heart Disease", "Autoimmune Conditions", "Chronic Pain"] },
      { name: "Longevity",                   subs: ["Anti-Aging Science", "Blue Zones", "Biohacking", "Fasting & Longevity"] },
      { name: "Alternative Medicine",        subs: ["Herbal Medicine", "Acupuncture", "Ayurveda", "Naturopathy"] },
    ],
  },
  {
    category: "Mental Health",
    subs: [
      { name: "Anxiety & Stress",            subs: ["Social Anxiety", "Generalized Anxiety", "Stress Management", "Panic Attacks"] },
      { name: "Depression & Mood",           subs: ["Clinical Depression", "Seasonal Affective Disorder", "Burnout", "Emotional Regulation"] },
      { name: "Therapy & Treatment",         subs: ["CBT & DBT", "Therapy Types", "Medication & Psychiatry", "Online Therapy"] },
      { name: "Mindfulness & Self-Care",     subs: ["Meditation", "Journaling", "Breathwork", "Self-Compassion"] },
      { name: "Trauma & Recovery",           subs: ["PTSD", "Complex Trauma", "Healing Journeys", "Support Systems"] },
      { name: "ADHD & Neurodiversity",       subs: ["ADHD Management", "Autism Spectrum", "Dyslexia", "Executive Function"] },
    ],
  },
  {
    category: "Fitness & Exercise",
    subs: [
      { name: "Strength Training",           subs: ["Powerlifting", "Bodybuilding", "Calisthenics", "Olympic Weightlifting"] },
      { name: "Cardio & Endurance",          subs: ["Running", "Cycling", "Swimming", "HIIT Training"] },
      { name: "Flexibility & Recovery",      subs: ["Yoga", "Stretching Routines", "Foam Rolling", "Mobility Work"] },
      { name: "Home Workouts",               subs: ["No-Equipment Training", "Resistance Bands", "Jump Rope", "Apartment Workouts"] },
      { name: "Sports Performance",          subs: ["Athlete Training", "Sports Science", "Speed & Agility", "Mental Performance"] },
      { name: "Fitness Nutrition",           subs: ["Pre-Workout Nutrition", "Protein & Macros", "Supplements Guide", "Cutting & Bulking"] },
    ],
  },
  {
    category: "Self-Improvement & Motivation",
    subs: [
      { name: "Habits & Routines",           subs: ["Morning Routines", "Evening Wind Down", "Habit Stacking", "Breaking Bad Habits"] },
      { name: "Productivity",                subs: ["Time Management", "Deep Work", "Getting Things Done", "Tools & Systems"] },
      { name: "Mindset & Attitude",          subs: ["Growth Mindset", "Stoicism in Practice", "Optimism", "Resilience Building"] },
      { name: "Goal Setting",                subs: ["OKRs & Frameworks", "Vision Boards", "Accountability Systems", "Long-Term Planning"] },
      { name: "Life Lessons",                subs: ["Regret Minimization", "Lessons from Failure", "Finding Purpose", "Life Advice"] },
    ],
  },
  {
    category: "Parenting & Family",
    subs: [
      { name: "Baby & Toddler",              subs: ["Sleep Training", "Feeding & Nutrition", "Developmental Milestones", "Baby Products"] },
      { name: "Child Development",           subs: ["Cognitive Development", "Social Skills in Children", "Screen Time", "Learning Through Play"] },
      { name: "Teenagers",                   subs: ["Teen Mental Health", "Parenting Teenagers", "Social Media & Teens", "College Prep"] },
      { name: "Family Dynamics",             subs: ["Sibling Relationships", "Blended Families", "Extended Family", "Family Communication"] },
      { name: "Parenting Styles",            subs: ["Authoritative Parenting", "Attachment Parenting", "Gentle Parenting", "Positive Discipline"] },
    ],
  },
  {
    category: "Relationships & Dating",
    subs: [
      { name: "Dating & Romance",            subs: ["First Dates", "Dating Apps", "Attraction & Flirting", "Modern Dating Culture"] },
      { name: "Relationships & Marriage",    subs: ["Healthy Communication", "Conflict Resolution", "Marriage Tips", "Long-Term Partnerships"] },
      { name: "Breakups & Healing",          subs: ["Moving On", "Toxic Relationships", "Co-Parenting After Split", "Rediscovering Yourself"] },
      { name: "Love & Attachment",           subs: ["Attachment Styles", "Love Languages", "Emotional Intimacy", "Physical Affection"] },
      { name: "Social Skills",               subs: ["Making New Friends", "Networking", "Conversation Skills", "Being More Likeable"] },
    ],
  },
  {
    category: "Business & Finance",
    subs: [
      { name: "Entrepreneurship",            subs: ["Starting a Business", "Business Models", "Scaling a Company", "Founder Stories"] },
      { name: "Personal Finance",            subs: ["Budgeting", "Emergency Funds", "Debt Payoff", "Financial Independence"] },
      { name: "Investing",                   subs: ["Stock Market", "Index Funds & ETFs", "Real Estate Investing", "Options Trading"] },
      { name: "Marketing & Sales",           subs: ["Digital Marketing", "Content Marketing", "Sales Strategies", "Brand Building"] },
      { name: "Management & Leadership",     subs: ["Team Building", "Leadership Styles", "Hiring & Culture", "Remote Work"] },
      { name: "Economics",                   subs: ["Macroeconomics", "Microeconomics", "Global Economy", "Economic Policy"] },
    ],
  },
  {
    category: "Cryptocurrency & Web3",
    subs: [
      { name: "Bitcoin",                     subs: ["Bitcoin Basics", "Bitcoin Mining", "HODLing Strategy", "Lightning Network"] },
      { name: "Ethereum & Altcoins",         subs: ["Ethereum Updates", "Altcoin Analysis", "Layer 2 Solutions", "Stablecoins"] },
      { name: "DeFi",                        subs: ["Yield Farming", "Liquidity Pools", "DEX Platforms", "Lending Protocols"] },
      { name: "NFTs & Digital Ownership",    subs: ["NFT Projects", "NFT Art", "Gaming NFTs", "Digital Collectibles"] },
      { name: "Web3 Development",            subs: ["Smart Contracts", "Solidity", "dApp Building", "Blockchain Architecture"] },
      { name: "Crypto Trading",              subs: ["Technical Analysis", "Trading Strategies", "Risk Management", "Bull & Bear Markets"] },
    ],
  },
  {
    category: "Real Estate & Housing",
    subs: [
      { name: "Home Buying",                 subs: ["Mortgage Basics", "First-Time Buyers", "House Hunting", "Closing Process"] },
      { name: "Real Estate Investing",       subs: ["Rental Properties", "House Flipping", "REITs", "Airbnb Strategy"] },
      { name: "Rental Market",               subs: ["Renter Rights", "Finding Apartments", "Landlord Guide", "Short-Term Rentals"] },
      { name: "Home Improvement",            subs: ["Renovations", "DIY Home Projects", "Curb Appeal", "Kitchen & Bath Upgrades"] },
      { name: "Market Analysis",             subs: ["Housing Market Trends", "Affordability Crisis", "Interest Rate Impact", "Real Estate Tech"] },
    ],
  },
  {
    category: "Law & Crime",
    subs: [
      { name: "Criminal Law",                subs: ["Famous Trials", "Criminal Defense", "Sentencing & Justice", "Wrongful Conviction"] },
      { name: "True Crime Stories",          subs: ["Serial Killers", "Cold Cases", "Heists & Fraud", "Missing Persons"] },
      { name: "Civil Law & Rights",          subs: ["Constitutional Law", "Employment Law", "Family Law", "Immigration Law"] },
      { name: "Criminal Justice Reform",     subs: ["Police Accountability", "Prison Reform", "Bail & Sentencing", "Rehabilitation"] },
      { name: "Forensics & Investigation",   subs: ["DNA Evidence", "Digital Forensics", "Crime Scene Analysis", "Criminal Profiling"] },
    ],
  },

  // ── Entertainment & Media ────────────────────────────────────────────────
  {
    category: "Entertainment",
    subs: [
      { name: "Streaming & TV",              subs: ["Netflix Originals", "HBO & Premium Cable", "Disney+", "Binge-Worthy Shows"] },
      { name: "Movies & Cinema",             subs: ["Blockbusters", "Indie Films", "Film Festivals", "Box Office Hits"] },
      { name: "Music Entertainment",         subs: ["Concert Reviews", "Music Videos", "Artist Profiles", "Music Awards"] },
      { name: "Gaming Entertainment",        subs: ["Game Reviews", "Gaming News", "Let's Plays", "Gaming Culture"] },
      { name: "Internet & Viral Culture",    subs: ["Viral Content", "YouTube Trends", "TikTok Culture", "Meme Analysis"] },
    ],
  },
  {
    category: "Film & Animation",
    subs: [
      { name: "Movie Reviews",               subs: ["Action Films", "Drama & Thriller", "Horror Reviews", "Sci-Fi Films"] },
      { name: "Film Analysis",               subs: ["Director Studies", "Cinematography", "Screenwriting Analysis", "Film Theory"] },
      { name: "Animation",                   subs: ["Pixar & Disney", "Studio Ghibli", "Adult Animation", "2D vs 3D"] },
      { name: "Filmmaking",                  subs: ["Directing", "Cinematography Techniques", "Production Design", "Film Editing"] },
      { name: "Documentaries",               subs: ["Nature Docs", "True Crime Docs", "Political Docs", "Sports Documentaries"] },
    ],
  },
  {
    category: "Anime & Manga",
    subs: [
      { name: "Shonen Anime",                subs: ["One Piece", "Demon Slayer", "Jujutsu Kaisen", "Dragon Ball"] },
      { name: "Shojo & Romance",             subs: ["Romance Anime", "Slice of Life", "Magical Girl", "Josei"] },
      { name: "Seinen & Mature Anime",       subs: ["Attack on Titan", "Vinland Saga", "Berserk", "Psycho-Pass"] },
      { name: "Manga Reading",               subs: ["Manga Reviews", "Manga vs Anime", "Reading Order", "Hidden Manga Gems"] },
      { name: "Anime Culture",               subs: ["Conventions & Events", "Figure Collection", "Fan Theories", "Voice Actors"] },
    ],
  },
  {
    category: "Music",
    subs: [
      { name: "Hip-Hop & Rap",               subs: ["Trap & Drill", "Underground Rap", "Old School Hip-Hop", "Rap Culture & Beef"] },
      { name: "Pop & Dance",                 subs: ["K-Pop", "Latin Pop", "Indie Pop", "Dance Music"] },
      { name: "Rock & Metal",                subs: ["Classic Rock", "Heavy Metal", "Alternative Rock", "Punk & Post-Punk"] },
      { name: "R&B & Soul",                  subs: ["Neo Soul", "Contemporary R&B", "Funk", "Gospel"] },
      { name: "Electronic & EDM",            subs: ["House", "Techno", "Drum & Bass", "Synthwave & Lo-Fi"] },
      { name: "Music Production",            subs: ["Beat Making", "Mixing & Mastering", "DAWs & Software", "Music Business"] },
    ],
  },
  {
    category: "Sports",
    subs: [
      { name: "Football & Soccer",           subs: ["Premier League", "Champions League", "World Cup", "American Football NFL"] },
      { name: "Basketball",                  subs: ["NBA", "College Basketball", "EuroLeague", "Basketball Skills"] },
      { name: "Baseball & Cricket",          subs: ["MLB", "World Series", "Cricket Tests", "International Cricket"] },
      { name: "Olympic Sports",              subs: ["Track & Field", "Swimming", "Gymnastics", "Winter Olympics"] },
      { name: "Extreme Sports",              subs: ["Skateboarding", "BMX", "Surfing", "Snowboarding"] },
      { name: "Sports Analysis",             subs: ["Tactics & Strategy", "Sports Science", "Statistics & Analytics", "Coaching"] },
    ],
  },
  {
    category: "Martial Arts & Combat Sports",
    subs: [
      { name: "MMA & UFC",                   subs: ["UFC Events", "Fighter Profiles", "Fight Analysis", "MMA Training"] },
      { name: "Boxing",                      subs: ["Professional Boxing", "Boxing History", "Boxing Technique", "Famous Fights"] },
      { name: "Brazilian Jiu-Jitsu",         subs: ["BJJ Techniques", "Competition BJJ", "No-Gi Grappling", "Belt Progression"] },
      { name: "Traditional Martial Arts",    subs: ["Karate", "Muay Thai", "Judo", "Kung Fu"] },
      { name: "Wrestling",                   subs: ["Folkstyle Wrestling", "Greco-Roman", "Freestyle Wrestling", "Wrestling for MMA"] },
    ],
  },
  {
    category: "Gaming",
    subs: [
      { name: "Action & Shooters",           subs: ["Battle Royale", "FPS", "Third-Person Action", "Tactical Shooters"] },
      { name: "RPGs",                        subs: ["JRPGs", "Western RPGs", "Soulslike", "Action RPGs"] },
      { name: "Strategy & Simulation",       subs: ["RTS", "4X Strategy", "City Builders", "Life Simulators"] },
      { name: "Esports & Competitive",       subs: ["League of Legends", "CS2 & Valorant", "Dota 2", "Fighting Games"] },
      { name: "Game Development",            subs: ["Unity & Godot", "Unreal Engine", "Indie Game Dev", "Game Design Theory"] },
      { name: "Retro & Indie Gaming",        subs: ["Retro Games", "Emulation", "Indie Gems", "Speedrunning"] },
    ],
  },
  {
    category: "Tabletop & Board Games",
    subs: [
      { name: "Board Games",                 subs: ["Strategy Board Games", "Party Games", "Cooperative Games", "Worker Placement"] },
      { name: "Card Games",                  subs: ["Trading Card Games", "Deck Builders", "Poker & Trick-Taking", "Magic: The Gathering"] },
      { name: "Tabletop RPGs",               subs: ["Dungeons & Dragons", "Pathfinder", "World of Darkness", "Indie TTRPGs"] },
      { name: "Miniature Games",             subs: ["Warhammer", "Painting Miniatures", "Skirmish Games", "Historical Miniatures"] },
      { name: "Board Game Reviews",          subs: ["New Board Game Releases", "Gateway Games", "Heavy Euro Games", "Abstract Strategy"] },
    ],
  },
  {
    category: "Celebrity & Pop Culture",
    subs: [
      { name: "Celebrity News",              subs: ["Hollywood Stars", "Music Celebrities", "Sports Stars", "Reality TV Stars"] },
      { name: "Pop Culture Analysis",        subs: ["Cultural Moments", "Nostalgia Trips", "Trend Analysis", "Media Criticism"] },
      { name: "Awards & Events",             subs: ["Oscars & Emmys", "Grammys", "Met Gala", "Premiere Nights"] },
      { name: "Fan Culture",                 subs: ["Fandoms", "Fan Fiction", "Shipping & Theories", "Fan Conventions"] },
      { name: "Social Media Stars",          subs: ["YouTubers", "TikTok Stars", "Instagram Influencers", "Twitch Streamers"] },
    ],
  },
  {
    category: "Comedy",
    subs: [
      { name: "Stand-Up Comedy",             subs: ["Netflix Specials", "Up-and-Coming Comedians", "Classic Sets", "Comedy Styles"] },
      { name: "Sketch & Improv",             subs: ["SNL & Late Night", "Sketch Shows", "Improv Groups", "Character Comedy"] },
      { name: "Online Comedy",               subs: ["YouTube Comedy", "TikTok Funny", "Twitter Humor", "Meme Culture"] },
      { name: "Satire & Parody",             subs: ["Political Satire", "Parody Films", "Mockumentaries", "Dark Comedy"] },
      { name: "Roasts & Battles",            subs: ["Celebrity Roasts", "Rap Battles", "Comedy Beef", "Diss Tracks"] },
    ],
  },

  // ── Lifestyle ─────────────────────────────────────────────────────────────
  {
    category: "Food & Cooking",
    subs: [
      { name: "Recipes & Cooking",           subs: ["Quick Weeknight Meals", "Meal Prep", "One-Pot Dishes", "Comfort Food Classics"] },
      { name: "International Cuisine",       subs: ["Japanese Food", "Italian Cooking", "Mexican Cuisine", "Korean Food"] },
      { name: "Baking & Pastry",             subs: ["Bread Baking", "Cakes & Cookies", "Sourdough", "French Pastry"] },
      { name: "Restaurant Reviews",          subs: ["Street Food", "Fine Dining", "Hidden Gem Restaurants", "Fast Food Hacks"] },
      { name: "Food Science & Culture",      subs: ["Food Science", "Food History", "Fermentation", "Flavor Pairing"] },
    ],
  },
  {
    category: "Travel",
    subs: [
      { name: "Destinations",                subs: ["Europe Travel", "Asia Travel", "Americas", "Africa & Middle East"] },
      { name: "Travel Tips",                 subs: ["Budget Travel", "Packing Tips", "Visa & Planning", "Travel Hacks"] },
      { name: "Travel Vlogs",                subs: ["City Guides", "Road Trips", "Backpacking", "Solo Travel"] },
      { name: "Luxury Travel",               subs: ["Five-Star Hotels", "Private Jet Life", "Exclusive Experiences", "Travel in Style"] },
      { name: "Adventure Travel",            subs: ["Hiking & Trekking", "Extreme Destinations", "Off the Beaten Path", "Expedition Travel"] },
    ],
  },
  {
    category: "Fashion & Beauty",
    subs: [
      { name: "Women's Fashion",             subs: ["Seasonal Styles", "Outfit Ideas", "Wardrobe Essentials", "Fashion Trends 2026"] },
      { name: "Men's Fashion",               subs: ["Streetwear", "Smart Casual", "Luxury Menswear", "Men's Grooming"] },
      { name: "Beauty & Makeup",             subs: ["Skincare Routines", "Makeup Tutorials", "Product Reviews", "Natural Beauty"] },
      { name: "Sustainable Fashion",         subs: ["Thrift & Vintage", "Ethical Brands", "Capsule Wardrobe", "Fashion Waste"] },
      { name: "Luxury Brands",               subs: ["Designer Reviews", "Luxury Hauls", "Brand History", "Investment Pieces"] },
    ],
  },
  {
    category: "Art & Creativity",
    subs: [
      { name: "Visual Arts",                 subs: ["Oil Painting", "Watercolor", "Sketching & Drawing", "Mixed Media"] },
      { name: "Digital Art",                 subs: ["Illustration", "Concept Art", "Pixel Art", "AI-Assisted Art"] },
      { name: "Street Art & Graffiti",       subs: ["Murals", "Tagging Culture", "Street Art Documentaries", "Urban Art"] },
      { name: "Art History & Criticism",     subs: ["Art Movements", "Famous Artists", "Museum Walkthroughs", "Art Criticism"] },
      { name: "Creative Process",            subs: ["Artist Studios", "Creative Blocks", "Finding Inspiration", "Art Business"] },
    ],
  },
  {
    category: "Photography & Film Production",
    subs: [
      { name: "Photography Techniques",      subs: ["Portrait Photography", "Landscape Photography", "Street Photography", "Product Photography"] },
      { name: "Camera Gear",                 subs: ["Camera Reviews", "Lens Guide", "Lighting Equipment", "Budget Gear"] },
      { name: "Video Production",            subs: ["Cinematography", "Lighting for Video", "B-Roll Techniques", "Camera Movement"] },
      { name: "Editing & Post-Production",   subs: ["Lightroom & Capture One", "Premiere Pro & DaVinci", "Color Grading", "Sound Design"] },
      { name: "Photography Business",        subs: ["Freelance Photography", "Selling Prints", "Social Media Growth", "Client Work"] },
    ],
  },
  {
    category: "DIY & Hobbies",
    subs: [
      { name: "Home DIY",                    subs: ["Home Repairs", "Furniture Building", "Plumbing & Electrical", "Painting & Decorating"] },
      { name: "Crafts & Making",             subs: ["Knitting & Crochet", "Jewelry Making", "Candle Making", "Pottery & Ceramics"] },
      { name: "Electronics & Tech Hobbies",  subs: ["Arduino Projects", "Raspberry Pi", "Ham Radio", "PCB Design"] },
      { name: "3D Printing",                 subs: ["FDM Printing", "Resin Printing", "CAD Design", "3D Printing Showcase"] },
      { name: "Collecting & Model Making",   subs: ["Scale Models", "Vintage Collecting", "Miniature Painting", "Lego Building"] },
    ],
  },
  {
    category: "Howto & Style",
    subs: [
      { name: "Life Hacks",                  subs: ["Kitchen Hacks", "Cleaning Hacks", "Organization Hacks", "Tech Life Hacks"] },
      { name: "Personal Style Guide",        subs: ["Style Tips", "Wardrobe Building", "Dressing for Body Type", "Signature Style"] },
      { name: "Home Organization",           subs: ["Decluttering", "Storage Solutions", "Minimalism", "Marie Kondo Method"] },
      { name: "DIY Tutorials",               subs: ["Step-by-Step Guides", "How Things Work", "Beginner Projects", "Quick Fixes"] },
      { name: "Practical Skills",            subs: ["Cooking Basics", "Car Maintenance", "First Aid Skills", "Home Repair Skills"] },
    ],
  },
  {
    category: "Architecture & Interior Design",
    subs: [
      { name: "Home Design",                 subs: ["Living Room Design", "Kitchen Design", "Bedroom Styling", "Bathroom Renovation"] },
      { name: "Architectural Styles",        subs: ["Modern Architecture", "Minimalist Design", "Industrial Style", "Scandinavian Design"] },
      { name: "Sustainable Architecture",    subs: ["Passive Houses", "Green Buildings", "Tiny Houses", "Eco-Architecture"] },
      { name: "Interior Styling",            subs: ["Color Theory", "Furniture Selection", "Lighting Design", "Art & Decor"] },
      { name: "Space Planning",              subs: ["Small Space Living", "Open Floor Plans", "Commercial Spaces", "Urban Design"] },
    ],
  },
  {
    category: "Outdoors & Adventure",
    subs: [
      { name: "Hiking & Trekking",           subs: ["Trail Reviews", "Backpacking Gear", "Mountain Hiking", "National Parks"] },
      { name: "Camping",                     subs: ["Car Camping", "Wild Camping", "Glamping", "Camping Gear Reviews"] },
      { name: "Water Sports",                subs: ["Surfing", "Kayaking & Paddleboarding", "Scuba Diving", "Sailing"] },
      { name: "Climbing & Bouldering",       subs: ["Rock Climbing", "Indoor Climbing", "Bouldering", "Alpine Climbing"] },
      { name: "Winter Adventures",           subs: ["Skiing & Snowboarding", "Ice Climbing", "Winter Camping", "Dog Sledding"] },
    ],
  },
  {
    category: "Survival & Preparedness",
    subs: [
      { name: "Wilderness Survival",         subs: ["Fire Starting", "Shelter Building", "Water Sourcing", "Foraging"] },
      { name: "Emergency Preparedness",      subs: ["Bug Out Bags", "Food Storage", "Emergency Planning", "Natural Disaster Prep"] },
      { name: "Bushcraft Skills",            subs: ["Knife Skills", "Trapping & Hunting", "Navigation", "Plant Identification"] },
      { name: "Self-Sufficiency",            subs: ["Homesteading", "Growing Your Own Food", "Off-Grid Living", "Solar Power"] },
      { name: "Urban Prepping",              subs: ["City Survival", "Power Outage Prep", "Community Resilience", "Urban Security"] },
    ],
  },
  {
    category: "Automotive",
    subs: [
      { name: "Car Reviews",                 subs: ["Sedans & Hatchbacks", "SUVs & Trucks", "Sports Cars", "Budget Cars"] },
      { name: "Electric Vehicles",           subs: ["Tesla", "EV Comparisons", "EV Range & Charging", "Future of EVs"] },
      { name: "Car Modifications",           subs: ["Performance Mods", "Aesthetic Mods", "JDM Culture", "Detailing"] },
      { name: "Motorcycles",                 subs: ["Sport Bikes", "Cruisers", "Adventure Bikes", "Motovlogging"] },
      { name: "Auto Maintenance",            subs: ["Oil Changes", "Tires & Brakes", "DIY Auto Repair", "Car Care Tips"] },
    ],
  },
  {
    category: "Animals & Nature",
    subs: [
      { name: "Pets",                        subs: ["Dog Training", "Cat Care", "Exotic Pets", "Pet Health & Nutrition"] },
      { name: "Wildlife",                    subs: ["African Wildlife", "Rainforest Animals", "Arctic Wildlife", "Animal Behavior"] },
      { name: "Ocean & Marine Life",         subs: ["Ocean Exploration", "Sharks & Rays", "Coral Reefs", "Marine Conservation"] },
      { name: "Birds & Insects",             subs: ["Bird Watching", "Insect World", "Bird Migration", "Backyard Birds"] },
      { name: "Nature Documentaries",        subs: ["BBC Nature", "Deep Sea Docs", "Animal Planet", "Nature Photography"] },
    ],
  },
  {
    category: "People & Blogs",
    subs: [
      { name: "Personal Vlogs",              subs: ["Day in the Life", "Weekly Vlogs", "Life Updates", "Creator Journeys"] },
      { name: "Storytelling",                subs: ["Personal Stories", "Life Lessons Shared", "Confession Videos", "Storytelling Style"] },
      { name: "Lifestyle Blogs",             subs: ["Morning Routines", "Productivity Vlogs", "Minimalist Life", "Intentional Living"] },
      { name: "Opinion & Commentary",        subs: ["Hot Takes", "Personal Essays", "Cultural Commentary", "Current Events Opinion"] },
      { name: "Community & Connection",      subs: ["Community Building", "Q&A Sessions", "Subscriber Stories", "Challenges"] },
    ],
  },
  {
    category: "Cultures & Traditions",
    subs: [
      { name: "World Cultures",              subs: ["East Asian Cultures", "South Asian Cultures", "African Cultures", "Latin American Cultures"] },
      { name: "Traditions & Customs",        subs: ["Coming of Age Ceremonies", "Wedding Traditions", "Funeral Rites", "Religious Festivals"] },
      { name: "Food & Cultural Identity",    subs: ["Cultural Cuisine", "Food Diplomacy", "Immigrant Food Stories", "Street Food Culture"] },
      { name: "Indigenous Cultures",         subs: ["Native American Cultures", "Aboriginal Australia", "Amazonian Peoples", "Arctic Peoples"] },
      { name: "Cultural Exchange",           subs: ["Expat Stories", "Language & Culture", "Cross-Cultural Relationships", "Cultural Appropriation Debate"] },
    ],
  },
  {
    category: "Other",
    subs: [
      { name: "Miscellaneous",               subs: ["Random Discoveries", "Weird & Wonderful", "Niche Content", "Underground Finds"] },
      { name: "Experimental Content",        subs: ["Art House", "Avant-Garde", "Experimental Film", "Abstract Art"] },
      { name: "Cross-Genre",                 subs: ["Genre Blending", "Hybrid Content", "Mashups", "Unexpected Combinations"] },
      { name: "Community Picks",             subs: ["Community Favorites", "Hidden Gems", "Trending Worldwide", "Editor Picks"] },
    ],
  },
];

// ---------------------------------------------------------------------------
// Title templates — YouTube-style. {node} is replaced by the taxonomy node name.
// ---------------------------------------------------------------------------
const TITLE_TEMPLATES = [
  "The Truth About {node} Nobody Talks About",
  "Why {node} Is Completely Misunderstood",
  "Everything You Need to Know About {node}",
  "The Complete {node} Guide for 2026",
  "{node} Explained — The Definitive Breakdown",
  "What Actually Happens With {node}",
  "How to Master {node} in 30 Days",
  "{node} for Complete Beginners",
  "I Tried {node} Every Day for a Month",
  "Getting Started with {node} — No BS Guide",
  "{node} from Zero to Hero",
  "Ranking Every {node} Worst to Best",
  "The Best and Worst of {node} in 2026",
  "Hot Take: {node} Is Overrated",
  "Why I Switched to {node} and Never Looked Back",
  "My Journey into {node}",
  "I Spent 6 Months Deep in {node}",
  "How {node} Changed My Life Completely",
  "The Untold Story of {node}",
  "Deep Dive: {node}",
  "{node} — A Proper Analysis",
  "Breaking Down {node} Step by Step",
  "The Science Behind {node}",
  "Inside the World of {node}",
  "Is {node} Actually Worth It?",
  "The {node} Debate: Final Answer",
  "We Need to Talk About {node}",
  "{node} in 2026 — Better or Worse?",
  "I Tried {node} So You Don't Have To",
  "Reacting to the Worst {node} Takes",
  "Testing the Most Viral {node} Claims",
  "What Nobody Tells You About {node}",
  "10 Things About {node} That Will Blow Your Mind",
  "The 5 Biggest {node} Mistakes Everyone Makes",
  "{node}: The Good, the Bad, and the Ugly",
  "The Future of {node} Looks Wild",
  "{node} Is Changing Everything in 2026",
  "The {node} Trend You Need to Understand",
  "My Honest Thoughts on {node}",
  "Why I'm Obsessed with {node} Right Now",
  "Unpacking {node} — Live Breakdown",
  "I Asked 100 People About {node}",
  "{node} vs Everything Else — Which Wins?",
  "The Problem with {node} Nobody Admits",
  "How I Got Into {node} — Full Story",
  "{node} for Beginners: Start Here",
  "The Beginner's Roadmap to {node}",
  "How {node} Actually Works",
  "{node} Tips That Actually Work",
  "Stop Doing {node} Wrong",
  "The Best {node} Resources in 2026",
  "I Documented My {node} Journey for 90 Days",
  "What {node} Teaches You About Life",
  "The Biggest Myths About {node} Debunked",
  "Why Everyone Is Talking About {node}",
  "The Real Cost of {node}",
  "My First Month with {node} — Honest Review",
  "{node} — Is It a Scam?",
  "The {node} Iceberg: Surface vs Reality",
  "How Experts Think About {node}",
  "Beginners vs Pros: How {node} Changes You",
];

// ---------------------------------------------------------------------------
// Descriptions
// ---------------------------------------------------------------------------
const DESCRIPTIONS = [
  "A deep dive covering all the essentials and some surprising insights.",
  "Everything you need to know, packed into one place.",
  "Real-world examples and practical advice from the community.",
  "Community curated videos that cut through the noise.",
  "From complete beginner to confident practitioner.",
  "The top creators share what's actually working right now.",
  "Honest reviews, tutorials, and expert takes — no fluff.",
  "Watch the best content on this topic in one organized feed.",
  "Handpicked videos updated weekly by passionate enthusiasts.",
  "The most-watched content in this niche, all in one spot.",
  "Trending discussions and breakdowns from leading voices.",
  "Explore multiple perspectives on this fascinating subject.",
  "Skip the algorithm — discover what's actually worth watching.",
  "Curated highlights from the best creators worldwide.",
  "The community's favourite videos, ranked by engagement.",
  "Fresh takes, hot debates, and essential explainers.",
  "Your shortcut to the best thinking on this topic.",
  "Deep dives, quick explainers, and everything in between.",
  "Voted best resource in this space — find out why.",
  "The go-to spot for anyone serious about this subject.",
];

// ---------------------------------------------------------------------------
// Build taxonomy tree
// ---------------------------------------------------------------------------
let nodeId = 1;
const taxonomyNodes = [];

for (const entry of TAXONOMY) {
  const topId = nodeId++;
  const topSlug = slugify(entry.category);
  taxonomyNodes.push({
    id: topId,
    slug: topSlug,
    name: entry.category,
    parentId: null,
    path: topSlug,
    depth: 0,
    isActive: true,
    createdAt: Date.now() - randInt(0, 86_400_000 * 365),
  });

  for (const sub of entry.subs) {
    const subId = nodeId++;
    const subSlug = slugify(sub.name);
    const subPath = `${topSlug}/${subSlug}`;
    taxonomyNodes.push({
      id: subId,
      slug: subSlug,
      name: sub.name,
      parentId: topId,
      path: subPath,
      depth: 1,
      isActive: true,
      createdAt: Date.now() - randInt(0, 86_400_000 * 300),
    });

    for (const leaf of sub.subs) {
      const leafId = nodeId++;
      const leafSlug = slugify(leaf);
      taxonomyNodes.push({
        id: leafId,
        slug: leafSlug,
        name: leaf,
        parentId: subId,
        path: `${subPath}/${leafSlug}`,
        depth: 2,
        isActive: true,
        createdAt: Date.now() - randInt(0, 86_400_000 * 200),
      });
    }
  }
}

console.log(`✓ Built taxonomy: ${taxonomyNodes.length} nodes (${TAXONOMY.length} top-level categories)`);

// ---------------------------------------------------------------------------
// Generate TOPICS_PER_CATEGORY topics for each category
// ---------------------------------------------------------------------------
const topics = [];
const seenSlugs = new Set();
let topicId = 1;

for (const entry of TAXONOMY) {
  const rootNode = taxonomyNodes.find(n => n.depth === 0 && n.name === entry.category);
  const rootSlug = rootNode.slug;

  const leafNodes = taxonomyNodes.filter(n => n.depth === 2 && n.path.startsWith(rootSlug + "/"));
  const midNodes  = taxonomyNodes.filter(n => n.depth === 1 && n.path.startsWith(rootSlug + "/"));

  for (let i = 0; i < TOPICS_PER_CATEGORY; i++) {
    // Every 5th topic goes to a mid-level node; the rest go to leaf nodes
    // Cycle through the node array for even distribution
    const isLeaf = (i % 5) !== 0;
    const pool = isLeaf ? leafNodes : midNodes;
    const node = pool[i % pool.length];

    const template = TITLE_TEMPLATES[i % TITLE_TEMPLATES.length];
    let title = template.replace("{node}", node.name);
    if (title.length > 80) title = title.substring(0, 77) + "...";

    let slug = `${slugify(node.name)}-${topicId}`;
    while (seenSlugs.has(slug)) slug += "-x";
    seenSlugs.add(slug);

    const videoId = pickVideoId();
    const totalLikes = randInt(10, 500_000);
    const totalViews = totalLikes * randInt(5, 40);

    topics.push({
      id: topicId,
      slug,
      title,
      description: DESCRIPTIONS[i % DESCRIPTIONS.length],
      category: entry.category,
      creatorIdentity: `seed_user_${randInt(1, 500)}`,
      videoCount: randInt(5, 2000),
      totalLikes,
      totalDislikes: Math.floor(totalLikes * rng() * 0.15),
      totalViews,
      isActive: rng() > 0.03,
      createdAt: Date.now() - randInt(0, 86_400_000 * 365 * 2),
      taxonomyNodeId: node.id,
      taxonomyPath: node.path,
      taxonomyName: node.name,
      thumbnailVideoId: videoId,
      thumbnailUrl: thumbUrl(videoId),
    });

    topicId++;
  }

  process.stdout.write(`  ✓ ${entry.category} (${TOPICS_PER_CATEGORY} topics)\n`);
}

console.log(`\n✓ Generated ${topics.length} topics total`);

// ---------------------------------------------------------------------------
// Write output — compact JSON to keep file size manageable
// ---------------------------------------------------------------------------
const output = {
  meta: {
    generatedAt: new Date().toISOString(),
    topicCount: topics.length,
    taxonomyNodeCount: taxonomyNodes.length,
    categoriesCount: TAXONOMY.length,
    topicsPerCategory: TOPICS_PER_CATEGORY,
    seed: 42,
  },
  taxonomyNodes,
  topics,
};

writeFileSync(OUTPUT_PATH, JSON.stringify(output));

const mb = Math.round(JSON.stringify(output).length / 1024 / 1024 * 10) / 10;
console.log(`\n🎉 Written to src/lib/mock-topics.json`);
console.log(`   Taxonomy nodes  : ${taxonomyNodes.length}`);
console.log(`   Topics          : ${topics.length}`);
console.log(`   Categories      : ${TAXONOMY.length}`);
console.log(`   File size       : ~${mb} MB`);
console.log(`   YouTube IDs     : ${ALL_IDS.length} available, ${ytCursor} assigned`);
