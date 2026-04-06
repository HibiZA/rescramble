import { WORLD_W, WORLD_H, C } from './constants.js';
import { PLAYER, ENEMY_BULLET, SHIP_CONFIGS, FUEL, BOSS, ENEMIES, DAMAGE } from './gameconfig.js';
import { createBullet, createPowerUp, createEnemy } from './entities.js';
import { keys, touch } from './input.js';
import { spawnParticles } from './particles.js';
import { sfxShoot, sfxRocket, sfxHit, sfxExplosion, sfxPlayerHit, sfxPowerup, sfxBomb, sfxFuelWarning, sfxFuelPickup, sfxBossExplosion, resetBossDeathPitch, setMusicIntensity } from './audio.js';
import { scaleEnemy } from './level.js';

// ── Bomb activation ──
let bWasDown = false;

export function activateBomb(player, world) {
  if (!player.alive || player.bombs <= 0) return;
  player.bombs--;
  sfxBomb();

  const shipType = player.shipType || 0;
  const shipCfg = SHIP_CONFIGS[shipType];
  const bombName = shipCfg ? shipCfg.bombName : 'EMP BLAST';

  // Trigger screen flash
  world.screenFlash = 10;

  switch (bombName) {
    case 'EMP BLAST': {
      // Destroy all enemy bullets on screen + damage all enemies for 2
      world.bullets = world.bullets.filter(b => {
        if (b.owner === 'enemy') {
          spawnParticles(b.x, b.y, 0, '#44aaff', 3, 1);
          return false;
        }
        return true;
      });
      for (const e of world.enemies) {
        if (!e.alive) continue;
        e.hp -= 2;
        spawnParticles(e.x + e.w / 2, e.y + e.h / 2, 0, '#44aaff', 5, 2);
        if (e.hp <= 0) {
          e.alive = false;
          world.enemiesKilled++;
          player.score += e.score;
          sfxExplosion();
        }
      }
      break;
    }
    case 'SONIC DASH': {
      // Player becomes invincible for 3 seconds (180 frames) and moves 3x speed
      world.bombEffect = { type: 'sonic_dash', timer: 180, playerId: player.id };
      player.invincibleTimer = Math.max(player.invincibleTimer, 180);
      break;
    }
    case 'WALL': {
      // Spawn a row of shield characters across screen that blocks bullets for 5 seconds
      world.bombEffect = { type: 'wall', timer: 300, y: WORLD_H * 0.35 };
      break;
    }
    case 'MEGA BURST': {
      // Fire 20 bullets in all directions
      const cx = player.x + player.w / 2;
      const cy = player.y + player.h / 2;
      for (let i = 0; i < 20; i++) {
        const angle = (i / 20) * Math.PI * 2;
        const vx = Math.cos(angle) * PLAYER.bulletSpeed;
        const vy = Math.sin(angle) * PLAYER.bulletSpeed;
        world.bullets.push(createBullet(cx, cy, vx, vy, 'player', 2, false));
      }
      break;
    }
    case 'VOID': {
      // All enemies freeze for 3 seconds, player invisible
      world.bombEffect = { type: 'void', timer: 180, playerId: player.id };
      player.invincibleTimer = Math.max(player.invincibleTimer, 180);
      break;
    }
  }
}

