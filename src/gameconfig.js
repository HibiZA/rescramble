// ═══════════════════════════════════════════════════════
// GAME BALANCE CONFIG
// All tunable gameplay values in one place.
// Tweak these to balance difficulty, ships, and damage.
// ═══════════════════════════════════════════════════════

// ── Player Base Stats ──
export const PLAYER = {
  baseSpeed: 4.5,           // pixels per tick
  bulletSpeed: 8,            // pixels per tick
  fireRate: 8,               // frames between shots (lower = faster)
  rocketFireRate: 24,        // frames between rocket shots (3x bullet rate)
  rocketDamage: 3,           // damage per rocket hit
  rocketAoeRadius: 60,       // explosion radius in pixels
  rocketAoeInnerDmg: 3,      // damage at center of explosion
  rocketAoeMidDmg: 2,        // damage at mid range
  rocketAoeOuterDmg: 1,      // damage at edge
  startLives: 3,
  hitboxW: 40,
  hitboxH: 48,
  moveZoneTop: 0.4,          // can move in bottom 60% of screen
  invincFrames: 120,         // invincibility frames after being hit
  speedBoostAmount: 2,       // extra speed when speed-boosted
  speedBoostDuration: 600,   // frames
  shieldMax: 5,              // max shield HP
  spreadMaxLevel: 3,          // max spread level (LV1=3, LV2=5, LV3=7 bullets)
  rapidMaxLevel: 2,           // max rapid level (LV1=half, LV2=third cooldown)
};

// ── Ship Configs ──
// Each ship overrides base stats. All keys are optional (defaults to base).
export const SHIP_CONFIGS = [
  {
    name: 'SCOUT',
    art: ['  ^  ', ' [#] ', '=| |='],
    ability: '-20% fuel burn',
    unlock: 'Always available',
    unlockCheck: () => true,
    fuelBurnMult: 0.8,           // burns 20% less fuel
    bombName: 'EMP BLAST',
    bombDesc: 'Destroy bullets + damage all',
  },
  {
    name: 'FALCON',
    art: ['  ^  ', ' /#\\ ', '==|=='],
    ability: '+50% speed, kill rush',
    unlock: 'Score 5000+',
    unlockCheck: (p) => p.highScore >= 5000,
    speedMult: 1.5,
    killSpeedFrames: 20,         // brief speed burst on kill
    bombName: 'SONIC DASH',
    bombDesc: 'Dash + damage on contact',
  },
  {
    name: 'FORTRESS',
    art: ['[===]', '|[#]|', '[===]'],
    ability: '+1 dmg, +2 shield, slow',
    unlock: 'Reach LV15',
    unlockCheck: (p) => p.maxDifficulty >= 15,
    speedMult: 0.7,
    startShield: 2,
    startLives: 4,
    damageBonus: 1,              // +1 damage per bullet
    bombName: 'WALL',
    bombDesc: 'Shield wall blocks bullets 5s',
  },
  {
    name: 'STRIKER',
    art: ['!!!', '[X]', '=V='],
    ability: 'Spread2+rapid, 2 lives',
    unlock: '500 total kills',
    unlockCheck: (p) => p.totalKills >= 500,
    startSpread: 2,
    startRapid: 1,
    startLives: 2,               // glass cannon
    bombName: 'MEGA BURST',
    bombDesc: '20 bullets all directions',
  },
  {
    name: 'PHANTOM',
    art: ['~^~', '(#)', '~v~'],
    ability: 'Kills pause fuel drain',
    unlock: 'Reach LV25',
    unlockCheck: (p) => p.maxDifficulty >= 25,
    speedMult: 1.1,
    fuelPauseOnKill: 30,         // frames of fuel drain immunity per kill
    bombName: 'VOID',
    bombDesc: 'Freeze enemies 3s + invisible',
  },
];

