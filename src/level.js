import { createEnemy, createPowerUp, createBoss, createHazard } from './entities.js';
import { WORLD_W } from './constants.js';
import { SPAWNING } from './gameconfig.js';
import { sfxBossWarning, setMusicIntensity } from './audio.js';
import { createWorldObjects } from './worldobjects.js';

// ── Wave spawner ──
// Continuously spawns enemies in patterns. Difficulty ramps over time.

// Scale enemy HP and speed based on current difficulty
function scaleEnemy(e, difficulty) {
  const d = difficulty;
  // HP scaling
  if (d >= SPAWNING.hpScaleStart) {
    const hpMult = 1 + (d - SPAWNING.hpScaleStart) * SPAWNING.hpScaleRate;
    e.hp = Math.ceil(e.hp * hpMult);
    e.maxHp = e.hp;
  }
  // Speed scaling
  if (d >= SPAWNING.speedScaleStart) {
    const spdMult = 1 + (d - SPAWNING.speedScaleStart) * SPAWNING.speedScaleRate;
    e.speed *= spdMult;
  }
  return e;
}

// How many extra enemies to add per spawn based on difficulty
function bonusCount(difficulty) {
  return Math.floor(SPAWNING.waveCountBase + difficulty * SPAWNING.waveCountPerLevel);
}

// Find an X position that doesn't overlap existing enemies or recently placed ones
const MIN_SPACING = 40; // minimum pixels between enemy centers

function findClearX(world, minX, maxX, placed) {
  const allX = [];
  for (const e of world.enemies) {
    if (e.alive && e.y < 30) allX.push(e.x + e.w / 2); // only check enemies near top
  }
  for (const px of placed) allX.push(px);

  // Try up to 10 times to find a clear spot
  for (let attempt = 0; attempt < 10; attempt++) {
    const x = minX + Math.random() * (maxX - minX);
    let clear = true;
    for (const ex of allX) {
      if (Math.abs(x - ex) < MIN_SPACING) { clear = false; break; }
    }
    if (clear) return x;
  }
  // Fallback: just return a random position
  return minX + Math.random() * (maxX - minX);
}

export function createWorld() {
  return {
    enemies: [],
    bullets: [],
    powerups: [],
    hazards: [],
    hazardTimer: 0,
    fuelRockTimer: 0,
    spawnTimer: 0,
    gameTimer: 0,         // total frames elapsed
    difficulty: 1,        // ramps up over time
    waveNum: 0,           // current micro-wave
    enemiesKilled: 0,
    nextPowerup: 30,      // kill count for next power-up
    boss: null,           // current boss (null when no boss)
    lastBossLevel: 0,     // last difficulty level that spawned a boss
    bombEffect: null,
    screenFlash: 0,
    worldObjects: createWorldObjects(),
  };
}

export function spawnEnemies(world) {
  world.gameTimer++;

  // Ramp difficulty
  world.difficulty = 1 + Math.floor(world.gameTimer / SPAWNING.difficultyRampFrames);

  // Hazard spawning: starts at difficulty 3, gets more frequent
  if (world.difficulty >= SPAWNING.hazardStartsAt) {
    world.hazardTimer--;
    if (world.hazardTimer <= 0) {
      const rate = Math.max(SPAWNING.hazardMinRate, SPAWNING.hazardBaseRate - world.difficulty * SPAWNING.hazardRateReduction);
      world.hazardTimer = rate + Math.random() * rate * 0.5;
      const x = 30 + Math.random() * (WORLD_W - 60);
      world.hazards.push(createHazard(x, -40));
    }
  }

  // Boss spawn check
  const bossEvery = SPAWNING.bossEvery;
  const bossLevel = Math.floor(world.difficulty / bossEvery) * bossEvery;
  if (bossLevel >= bossEvery && bossLevel > world.lastBossLevel && !world.boss) {
    world.boss = createBoss(bossLevel);
    world.lastBossLevel = bossLevel;
    sfxBossWarning();
    setMusicIntensity(2);
    return; // Don't spawn regular enemies on boss spawn frame
  }

  // Fuel rocks: spawn periodically (more often at higher difficulty)
  world.fuelRockTimer--;
  if (world.fuelRockTimer <= 0) {
    world.fuelRockTimer = Math.max(300, 600 - world.difficulty * 15);
    const x = findClearX(world, 60, WORLD_W - 60, []);
    const e = createEnemy('fuelRock', x, -40);
    e.pattern = Math.random() > 0.5 ? 'straight' : 'zigzag';
    e.patternData = { amp: 30, freq: 0.015, phase: Math.random() * Math.PI * 2, originX: x };
    world.enemies.push(e);
  }

  // Don't spawn regular enemies while boss is alive
  if (world.boss && world.boss.alive) return;

  const spawnRate = Math.max(
    SPAWNING.minRate,
    SPAWNING.baseRate - world.difficulty * SPAWNING.rateReduction
  );

  world.spawnTimer--;
  if (world.spawnTimer > 0) return;
  world.spawnTimer = spawnRate + Math.random() * 20;

  // Decide what to spawn based on difficulty
  const roll = Math.random();
  const d = world.difficulty;

  if (d <= 1) {
    spawnSmalls(world, 1);
  } else if (d <= 2) {
    spawnSmalls(world);
  } else if (roll < 0.05 && d >= SPAWNING.spawnerUnlocksAt) {
    spawnSpawner(world);
  } else if (roll < 0.10 && d >= SPAWNING.mineUnlocksAt) {
    spawnMines(world);
  } else if (roll < 0.18 && d >= SPAWNING.shieldedUnlocksAt) {
    spawnShielded(world);
  } else if (roll < 0.28 && d >= SPAWNING.kamikazeUnlocksAt) {
    spawnKamikaze(world);
  } else if (roll < 0.36 && d >= SPAWNING.bigUnlocksAt) {
    spawnBig(world);
  } else if (roll < 0.52 && d >= SPAWNING.mediumUnlocksAt) {
    spawnMedium(world);
  } else if (roll < 0.68 && d >= SPAWNING.smallWaveUnlocksAt) {
    spawnSmallWave(world);
  } else if (roll < 0.78 && d >= 3) {
    // Side entry enemies
    spawnSideEntry(world);
  } else {
    spawnSmalls(world);
  }

  world.waveNum++;
}