// ── Update Player ──
export function updatePlayer(p, world, coopMode) {
  if (!p.alive) return;

  let ix = 0, iy = 0, fire = false, bomb = false;
  const speedMult = p.speedMult || 1.0;

  // Sonic dash speed multiplier
  let bombSpeedMult = 1.0;
  if (world.bombEffect && world.bombEffect.type === 'sonic_dash' && world.bombEffect.playerId === p.id && world.bombEffect.timer > 0) {
    bombSpeedMult = 3.0;
  }

  const spd = (PLAYER.baseSpeed + (p.speedBoost > 0 ? PLAYER.speedBoostAmount : 0)) * speedMult * bombSpeedMult;

  if (p.id === 0) {
    if (keys['KeyA'] || touch.left) ix = -1;
    if (keys['KeyD'] || touch.right) ix = 1;
    if (keys['KeyW'] || touch.up) iy = -1;
    if (keys['KeyS'] || touch.down) iy = 1;
    if (!coopMode) {
      if (keys['ArrowLeft']) ix = -1;
      if (keys['ArrowRight']) ix = 1;
      if (keys['ArrowUp']) iy = -1;
      if (keys['ArrowDown']) iy = 1;
    }
    fire = !!(keys['Space'] || touch.jump);
    // Bomb with B key (edge detection)
    const bDown = !!keys['KeyB'];
    if (bDown && !bWasDown) bomb = true;
    bWasDown = bDown;
  }
  if (coopMode && p.id === 1) {
    if (keys['ArrowLeft']) ix = -1;
    if (keys['ArrowRight']) ix = 1;
    if (keys['ArrowUp']) iy = -1;
    if (keys['ArrowDown']) iy = 1;
    fire = !!keys['Enter'];
  }

  // Normalize diagonal
  if (ix && iy) { ix *= 0.707; iy *= 0.707; }

  p.x += ix * spd;
  p.y += iy * spd;

  // Clamp to play area (bottom portion)
  const minY = WORLD_H * PLAYER.moveZoneTop;
  if (p.x < 10) p.x = 10;
  if (p.x + p.w > WORLD_W - 10) p.x = WORLD_W - 10 - p.w;
  if (p.y < minY) p.y = minY;
  if (p.y + p.h > WORLD_H - 10) p.y = WORLD_H - 10 - p.h;

  // Firing - bullets and rockets have separate cooldowns
  if (p.fireCooldown > 0) p.fireCooldown--;
  if (p.rocketCooldown > 0) p.rocketCooldown--;

  if (fire && p.fireCooldown <= 0) {
    const cx = p.x + p.w / 2;
    const top = p.y - 4;
    const spd = -PLAYER.bulletSpeed;

    if (p.hasSpread) {
      world.bullets.push(createBullet(cx, top, 0, spd, 'player', DAMAGE.playerBullet));
      world.bullets.push(createBullet(cx, top, -2.5, spd, 'player', DAMAGE.playerBullet));
      world.bullets.push(createBullet(cx, top, 2.5, spd, 'player', DAMAGE.playerBullet));
    } else {
      world.bullets.push(createBullet(cx, top, 0, spd, 'player', DAMAGE.playerBullet));
    }

    sfxShoot();
    p.fireCooldown = p.hasRapid ? Math.floor(PLAYER.fireRate / 2) : PLAYER.fireRate;
  }

  // Rockets: separate slower cooldown (3x bullet rate)
  if (fire && p.hasRocket && p.rocketCooldown <= 0) {
    const cx = p.x + p.w / 2;
    world.bullets.push(createBullet(cx, p.y - 8, 0, -PLAYER.bulletSpeed * 0.6, 'player', DAMAGE.rocketDirect, true));
    sfxRocket();
    p.rocketCooldown = PLAYER.rocketFireRate;
  }

  // Bomb activation
  if (bomb) {
    activateBomb(p, world);
  }

  // Fuel drain
  p.fuel -= FUEL.burnRate;
  if (p.fuel <= 0) {
    p.fuel = 0;
    p.lives = 0;
    spawnDeathParticles(p);
    world.screenFlash = 10;
    world.hitStop = 4;
    p.alive = false;
    sfxPlayerHit();
    return;
  }

  // Fuel warning sound
  if (p.fuel / p.maxFuel < FUEL.warningThreshold) {
    if (!p._fuelWarnTimer) p._fuelWarnTimer = 0;
    p._fuelWarnTimer++;
    if (p._fuelWarnTimer % 30 === 0) {
      sfxFuelWarning();
    }
  } else {
    p._fuelWarnTimer = 0;
  }

  // Timers - apply invincibility multiplier (deterministic fractional counter)
  if (p.invincibleTimer > 0) {
    const invincMult = p.invincMult || 1.0;
    if (invincMult > 1.0) {
      // Use fractional accumulator: decrement only when accumulator reaches 1
      p._invincAccum = (p._invincAccum || 0) + (1.0 / invincMult);
      if (p._invincAccum >= 1.0) {
        p._invincAccum -= 1.0;
        p.invincibleTimer--;
      }
    } else {
      p.invincibleTimer--;
    }
  }
  if (p.speedBoost > 0) p.speedBoost--;

  // Power-up pickup
  for (const pu of world.powerups) {
    if (!pu.alive) continue;
    if (boxHit(p.x, p.y, p.w, p.h, pu.x - pu.w/2, pu.y, pu.w, pu.h)) {
      pu.alive = false;
      spawnParticles(pu.x, pu.y, 0, C.powerup, 8, 3);
      sfxPowerup();
      if (pu.kind === 'spread') p.hasSpread = true;
      else if (pu.kind === 'rocket') p.hasRocket = true;
      else if (pu.kind === 'rapid') p.hasRapid = true;
      else if (pu.kind === 'speed') p.speedBoost = PLAYER.speedBoostDuration;
      else if (pu.kind === 'shield') p.shieldHP = Math.min(p.shieldHP + 3, PLAYER.shieldMax);
      else if (pu.kind === 'bomb') p.bombs = Math.min(p.bombs + 1, 5);
      else if (pu.kind === 'fuel') {
        p.fuel = Math.min(p.fuel + FUEL.fuelPickupAmount, p.maxFuel);
        sfxFuelPickup();
      }
    }
  }
}

function boxHit(ax, ay, aw, ah, bx, by, bw, bh) {
  return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
}

