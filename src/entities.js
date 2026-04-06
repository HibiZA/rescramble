import { SHIP_CONFIGS, ENEMIES as ENEMY_CFG, BOSS as BOSS_CFG, PLAYER, HAZARD, FUEL, POWERUPS } from './gameconfig.js';

// ── Ship ASCII art ──
export const SHIP2_ART = ['  ^  ', ' [*] ', '=| |='];

// ── Ship definitions (driven by gameconfig.js) ──
export const SHIPS = SHIP_CONFIGS.map(cfg => ({
  name: cfg.name,
  art: cfg.art,
  ability: cfg.ability,
  unlock: cfg.unlock,
  unlockCheck: cfg.unlockCheck,
  speedMult: cfg.speedMult || 1.0,
  startShield: cfg.startShield || 0,
  startSpread: cfg.startSpread || 0,
  startRocket: cfg.startRocket || false,
  startRapid: cfg.startRapid || 0,
  startLives: cfg.startLives || PLAYER.startLives,
  invincMult: cfg.invincMult || 1.0,
  bombName: cfg.bombName || 'BOMB',
  bombDesc: cfg.bombDesc || '',
}));

// ── Enemy art ──
export const ENEMY_SMALL_ART = ['\\v/', ' | '];
export const ENEMY_SMALL_ALT = ['\\v/', ' ! '];

export const ENEMY_MED_ART = ['={O}=', ' /!\\ '];
export const ENEMY_MED_ALT = ['={O}=', ' \\!/ '];

export const ENEMY_BIG_ART = ['([===])', ' \\!!!/ ', '  vvv  '];
export const ENEMY_BIG_ALT = ['([===])', ' /!!!\\ ', '  vvv  '];

// ── New enemy art ──
export const ENEMY_SHIELDED_ART = ['={=}=', '[||]'];
export const ENEMY_SHIELDED_ALT = ['={=}=', '[  ]'];

export const ENEMY_KAMIKAZE_ART = ['\\!/'];
export const ENEMY_KAMIKAZE_ALT = ['/!\\'];

export const ENEMY_SPAWNER_ART = ['{===}', '|ooo|', '{===}'];
export const ENEMY_SPAWNER_ALT = ['{===}', '|o o|', '{===}'];

export const ENEMY_MINE_ART = ['(*)'];
export const ENEMY_MINE_ALT = ['(+)'];

// ── Boss art variants ──
const BOSS_ART_SMALL = ['/[=====]\\', '|{ >O< }|', '\\[=====]/'];
const BOSS_ART_MEDIUM = [' /[=======]\\ ', '<|{ >>O<< }|>', ' |{ /|||\\  }| ', ' \\[=======]/ '];
const BOSS_ART_LARGE = ['  /[=========]\\  ', ' <|{  >>O<<  }|> ', ' <|{ /|||||\\ }|> ', '  |{  |||||  }|  ', '  \\[=========]/  '];

// ── Fuel rock art ──
export const FUEL_ROCK_ART = [' /#\\', '|+F+|', ' \\#/'];
export const FUEL_ROCK_ALT = [' /#\\', '|*F*|', ' \\#/'];

// ── Hazard art ──
export const HAZARD_ART = ['><><><', '<><><>'];

// ── Power-up art ──
export const POWERUP_ART = {
  spread: ['<3>'], speed: ['<S>'], shield: ['<O>'], rocket: ['<R>'], rapid: ['<F>'], bomb: ['<B>'], fuel: ['+F+'],
};

// ── Player factory (reads from gameconfig via SHIPS) ──
export function createPlayer(id, x, y, shipType) {
  shipType = shipType != null ? shipType : 0;
  const ship = SHIPS[shipType] || SHIPS[0];
  return {
    id, x, y,
    w: PLAYER.hitboxW,
    h: PLAYER.hitboxH,
    alive: true,
    score: 0,
    lives: ship.startLives,
    fireCooldown: 0,
    rocketCooldown: 0,
    invincibleTimer: 0,
    spreadLevel: ship.startSpread,
    hasRocket: ship.startRocket,
    rapidLevel: ship.startRapid,
    speedBoost: 0,
    shieldHP: ship.startShield,
    shipType,
    speedMult: ship.speedMult,
    invincMult: ship.invincMult,
    bombs: 1,
    fuel: FUEL.startFuel,
    maxFuel: FUEL.maxFuel,
  };
}