// ── Enemy Configs ──
export const ENEMIES = {
  small: {
    hp: 1,
    speed: 1.2,
    score: 10,
    fires: true,
    hitboxW: 30,
    hitboxH: 16,
    fireCooldownMin: 300,
    fireCooldownMax: 600,
  },
  medium: {
    hp: 3,
    speed: 0.8,
    score: 25,
    fires: true,
    hitboxW: 50,
    hitboxH: 32,
    fireCooldownMin: 90,
    fireCooldownMax: 170,
  },
  big: {
    hp: 6,
    speed: 0.5,
    score: 50,
    fires: true,
    hitboxW: 70,
    hitboxH: 48,
    fireCooldownMin: 60,
    fireCooldownMax: 140,
  },
  shielded: {
    hp: 4,
    speed: 0.6,
    score: 40,
    fires: true,
    hasShield: true,
    shieldHP: 2,
    hitboxW: 50,
    hitboxH: 32,
    fireCooldownMin: 80,
    fireCooldownMax: 150,
  },
  kamikaze: {
    hp: 1,
    speed: 0,
    score: 15,
    fires: false,
    isKamikaze: true,
    hitboxW: 30,
    hitboxH: 16,
    fireCooldownMin: 0,
    fireCooldownMax: 0,
  },
  spawner: {
    hp: 8,
    speed: 0.3,
    score: 75,
    fires: false,
    isSpawner: true,
    spawnRate: 180,
    hitboxW: 60,
    hitboxH: 48,
    fireCooldownMin: 0,
    fireCooldownMax: 0,
  },
  mine: {
    hp: 1,
    speed: 0,
    score: 5,
    fires: false,
    isStationary: true,
    explosionRadius: 55,
    hitboxW: 30,
    hitboxH: 16,
    fireCooldownMin: 0,
    fireCooldownMax: 0,
  },
  fuelRock: {
    hp: 3,
    speed: 0.6,
    score: 5,
    fires: false,
    isFuelRock: true,
    hitboxW: 40,
    hitboxH: 32,
    fireCooldownMin: 0,
    fireCooldownMax: 0,
  },
};

// ── Boss Config ──
export const BOSS = {
  baseHp: 50,                // HP at difficulty 10 (was 20)
  hpPerLevel: 10,            // extra HP per difficulty level (was 5)
  speed: 0.8,                // faster patrol (was 0.6)
  baseScore: 500,
  scorePerLevel: 30,
  targetY: 50,
  spreadCooldown: [50, 80],  // fires more often (was [80, 120])
  spreadCount: 7,            // more bullets per spread (was 5)
  spreadAngle: 1.0,          // tighter spread
  aimedCooldown: [30, 55],   // fires aimed more often (was [50, 80])
  aimedCount: 3,
  // Size thresholds
  mediumAt: 20,
  largeAt: 30,
};

// ── Bullet Damage ──
export const DAMAGE = {
  playerBullet: 1,            // normal shot
  rocketDirect: 3,            // rocket direct hit
  enemyBulletToPlayer: 1,     // (lives, not HP)
};

// ── Spawning ──
export const SPAWNING = {
  baseRate: 80,               // frames between spawns at start
  minRate: 6,                 // minimum frames between spawns (much faster at high levels)
  rateReduction: 4,           // frames reduced per difficulty level
  difficultyRampFrames: 600,  // frames per difficulty level (~10s)
  // Enemy HP scaling: enemies get tougher at higher levels
  hpScaleStart: 10,           // difficulty level where HP scaling begins
  hpScaleRate: 0.10,          // +10% HP per level above hpScaleStart
  // Enemy speed scaling
  speedScaleStart: 15,
  speedScaleRate: 0.05,       // +5% speed per level above speedScaleStart
  // Spawn count scaling: more enemies per wave at higher levels
  waveCountBase: 1,           // base extra enemies per spawn
  waveCountPerLevel: 0.2,     // extra enemies per difficulty level (fractional, floored)
  // Difficulty thresholds for enemy types
  mediumUnlocksAt: 3,
  bigUnlocksAt: 6,
  smallWaveUnlocksAt: 2,
  kamikazeUnlocksAt: 3,
  shieldedUnlocksAt: 4,
  mineUnlocksAt: 5,
  spawnerUnlocksAt: 8,
  // Boss
  bossEvery: 10,
  // Hazards
  hazardStartsAt: 3,
  hazardBaseRate: 600,
  hazardRateReduction: 30,
  hazardMinRate: 120,         // more frequent hazards at high levels
};

// ── Powerup ──
export const POWERUPS = {
  bombDropChance: 0.1,        // 10% chance a powerup is a bomb instead
};

// ── Enemy Bullet ──
export const ENEMY_BULLET = {
  speed: 2.5,
};

// ── Fuel ──
export const FUEL = {
  maxFuel: 1000,
  startFuel: 1000,
  burnRate: 0.5,              // base fuel consumed per tick (~33 seconds to empty)
  burnRateScaleStart: 8,      // difficulty level where burn rate starts increasing
  burnRateScale: 0.02,        // extra burn per tick per difficulty level above scaleStart
  fuelPerKill: 5,             // fuel restored per enemy kill
  fuelPickupAmount: 80,       // fuel from pickup item
  // Reserved: adaptive algorithm in physics.js controls fuel pickup chance
  fuelPickupChance: 0.08,     // 8% base chance in adaptive algorithm
  warningThreshold: 0.25,     // flash warning below 25%
};

// ── Hazard ──
export const HAZARD = {
  speedMin: 3,
  speedMax: 5,
  zigzagMin: 1,
  zigzagMax: 3,
  hitboxW: 60,
  hitboxH: 32,
};