// ── Update Enemies ──
export function updateEnemies(world, players) {
  // Update bomb effect timer
  if (world.bombEffect) {
    world.bombEffect.timer--;
    if (world.bombEffect.timer <= 0) {
      world.bombEffect = null;
    }
  }

  const isFrozen = world.bombEffect && world.bombEffect.type === 'void';

  for (const e of world.enemies) {
    if (!e.alive) continue;

    e.animTimer += 0.025; // slower animation

    // If frozen by VOID bomb, skip movement and actions
    if (isFrozen) continue;

    // Stationary enemies (mines) don't move
    if (e.isStationary) {
      // Check proximity to players for mine explosion
      if (e.explosionRadius && players) {
        for (const p of players) {
          if (!p.alive) continue;
          const dx = (p.x + p.w / 2) - (e.x + e.w / 2);
          const dy = (p.y + p.h / 2) - (e.y + e.h / 2);
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < e.explosionRadius) {
            // Explode!
            e.alive = false;
            spawnParticles(e.x + e.w / 2, e.y + e.h / 2, 0, '#ff8800', 20, 6);
            sfxExplosion();
            // Damage player
            if (p.invincibleTimer <= 0) {
              if (p.shieldHP > 0) {
                p.shieldHP--;
              } else {
                p.lives--;
                p.invincibleTimer = PLAYER.invincFrames;
                sfxPlayerHit();
                if (p.lives <= 0) {
                  // Death animation: spawn particles for each character of ship art
                  spawnDeathParticles(p);
                  p.alive = false;
                }
              }
            }
            break;
          }
        }
      }
      // Mines still scroll down slowly so they eventually leave screen
      e.y += 0.2;
      if (e.y > WORLD_H + 60) e.alive = false;
      continue;
    }

    // Kamikaze: aim at nearest player and accelerate
    if (e.isKamikaze && players) {
      let nearest = null;
      let nearDist = Infinity;
      for (const p of players) {
        if (!p.alive) continue;
        const dx = (p.x + p.w / 2) - (e.x + e.w / 2);
        const dy = (p.y + p.h / 2) - (e.y + e.h / 2);
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d < nearDist) { nearDist = d; nearest = p; }
      }
      if (nearest) {
        const dx = (nearest.x + nearest.w / 2) - (e.x + e.w / 2);
        const dy = (nearest.y + nearest.h / 2) - (e.y + e.h / 2);
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        e.kamikazeSpeed = Math.min((e.kamikazeSpeed || 0.5) + 0.02, 5);
        e.x += (dx / dist) * e.kamikazeSpeed;
        e.y += (dy / dist) * e.kamikazeSpeed;
      } else {
        e.y += 1.2; // fall down if no target
      }
    } else if (e.isSpawner) {
      // Spawner: moves slowly, spawns small enemies periodically
      e.y += e.speed;
      e.spawnTimer--;
      if (e.spawnTimer <= 0) {
        e.spawnTimer = e.spawnRate;
        // Spawn a small enemy at spawner position
        const child = scaleEnemy(createEnemy('small', e.x + e.w / 2 - 15, e.y + e.h), world.difficulty);
        child.pattern = 'straight';
        world.enemies.push(child);
      }
    } else {
      // Normal movement patterns
      switch (e.pattern) {
        case 'straight':
          e.y += e.speed;
          break;
        case 'zigzag': {
          e.y += e.speed;
          const d = e.patternData;
          e.x = (d.originX || e.x) + Math.sin(e.y * d.freq + d.phase) * d.amp;
          if (!d.originX) d.originX = e.x;
          break;
        }
        case 'vformation':
          e.y += e.speed * 1.2;
          break;
        case 'leftEntry': {
          // Enter from the left, curve in
          const d = e.patternData;
          if (!d.entered) {
            e.x += 2;
            e.y += e.speed * 0.5;
            if (e.x > (d.targetX || WORLD_W / 2)) d.entered = true;
          } else {
            e.y += e.speed;
          }
          break;
        }
        case 'rightEntry': {
          // Enter from the right, curve in
          const d = e.patternData;
          if (!d.entered) {
            e.x -= 2;
            e.y += e.speed * 0.5;
            if (e.x < (d.targetX || WORLD_W / 2)) d.entered = true;
          } else {
            e.y += e.speed;
          }
          break;
        }
        default:
          e.y += e.speed;
      }
    }

    // Clamp x
    if (e.x < 5) e.x = 5;
    if (e.x + e.w > WORLD_W - 5) e.x = WORLD_W - 5 - e.w;

    // Off screen (bottom) = remove
    if (e.y > WORLD_H + 60) {
      e.alive = false;
      continue;
    }

    // Firing
    if (e.fires && e.y > 0) {
      e.fireCooldown -= 1;
      if (e.fireCooldown <= 0) {
        const cfg = ENEMIES[e.enemyType];
        e.fireCooldown = cfg.fireCooldownMin + Math.random() * (cfg.fireCooldownMax - cfg.fireCooldownMin);
        const cx = e.x + e.w / 2;
        const bot = e.y + e.h;
        if (e.enemyType === 'big') {
          // Spread shot
          world.bullets.push(createBullet(cx, bot, -1.5, ENEMY_BULLET.speed, 'enemy'));
          world.bullets.push(createBullet(cx, bot, 0, ENEMY_BULLET.speed, 'enemy'));
          world.bullets.push(createBullet(cx, bot, 1.5, ENEMY_BULLET.speed, 'enemy'));
        } else {
          world.bullets.push(createBullet(cx, bot, 0, ENEMY_BULLET.speed, 'enemy'));
        }
      }
    }
  }

  // Cleanup dead
  world.enemies = world.enemies.filter(e => e.alive);
}