// ── Enemy factory (reads from gameconfig) ──
export function createEnemy(type, x, y) {
  const d = ENEMY_CFG[type] || ENEMY_CFG.small;
  const enemy = {
    type: 'enemy', enemyType: type,
    x, y, w: d.hitboxW, h: d.hitboxH,
    hp: d.hp, maxHp: d.hp,
    speed: d.speed,
    score: d.score,
    fires: d.fires,
    alive: true,
    fireCooldown: d.fires ? d.fireCooldownMin + Math.random() * (d.fireCooldownMax - d.fireCooldownMin) : 0,
    animTimer: Math.random() * 10,
    pattern: 'straight',
    patternData: {},
  };

  // New enemy type properties
  if (d.hasShield) {
    enemy.hasShield = true;
    enemy.shieldHP = d.shieldHP;
  }
  if (d.isKamikaze) {
    enemy.isKamikaze = true;
    enemy.kamikazeSpeed = 0.5; // starts slow, accelerates
  }
  if (d.isSpawner) {
    enemy.isSpawner = true;
    enemy.spawnRate = d.spawnRate;
    enemy.spawnTimer = d.spawnRate;
  }
  if (d.isStationary) {
    enemy.isStationary = true;
    enemy.explosionRadius = d.explosionRadius;
  }
  if (d.isFuelRock) {
    enemy.isFuelRock = true;
  }

  return enemy;
}

// ── Boss factory (reads from gameconfig) ──
export function createBoss(difficulty) {
  const hp = BOSS_CFG.baseHp + difficulty * BOSS_CFG.hpPerLevel;
  let art, w, h;
  if (difficulty >= BOSS_CFG.largeAt) {
    art = BOSS_ART_LARGE; w = 170; h = 80;
  } else if (difficulty >= BOSS_CFG.mediumAt) {
    art = BOSS_ART_MEDIUM; w = 140; h = 64;
  } else {
    art = BOSS_ART_SMALL; w = 110; h = 48;
  }
  return {
    type: 'boss',
    x: 240 - w / 2, y: -h - 10,
    w, h,
    hp, maxHp: hp,
    speed: BOSS_CFG.speed,
    score: BOSS_CFG.baseScore + difficulty * BOSS_CFG.scorePerLevel,
    alive: true,
    fireCooldown: 60,
    spreadCooldown: 0,
    aimedCooldown: 0,
    animTimer: 0,
    art,
    moveDir: 1,
    targetY: BOSS_CFG.targetY,
    entered: false,
  };
}

// ── Bullet factory ──
export function createBullet(x, y, vx, vy, owner, damage, isRocket) {
  return {
    x, y, vx: vx || 0, vy,
    owner,
    alive: true,
    damage: damage || 1,
    isRocket: isRocket || false,
  };
}

// ── Hazard factory (reads from gameconfig) ──
export function createHazard(x, y) {
  return {
    type: 'hazard',
    x, y,
    w: HAZARD.hitboxW,
    h: HAZARD.hitboxH,
    speed: HAZARD.speedMin + Math.random() * (HAZARD.speedMax - HAZARD.speedMin),
    alive: true,
    vx: (Math.random() > 0.5 ? 1 : -1) * (HAZARD.zigzagMin + Math.random() * (HAZARD.zigzagMax - HAZARD.zigzagMin)),
    animTimer: Math.random() * 10,
  };
}

// ── Power-up factory ──
export function createPowerUp(x, y, kind) {
  const kinds = ['spread', 'speed', 'shield', 'rocket', 'rapid'];
  if (!kind) {
    // Chance to be a bomb (from config)
    if (Math.random() < POWERUPS.bombDropChance) {
      kind = 'bomb';
    } else {
      kind = kinds[Math.random() * kinds.length | 0];
    }
  }
  return {
    x, y, w: 30, h: 16,
    kind, alive: true,
    bobTime: Math.random() * 10,
  };
}