function spawnSmalls(world, maxCount) {
  const d = world.difficulty;
  const count = maxCount || (1 + Math.floor(Math.random() * 3) + bonusCount(d));
  const placed = [];
  for (let i = 0; i < count; i++) {
    const x = findClearX(world, 40, WORLD_W - 40, placed);
    placed.push(x);
    const e = scaleEnemy(createEnemy('small', x, -20 - i * 50), d);
    e.pattern = Math.random() > 0.5 ? 'straight' : 'zigzag';
    e.patternData = { amp: 30 + Math.random() * 40, freq: 0.02 + Math.random() * 0.02, phase: Math.random() * Math.PI * 2 };
    world.enemies.push(e);
  }
}

function spawnSmallWave(world) {
  const d = world.difficulty;
  const count = 4 + Math.floor(Math.random() * 4) + bonusCount(d);
  const baseX = 100 + Math.random() * (WORLD_W - 200);
  for (let i = 0; i < count; i++) {
    const x = baseX + (i - count / 2) * 35;
    const e = scaleEnemy(createEnemy('small', x, -20 - i * 40), d);
    e.pattern = 'vformation';
    e.patternData = { baseX: x, idx: i };
    world.enemies.push(e);
  }
}

function spawnMedium(world) {
  const d = world.difficulty;
  const x = 60 + Math.random() * (WORLD_W - 120);
  const e = scaleEnemy(createEnemy('medium', x, -40), d);
  e.pattern = Math.random() > 0.5 ? 'zigzag' : 'straight';
  e.patternData = { amp: 50, freq: 0.015, phase: Math.random() * Math.PI * 2 };
  world.enemies.push(e);
}

function spawnBig(world) {
  const d = world.difficulty;
  const x = 100 + Math.random() * (WORLD_W - 200);
  const e = scaleEnemy(createEnemy('big', x, -60), d);
  e.pattern = 'zigzag';
  e.patternData = { amp: 80, freq: 0.01, phase: 0, originX: x };
  world.enemies.push(e);
}

function spawnShielded(world) {
  const d = world.difficulty;
  const x = 60 + Math.random() * (WORLD_W - 120);
  const e = scaleEnemy(createEnemy('shielded', x, -40), d);
  e.pattern = Math.random() > 0.5 ? 'zigzag' : 'straight';
  e.patternData = { amp: 40, freq: 0.018, phase: Math.random() * Math.PI * 2 };
  world.enemies.push(e);
}

function spawnKamikaze(world) {
  const d = world.difficulty;
  const count = 1 + Math.floor(Math.random() * 2) + Math.floor(bonusCount(d) / 2);
  const placed = [];
  for (let i = 0; i < count; i++) {
    const x = findClearX(world, 40, WORLD_W - 40, placed);
    placed.push(x);
    const e = scaleEnemy(createEnemy('kamikaze', x, -20 - i * 60), d);
    world.enemies.push(e);
  }
}

function spawnSpawner(world) {
  const d = world.difficulty;
  const x = 80 + Math.random() * (WORLD_W - 160);
  const e = scaleEnemy(createEnemy('spawner', x, -60), d);
  e.pattern = 'straight';
  world.enemies.push(e);
}

function spawnMines(world) {
  const d = world.difficulty;
  const count = 2 + Math.floor(Math.random() * 3) + Math.floor(bonusCount(d) / 2);
  const placed = [];
  for (let i = 0; i < count; i++) {
    const x = findClearX(world, 40, WORLD_W - 40, placed);
    placed.push(x);
    const e = createEnemy('mine', x, -20 - i * 70);
    world.enemies.push(e);
  }
}

function spawnSideEntry(world) {
  const d = world.difficulty;
  const fromLeft = Math.random() > 0.5;
  const count = 2 + Math.floor(Math.random() * 3) + bonusCount(d);
  const targetX = 80 + Math.random() * (WORLD_W - 160);
  for (let i = 0; i < count; i++) {
    const x = fromLeft ? -30 - i * 20 : WORLD_W + 30 + i * 20;
    const y = 20 + Math.random() * 60;
    const e = createEnemy('small', x, y);
    e.pattern = fromLeft ? 'leftEntry' : 'rightEntry';
    e.patternData = { targetX: targetX, entered: false };
    world.enemies.push(e);
  }
}