// ── Spawn death particles for each character of ship art ──
function spawnDeathParticles(player) {
  const ship = SHIP_CONFIGS[player.shipType || 0];
  const art = ship ? ship.art : ['  ^  ', ' [#] ', '=| |='];
  const cx = player.x + player.w / 2;
  const cy = player.y;
  for (let r = 0; r < art.length; r++) {
    const line = art[r];
    for (let c = 0; c < line.length; c++) {
      if (line[c] !== ' ') {
        const px = cx + (c - line.length / 2) * 8;
        const py = cy + r * 16;
        spawnParticles(px, py, 0, player.id === 0 ? C.player1 : C.player2, 1, 4);
      }
    }
  }
}

// ── Update Boss ──
export function updateBoss(world, players) {
  const boss = world.boss;
  if (!boss) return;

  // Boss death animation: rising-pitch explosions over 2 seconds
  if (boss.dying) {
    boss.deathTimer--;
    // Drift toward screen center so the explosion is visible
    const centerX = WORLD_W / 2 - boss.w / 2;
    const centerY = WORLD_H * 0.3;
    boss.x += (centerX - boss.x) * 0.04;
    boss.y += (centerY - boss.y) * 0.04;
    // Explosions get faster as timer counts down
    const interval = boss.deathTimer > 60 ? 10 : boss.deathTimer > 30 ? 6 : 3;
    if (boss.deathTimer % interval === 0) {
      const ox = boss.x + Math.random() * boss.w;
      const oy = boss.y + Math.random() * boss.h;
      const colors = ['#ff44ff', '#ffee44', '#ff3355', '#ffffff'];
      spawnParticles(ox, oy, 0, colors[Math.random() * colors.length | 0], 12, 5);
      sfxBossExplosion(); // rising pitch with each explosion
    }
    // Final big explosion
    if (boss.deathTimer <= 0) {
      for (let i = 0; i < 10; i++) {
        spawnParticles(boss.x + Math.random() * boss.w, boss.y + Math.random() * boss.h, 0, '#ffee44', 25, 8);
      }
      world.screenFlash = 20;
      sfxBomb();
      resetBossDeathPitch();
      // Award score + drop powerup
      const scorer = players.find(p => p.alive) || players[0];
      if (scorer) scorer.score += boss.score;
      world.enemiesKilled += 10;
      world.powerups.push(createPowerUp(boss.x + boss.w / 2, boss.y + boss.h / 2));
      world.boss = null;
    }
    return;
  }

  if (!boss.alive) return;

  // If frozen by VOID bomb, skip
  if (world.bombEffect && world.bombEffect.type === 'void') return;

  boss.animTimer += 0.04;

  // Entry: descend to targetY
  if (!boss.entered) {
    boss.y += 0.8;
    if (boss.y >= boss.targetY) {
      boss.y = boss.targetY;
      boss.entered = true;
    }
    return; // Don't attack while entering
  }

  // Side-to-side patrol
  boss.x += boss.speed * boss.moveDir;
  if (boss.x + boss.w > WORLD_W - 10) { boss.moveDir = -1; }
  if (boss.x < 10) { boss.moveDir = 1; }

  // Find nearest alive player for aimed shots
  let target = null;
  for (const p of players) {
    if (p.alive) { target = p; break; }
  }

  const cx = boss.x + boss.w / 2;
  const bot = boss.y + boss.h;

  // Spread shot pattern
  boss.spreadCooldown--;
  if (boss.spreadCooldown <= 0) {
    boss.spreadCooldown = BOSS.spreadCooldown[0] + Math.random() * (BOSS.spreadCooldown[1] - BOSS.spreadCooldown[0]);
    const half = Math.max((BOSS.spreadCount - 1) / 2, 1);
    for (let i = 0; i < BOSS.spreadCount; i++) {
      const vx = (i - half) * (BOSS.spreadAngle / half);
      world.bullets.push(createBullet(cx, bot, vx, ENEMY_BULLET.speed, 'enemy'));
    }
  }

  // Aimed shot at player
  boss.aimedCooldown--;
  if (boss.aimedCooldown <= 0 && target) {
    boss.aimedCooldown = BOSS.aimedCooldown[0] + Math.random() * (BOSS.aimedCooldown[1] - BOSS.aimedCooldown[0]);
    const dx = (target.x + target.w / 2) - cx;
    const dy = (target.y + target.h / 2) - bot;
    const dist = Math.sqrt(dx * dx + dy * dy) || 1;
    const speed = ENEMY_BULLET.speed * 1.2;
    world.bullets.push(createBullet(cx, bot, (dx / dist) * speed, (dy / dist) * speed, 'enemy'));
    // Fire two flanking aimed bullets
    world.bullets.push(createBullet(cx - 20, bot, (dx / dist) * speed, (dy / dist) * speed, 'enemy'));
    world.bullets.push(createBullet(cx + 20, bot, (dx / dist) * speed, (dy / dist) * speed, 'enemy'));
  }
}

// ── Update Hazards (unkillable obstacles) ──
export function updateHazards(world, players) {
  let shake = 0;
  for (const h of world.hazards) {
    if (!h.alive) continue;
    h.animTimer += 0.08;

    // Move down fast, zigzag horizontally
    h.y += h.speed;
    h.x += h.vx;
    if (h.x < 10 || h.x + h.w > WORLD_W - 10) h.vx *= -1;

    // Off screen
    if (h.y > WORLD_H + 60) { h.alive = false; continue; }

    // Hit player: strip ALL bonuses, no damage to lives
    for (const p of players) {
      if (!p.alive || p.invincibleTimer > 0) continue;
      if (boxHit(p.x, p.y, p.w, p.h, h.x, h.y, h.w, h.h)) {
        // Strip everything + halve fuel
        p.hasSpread = false;
        p.hasRocket = false;
        p.hasRapid = false;
        p.speedBoost = 0;
        p.shieldHP = 0;
        p.fuel = Math.floor(p.fuel / 2);
        p.invincibleTimer = 60; // brief invincibility so it doesn't keep triggering
        spawnParticles(p.x + p.w / 2, p.y + p.h / 2, 0, '#ff8800', 20, 5);
        shake = Math.max(shake, 4);
      }
    }
  }
  world.hazards = world.hazards.filter(h => h.alive);

  // Bullets pass through hazards (they're unkillable) - but show a deflect particle
  for (const b of world.bullets) {
    if (!b.alive || b.owner !== 'player') continue;
    for (const h of world.hazards) {
      if (!h.alive) continue;
      if (b.x > h.x && b.x < h.x + h.w && b.y > h.y && b.y < h.y + h.h) {
        b.alive = false;
        spawnParticles(b.x, b.y, 0, '#888888', 3, 1);
      }
    }
  }

  return shake;
}

function getNearestPlayer(players, x) {
  let best = players[0];
  if (players.length > 1 && players[1].alive) {
    if (Math.abs(players[1].x - x) < Math.abs(players[0].x - x)) best = players[1];
  }
  return best && best.alive ? best : players.find(p => p.alive) || players[0];
}

// ── Adaptive weapon drop algorithm ──
// Factors:
//   1. Weapon loadout: fewer weapons = higher chance (catch-up mechanic)
//   2. Difficulty scaling: higher difficulty = slightly more drops (keeps pace with harder enemies)
//   3. Drought timer: longer since last drop = increasing pressure
//   4. Enemy value: bigger enemies have higher base drop chance
//   5. Random jitter for unpredictability
// Weapons: spread, rocket, rapid (3 total). Bombs/shields also in the pool.

let _weaponDroughtKills = 0; // kills since last weapon drop

function checkPowerupDrop(world, enemy, players) {
  _weaponDroughtKills++;
  const x = enemy.x + enemy.w / 2;
  const y = enemy.y + enemy.h / 2;

  // Find the scoring player's weapon count
  const scorer = players ? (players.find(p => p.alive) || players[0]) : null;
  let weaponCount = 0;
  if (scorer) {
    if (scorer.hasSpread) weaponCount++;
    if (scorer.hasRocket) weaponCount++;
    if (scorer.hasRapid) weaponCount++;
    if (scorer.shieldHP > 0) weaponCount += 0.5;
    if (scorer.bombs > 1) weaponCount += 0.3;
  }
  // 0 = naked, 3+ = fully loaded

  // Factor 1: Weapon poverty (fewer weapons = more drops)
  // 0 weapons: 0.08 base. 1: 0.04. 2: 0.02. 3: 0.008
  const poverty = Math.max(0.008, 0.08 * Math.pow(0.5, weaponCount));

  // Factor 2: Difficulty scaling
  // Higher difficulty = slightly more generous (compensate for harder enemies)
  const diffBonus = Math.min(world.difficulty * 0.002, 0.03);

  // Factor 3: Drought (kills since last weapon drop)
  // After 30 kills with no drop, start boosting. Caps at +0.06
  const droughtBoost = _weaponDroughtKills > 30
    ? Math.min((_weaponDroughtKills - 30) / 500, 0.06) : 0;

  // Factor 4: Enemy value (bigger enemies = better loot chance)
  let valueMult = 1.0;
  if (enemy.enemyType === 'big' || enemy.enemyType === 'spawner') valueMult = 2.5;
  else if (enemy.enemyType === 'medium' || enemy.enemyType === 'shielded') valueMult = 1.5;
  else if (enemy.enemyType === 'small' || enemy.enemyType === 'kamikaze') valueMult = 0.8;

  // Factor 5: Jitter
  const jitter = 1 + (Math.random() - 0.5) * 0.5;

  let chance = (poverty + diffBonus + droughtBoost) * valueMult * jitter;

  // Clamp
  chance = Math.max(0.005, Math.min(0.25, chance));

  // Suppress when fully loaded (3+ weapons)
  if (weaponCount >= 3) chance *= 0.3;

  if (Math.random() < chance) {
    world.powerups.push(createPowerUp(x, y));
    _weaponDroughtKills = 0;
  }
}

// ── Adaptive fuel drop algorithm ──
// Monitors player fuel level and adjusts drop probability dynamically.
// Uses multiple factors to create natural-feeling fuel economy:
//   1. Fuel ratio (lower fuel = higher chance)
//   2. Rate of fuel loss (burning faster than gaining = more drops)
//   3. Drought timer (longer since last fuel drop = increasing pressure)
//   4. Kill streak bonus (rapid kills slightly boost chance)
//   5. Random jitter so it never feels predictable
// The result is: you almost never see fuel when full, occasionally when half,
// and frequently (but not guaranteed) when critically low.

let _fuelHistory = []; // rolling window of fuel levels
let _lastFuelDrop = 0; // game timer of last fuel drop
let _killStreak = 0;   // kills within a short window
let _killStreakTimer = 0;

function calculateFuelDropChance(scorer, world) {
  const fuelRatio = scorer.fuel / scorer.maxFuel; // 0 = empty, 1 = full

  // Factor 1: Exponential urgency curve (scaled down for scarcity)
  // At 100%: ~0.005. At 50%: ~0.03. At 25%: ~0.08. At 10%: ~0.18
  const urgency = Math.pow(1 - fuelRatio, 2.5) * 0.2;

  // Factor 2: Rate of change (are we losing fuel faster than gaining?)
  _fuelHistory.push(fuelRatio);
  if (_fuelHistory.length > 120) _fuelHistory.shift(); // 2-second window
  const fuelTrend = _fuelHistory.length > 10
    ? (_fuelHistory[_fuelHistory.length - 1] - _fuelHistory[_fuelHistory.length - 10]) / 10
    : 0;
  // Negative trend = losing fuel = boost drop chance
  const trendBoost = fuelTrend < 0 ? Math.min(Math.abs(fuelTrend) * 50, 0.1) : 0;

  // Factor 3: Drought timer (frames since last fuel drop)
  const drought = world.gameTimer - _lastFuelDrop;
  // After 600 frames (~10s) with no drop, start boosting. Caps at +0.15
  const droughtBoost = drought > 600 ? Math.min((drought - 600) / 3000, 0.15) : 0;

  // Factor 4: Kill streak (rapid kills = small bonus)
  _killStreakTimer--;
  if (_killStreakTimer <= 0) { _killStreak = 0; }
  _killStreak++;
  _killStreakTimer = 30; // streak resets after 0.5 seconds of no kills
  const streakBonus = _killStreak > 5 ? 0.03 : _killStreak > 3 ? 0.01 : 0;

  // Factor 5: Random jitter ±20% of base value
  const jitter = 1 + (Math.random() - 0.5) * 0.4;

  // Combine all factors
  let chance = (urgency + trendBoost + droughtBoost + streakBonus) * jitter;

  // Hard floor: never below 1% so there's always a tiny chance
  chance = Math.max(0.01, chance);

  // Hard ceiling: never above 40% so it's never guaranteed
  chance = Math.min(0.40, chance);

  // At full fuel (>95%), suppress to near-zero
  if (fuelRatio > 0.95) chance *= 0.1;

  return chance;
}

function applyFuelOnKill(scorer, world, enemy) {
  if (!scorer) return;
  scorer.fuel = Math.min(scorer.fuel + FUEL.fuelPerKill, scorer.maxFuel);

  // Fuel rocks ALWAYS drop fuel
  if (enemy.isFuelRock) {
    world.powerups.push(createPowerUp(enemy.x + enemy.w / 2, enemy.y + enemy.h / 2, 'fuel'));
    _lastFuelDrop = world.gameTimer;
    return;
  }

  // Adaptive drop chance based on player state
  const dropChance = calculateFuelDropChance(scorer, world);
  if (Math.random() < dropChance) {
    world.powerups.push(createPowerUp(enemy.x + enemy.w / 2, enemy.y + enemy.h / 2, 'fuel'));
    _lastFuelDrop = world.gameTimer;
    _fuelHistory.length = 0; // reset trend after a drop
  }
}

// ── Update Bullets ──
export function updateBullets(world, players) {
  let shake = 0;

  // WALL bomb effect: block enemy bullets at the wall Y position
  const wallActive = world.bombEffect && world.bombEffect.type === 'wall';
  const wallY = wallActive ? world.bombEffect.y : 0;

  for (const b of world.bullets) {
    if (!b.alive) continue;
    b.x += b.vx;
    b.y += b.vy;

    // Off screen
    if (b.y < -20 || b.y > WORLD_H + 20 || b.x < -20 || b.x > WORLD_W + 20) {
      b.alive = false;
      continue;
    }

    // WALL bomb blocks enemy bullets
    if (wallActive && b.owner === 'enemy') {
      if (b.y > wallY - 8 && b.y < wallY + 8) {
        b.alive = false;
        spawnParticles(b.x, b.y, 0, '#44ffaa', 3, 1);
        continue;
      }
    }

    if (b.owner === 'player') {
      // Hit enemies
      for (const e of world.enemies) {
        if (!e.alive) continue;
        if (b.x > e.x && b.x < e.x + e.w && b.y > e.y && b.y < e.y + e.h) {
          // Shielded enemy: bullets from above blocked by shield
          if (e.hasShield && e.shieldHP > 0 && b.vy < 0) {
            // Bullet coming from below (player fires upward, vy is negative)
            // Check if hitting top half of enemy
            if (b.y < e.y + e.h / 2) {
              e.shieldHP--;
              b.alive = false;
              spawnParticles(b.x, b.y, 0, '#4488ff', 4, 2);
              sfxHit();
              break;
            }
          }

          b.alive = false;

          // Rocket AOE: damage all enemies within radius
          if (b.isRocket) {
            const AOE_RADIUS = PLAYER.rocketAoeRadius;
            spawnParticles(b.x, b.y, 0, '#ffaa22', 20, 6);
            sfxExplosion();
            for (const ae of world.enemies) {
              if (!ae.alive) continue;
              const dx = (ae.x + ae.w / 2) - b.x;
              const dy = (ae.y + ae.h / 2) - b.y;
              const dist = Math.sqrt(dx * dx + dy * dy);
              if (dist < AOE_RADIUS) {
                const dmg = dist < AOE_RADIUS * 0.4 ? PLAYER.rocketAoeInnerDmg : dist < AOE_RADIUS * 0.7 ? PLAYER.rocketAoeMidDmg : PLAYER.rocketAoeOuterDmg;
                ae.hp -= dmg;
                if (ae.hp <= 0) {
                  ae.alive = false;
                  world.enemiesKilled++;
                  const scorer = getNearestPlayer(players, b.x);
                  if (scorer) scorer.score += ae.score;
                  const col = getEnemyDeathColor(ae.enemyType);
                  spawnParticles(ae.x + ae.w / 2, ae.y + ae.h / 2, 0, col, 8, 3);
                  sfxExplosion();
                  checkPowerupDrop(world, ae, players);
                  applyFuelOnKill(scorer, world, ae);
                }
              }
            }
          } else {
            // Normal bullet: single target
            e.hp -= (b.damage || 1);
            sfxHit();
            if (e.hp <= 0) {
              e.alive = false;
              world.enemiesKilled++;
              const scorer = getNearestPlayer(players, b.x);
              if (scorer) scorer.score += e.score;
              const col = getEnemyDeathColor(e.enemyType);
              spawnParticles(e.x + e.w / 2, e.y + e.h / 2, 0, col, e.enemyType === 'big' ? 18 : 10, 4);
              sfxExplosion();
              // no shake for enemy kills
              checkPowerupDrop(world, e, players);
              applyFuelOnKill(scorer, world, e);
            } else {
              spawnParticles(b.x, b.y, 0, '#ffffff', 3, 1);
            }
          }
          break;
        }
      }

      // Hit boss
      const boss = world.boss;
      if (b.alive && boss && boss.alive) {
        if (b.x > boss.x && b.x < boss.x + boss.w && b.y > boss.y && b.y < boss.y + boss.h) {
          b.alive = false;
          boss.hp -= (b.damage || 1);
          spawnParticles(b.x, b.y, 0, '#ffffff', 3, 1);
          sfxHit();
          if (boss.hp <= 0) {
            // Boss enters death animation (stays in world, not alive, explodes over time)
            boss.alive = false;
            boss.dying = true;
            boss.deathTimer = 120;
            world.spawnPause = 180;
            world.hitStop = 6; // longer freeze for boss kill
            setMusicIntensity(1);
            resetBossDeathPitch();
            sfxBossExplosion();
          }
        }
      }
    } else {
      // Enemy bullet hits player
      for (const p of players) {
        if (!p.alive || p.invincibleTimer > 0) continue;
        if (b.x > p.x && b.x < p.x + p.w && b.y > p.y && b.y < p.y + p.h) {
          b.alive = false;
          if (p.shieldHP > 0) {
            p.shieldHP--;
            spawnParticles(p.x + p.w/2, p.y, 0, C.powerup, 6, 2);
          } else {
            p.lives--;
            p.invincibleTimer = PLAYER.invincFrames;
            sfxPlayerHit();
            // Lose one random upgrade on death
            if (p.hasRapid) p.hasRapid = false;
            else if (p.hasRocket) p.hasRocket = false;
            else if (p.hasSpread) p.hasSpread = false;
            spawnParticles(p.x + p.w/2, p.y + p.h/2, 0, p.id === 0 ? C.player1 : C.player2, 15, 5);
            shake = Math.max(shake, 3);
            if (p.lives <= 0) {
              // Death animation
              spawnDeathParticles(p);
              world.screenFlash = 10;
              world.hitStop = 4;
              p.alive = false;
            }
          }
          break;
        }
      }
    }
  }

  // Enemy-player collision
  for (const e of world.enemies) {
    if (!e.alive) continue;
    for (const p of players) {
      if (!p.alive || p.invincibleTimer > 0) continue;
      if (boxHit(p.x, p.y, p.w, p.h, e.x, e.y, e.w, e.h)) {
        e.alive = false;
        world.enemiesKilled++;
        p.score += e.score;
        applyFuelOnKill(p, world, e);
        checkPowerupDrop(world, e, players);
        spawnParticles(e.x + e.w/2, e.y + e.h/2, 0, C.enemySmall, 12, 4);
        sfxExplosion();
        if (p.shieldHP > 0) {
          p.shieldHP--;
        } else {
          p.lives--;
          p.invincibleTimer = PLAYER.invincFrames;
          sfxPlayerHit();
          shake = Math.max(shake, 4);
          if (p.lives <= 0) {
            spawnDeathParticles(p);
            world.screenFlash = 10;
            world.hitStop = 4;
            p.alive = false;
          }
        }
        spawnParticles(p.x + p.w/2, p.y + p.h/2, 0, p.id === 0 ? C.player1 : C.player2, 12, 4);
      }
    }
  }

  // Boss-player collision
  const boss = world.boss;
  if (boss && boss.alive) {
    for (const p of players) {
      if (!p.alive || p.invincibleTimer > 0) continue;
      if (boxHit(p.x, p.y, p.w, p.h, boss.x, boss.y, boss.w, boss.h)) {
        if (p.shieldHP > 0) {
          p.shieldHP--;
        } else {
          p.lives--;
          p.invincibleTimer = PLAYER.invincFrames;
          sfxPlayerHit();
          shake = Math.max(shake, 4);
          if (p.lives <= 0) {
            spawnDeathParticles(p);
            world.screenFlash = 10;
            world.hitStop = 4;
            p.alive = false;
          }
        }
        spawnParticles(p.x + p.w/2, p.y + p.h/2, 0, p.id === 0 ? C.player1 : C.player2, 12, 4);
      }
    }
  }

  // Cleanup
  world.bullets = world.bullets.filter(b => b.alive);
  world.powerups = world.powerups.filter(p => p.alive);

  // Power-up movement (drift down slowly)
  for (const pu of world.powerups) {
    if (!pu.alive) continue;
    pu.y += 0.8;
    pu.bobTime += 0.06;
    if (pu.y > WORLD_H + 20) pu.alive = false;
  }

  return shake;
}

function getEnemyDeathColor(type) {
  if (type === 'big') return C.enemyBig;
  if (type === 'medium') return C.enemyMed;
  if (type === 'shielded') return '#4488ff';
  if (type === 'kamikaze') return '#ff6622';
  if (type === 'spawner') return C.enemyBig;
  if (type === 'mine') return '#ff8800';
  return C.enemySmall;
}

// ── Update world timers (screen flash, etc.) ──
export function updateWorldTimers(world) {
  if (world.screenFlash > 0) world.screenFlash--;
}

// ── Reset module-scoped adaptive state between games ──
export function resetPhysicsState() {
  _weaponDroughtKills = 0;
  _fuelHistory = [];
  _lastFuelDrop = 0;
  _killStreak = 0;
  _killStreakTimer = 0;
  bWasDown = false;
}
