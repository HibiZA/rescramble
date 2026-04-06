import { ctx, width, height } from './canvas.js';
import { C } from './constants.js';
import { FUEL } from './gameconfig.js';
import {
  SHIP2_ART, SHIPS,
  ENEMY_SMALL_ART, ENEMY_SMALL_ALT,
  ENEMY_MED_ART, ENEMY_MED_ALT,
  ENEMY_BIG_ART, ENEMY_BIG_ALT,
  ENEMY_SHIELDED_ART, ENEMY_SHIELDED_ALT,
  ENEMY_KAMIKAZE_ART, ENEMY_KAMIKAZE_ALT,
  ENEMY_SPAWNER_ART, ENEMY_SPAWNER_ALT,
  ENEMY_MINE_ART, ENEMY_MINE_ALT,
  POWERUP_ART, HAZARD_ART,
  FUEL_ROCK_ART, FUEL_ROCK_ALT,
} from './entities.js';
import { particles } from './particles.js';

// ═══════════════════════════════════════════════════════
// ONE UNIFIED TEXT GRID
// Background prose fills lines; game entities REPLACE characters.
// Single font, single grid, single render pass.
// ═══════════════════════════════════════════════════════

const GRID_FONT = '14px VT323, monospace';
const CH = 16; // line height
const BG_COLOR = '#334466';
const BG_ALPHA = 0.14;

// ── Measure CW (character width) ──
let CW = 0;
let cwReady = false;

let gridOffsetX = 0; // horizontal offset to center the grid

function ensureCW() {
  if (cwReady) return;
  ctx.save();
  ctx.font = GRID_FONT;
  CW = ctx.measureText('M').width;
  ctx.restore();
  if (!CW || CW < 1) CW = 8.4;
  cwReady = true;
}

// ── Background prose ──
const BG_TEXT = 'the signal propagates through layers of abstraction and noise until meaning emerges from the void between zero and one where logic breathes and circuits dream of electric sheep running through fields of binary stars that pulse in rhythm with the heartbeat of the machine a recursive descent into computation where every branch is a choice and every leaf is an answer to questions we forgot to ask in the static hum of cooling fans and the glow of phosphor screens we find our reflection staring back wondering if the code we write writes us in return through endless loops of creation and destruction building towers from semicolons reaching toward a sky of pure information cascading through networks of thought at the speed of light minus the latency of human doubt which is the only constant in a universe of variables each one named with care or carelessness depending on the hour and the coffee level a function calls itself and the stack grows deeper like memories layered upon memories each frame a snapshot of a moment that exists only in the space between keystrokes where time dilates and contracts according to the laws of deadline physics which state that work expands to fill the available panic the compiler speaks in riddles and the debugger tells half truths but the tests are honest in their failure revealing the gap between intention and implementation the signal propagates through layers of abstraction until meaning emerges from the void where logic breathes and circuits dream of binary stars';

let bgRows = null;
let bgRowCols = 0;

function getBgRows(colCount) {
  if (bgRows && bgRowCols === colCount) return bgRows;
  bgRowCols = colCount;
  bgRows = [];
  const src = BG_TEXT;
  const len = src.length;
  let idx = 0;
  for (let i = 0; i < 100; i++) {
    let row = '';
    for (let c = 0; c < colCount; c++) {
      row += src[idx % len];
      idx++;
    }
    bgRows.push(row);
  }
  return bgRows;
}

// ── Grid buffer ──
// Each cell: char + color + alpha. Background fills it, entities overwrite.
let grid = [], gridCols = 0, gridRows = 0;

function initGrid(cols, rows) {
  gridOffsetX = (width() - cols * CW) / 2;
  if (cols === gridCols && rows === gridRows) return;
  gridCols = cols; gridRows = rows;
  grid = new Array(rows * cols);
  for (let i = 0; i < grid.length; i++) grid[i] = { char: ' ', color: BG_COLOR, alpha: 0, ox: 0, oy: 0 };
}

function clearGrid() {
  for (let i = 0; i < grid.length; i++) {
    grid[i].char = ' '; grid[i].color = BG_COLOR; grid[i].alpha = 0;
  }
}

// Scrolling background offset
let bgScrollYPx = 0;

// Fill grid with background text (scrolling downward)
function fillBackground(gameTime, difficulty) {
  ensureCW();
  const rows = getBgRows(gridCols);
  if (!rows || rows.length === 0) return;

  const totalRows = rows.length;
  // Scroll speed increases with difficulty
  const scrollSpeed = 0.12 + (difficulty || 0) * 0.01;
  const scrollExact = gameTime * scrollSpeed;
  const scrollLine = Math.floor(scrollExact);
  bgScrollYPx = (scrollExact - scrollLine) * CH;

  for (let r = 0; r < gridRows; r++) {
    const rowIdx = ((r - scrollLine) % totalRows + totalRows) % totalRows;
    const text = rows[rowIdx];
    for (let c = 0; c < gridCols; c++) {
      const i = r * gridCols + c;
      grid[i].char = c < text.length ? text[c] : ' ';
      grid[i].color = BG_COLOR;
      grid[i].alpha = (grid[i].char !== ' ') ? BG_ALPHA : 0;
      grid[i].ox = 0; grid[i].oy = 0;
    }
  }
}

// ── Entity stamping: overwrite grid cells ──
function setCell(col, row, char, color, alpha, ox, oy) {
  if (col < 0 || col >= gridCols || row < 0 || row >= gridRows) return;
  const cell = grid[row * gridCols + col];
  if (alpha > cell.alpha) {
    cell.char = char; cell.color = color; cell.alpha = alpha;
    cell.ox = ox || 0; cell.oy = oy || 0;
  }
}

function worldToGrid(wx, wy) {
  return [Math.round((wx - gridOffsetX) / CW), Math.round(wy / CH)];
}

function stampArt(lines, wx, wy, color, alpha) {
  // Account for gridOffsetX: convert screen pixel to grid-relative pixel
  const gx = wx - gridOffsetX;
  const col = gx / CW;
  const row = wy / CH;
  const baseCol = Math.round(col);
  const baseRow = Math.round(row);
  const ox = (col - baseCol) * CW;
  const oy = (row - baseRow) * CH;
  for (let r = 0; r < lines.length; r++) {
    const line = lines[r];
    const startCol = baseCol - Math.floor(line.length / 2);
    for (let c = 0; c < line.length; c++) {
      if (line[c] !== ' ') setCell(startCol + c, baseRow + r, line[c], color, alpha, ox, oy);
    }
  }
}

function stampText(text, sx, sy, color, alpha, align) {
  // Account for gridOffsetX
  const gx = sx - gridOffsetX;
  const measuredW = text.length * CW;
  let startX = gx;
  if (align === 'center') startX = gx - measuredW / 2;
  else if (align === 'right') startX = gx - measuredW;
  const startCol = Math.round(startX / CW);
  const row = Math.round(sy / CH);
  for (let i = 0; i < text.length; i++) {
    if (text[i] !== ' ') setCell(startCol + i, row, text[i], color, alpha);
  }
}

// ── Entity helpers ──
function getEnemyArt(type, timer) {
  const frame = Math.floor(timer) % 2;
  if (type === 'small') return frame === 0 ? ENEMY_SMALL_ART : ENEMY_SMALL_ALT;
  if (type === 'medium') return frame === 0 ? ENEMY_MED_ART : ENEMY_MED_ALT;
  if (type === 'big') return frame === 0 ? ENEMY_BIG_ART : ENEMY_BIG_ALT;
  if (type === 'shielded') return frame === 0 ? ENEMY_SHIELDED_ART : ENEMY_SHIELDED_ALT;
  if (type === 'kamikaze') return frame === 0 ? ENEMY_KAMIKAZE_ART : ENEMY_KAMIKAZE_ALT;
  if (type === 'spawner') return frame === 0 ? ENEMY_SPAWNER_ART : ENEMY_SPAWNER_ALT;
  if (type === 'mine') return frame === 0 ? ENEMY_MINE_ART : ENEMY_MINE_ALT;
  if (type === 'fuelRock') return frame === 0 ? FUEL_ROCK_ART : FUEL_ROCK_ALT;
  return frame === 0 ? ENEMY_BIG_ART : ENEMY_BIG_ALT;
}
function getEnemyColor(type) {
  if (type === 'small') return C.enemySmall;
  if (type === 'medium') return C.enemyMed;
  if (type === 'shielded') return '#4488ff';
  if (type === 'kamikaze') return '#ff6622';
  if (type === 'spawner') return C.enemyBig;
  if (type === 'mine') return '#ff8800';
  if (type === 'fuelRock') return '#88aa44';
  return C.enemyBig;
}

// ── Get ship art for a player based on shipType ──
function getPlayerShipArt(player) {
  if (player.id === 1) return SHIP2_ART;
  const ship = SHIPS[player.shipType || 0];
  return ship ? ship.art : SHIPS[0].art;
}

// ── Interpolation ──
function lerpPos(entity, alpha) {
  const px = entity.prevX !== undefined ? entity.prevX : entity.x;
  const py = entity.prevY !== undefined ? entity.prevY : entity.y;
  return [px + (entity.x - px) * alpha, py + (entity.y - py) * alpha];
}

// ── Render the unified grid: ONE pass, every cell ──
function renderGrid() {
  ensureCW();
  ctx.font = GRID_FONT;
  ctx.textBaseline = 'top';
  ctx.shadowBlur = 0;
  let lastColor = '', lastAlpha = -1;

  for (let r = 0; r < gridRows; r++) {
    for (let c = 0; c < gridCols; c++) {
      const cell = grid[r * gridCols + c];
      if (cell.alpha < 0.01 || cell.char === ' ') continue;

      if (cell.color !== lastColor) { ctx.fillStyle = cell.color; lastColor = cell.color; }
      if (cell.alpha !== lastAlpha) { ctx.globalAlpha = cell.alpha; lastAlpha = cell.alpha; }

      // Background chars get scroll offset, entity chars get their sub-pixel offset
      const isBg = (cell.color === BG_COLOR);
      const xOff = isBg ? 0 : cell.ox;
      const yOff = isBg ? bgScrollYPx : cell.oy;
      ctx.fillText(cell.char, gridOffsetX + c * CW + xOff, r * CH + yOff);
    }
  }
  ctx.globalAlpha = 1; ctx.textBaseline = 'alphabetic';
}

// ═══════════════════════════════════════
// PUBLIC API
// ═══════════════════════════════════════

export function renderWorld(world, players, gameTime, uiData) {
  ensureCW();
  const W = width(), H = height();
  const cols = Math.ceil(W / CW) + 1;
  const rows = Math.ceil(H / CH) + 1;
  initGrid(cols, rows);

  const lerp = uiData ? (uiData.lerpAlpha || 1) : 1;
  const difficulty = world.difficulty || 1;

  // 1. Background text (scrolling) - pass difficulty for scroll speed
  fillBackground(gameTime, difficulty);

  // 2. World objects (decorative, behind entities)
  if (world.worldObjects) {
    for (const o of world.worldObjects.objects) {
      stampArt(o.art, o.x, o.y, o.color, o.alpha);
    }
  }

  // 3. All game entities stamped INTO the grid (replacing background chars)

  // WALL bomb effect: render shield wall
  if (world.bombEffect && world.bombEffect.type === 'wall') {
    const wallY = world.bombEffect.y;
    const wallRow = Math.round(wallY / CH);
    const blink = world.bombEffect.timer % 6 < 4 ? 0.9 : 0.6;
    for (let c = 0; c < gridCols; c++) {
      const wallChar = c % 2 === 0 ? '=' : '#';
      setCell(c, wallRow, wallChar, '#44ffaa', blink);
    }
  }

  // Power-ups
  for (const pu of world.powerups) {
    if (!pu.alive) continue;
    const [ix, iy] = lerpPos(pu, lerp);
    const puColor = pu.kind === 'bomb' ? '#ff44ff' : pu.kind === 'fuel' ? '#ffaa22' : C.powerup;
    stampArt(POWERUP_ART[pu.kind] || ['<?>'], ix, iy + Math.sin(pu.bobTime) * 2, puColor, 0.8);
  }

  // Enemies
  for (const e of world.enemies) {
    if (!e.alive) continue;
    const [ix, iy] = lerpPos(e, lerp);
    stampArt(getEnemyArt(e.enemyType, e.animTimer), ix + e.w / 2, iy, getEnemyColor(e.enemyType), 0.95);

    // Health bar for enemies with more than 1 max hp
    if (e.maxHp > 1 && e.hp < e.maxHp) {
      const [gc, gr] = worldToGrid(ix + e.w / 2, iy - 8);
      const barLen = Math.min(5, e.maxHp);
      const filled = Math.ceil((e.hp / e.maxHp) * barLen);
      for (let i = 0; i < barLen; i++) setCell(gc - Math.floor(barLen / 2) + i, gr, i < filled ? '=' : '-', i < filled ? '#44ff44' : '#333333', 0.7);
    }

    // Shield indicator for shielded enemies
    if (e.hasShield && e.shieldHP > 0) {
      const [gc, gr] = worldToGrid(ix + e.w / 2, iy - 4);
      for (let i = 0; i < e.shieldHP; i++) {
        setCell(gc - 1 + i, gr, 'O', '#4488ff', 0.7);
      }
    }
  }

  // Boss (alive or dying)
  if (world.boss) {
    const boss = world.boss;
    const [bx, by] = lerpPos(boss, lerp);
    if (boss.dying) {
      // Flickering death animation - art flashes on and off
      const flash = Math.floor(boss.deathTimer / 4) % 2 === 0;
      if (flash) {
        stampArt(boss.art, bx + boss.w / 2, by, '#ff2222', 0.7);
      }
      stampText('DESTROYED', bx + boss.w / 2, by - 16, '#ffee44', Math.sin(boss.deathTimer * 0.2) * 0.3 + 0.7, 'center');
    } else if (boss.alive) {
      stampArt(boss.art, bx + boss.w / 2, by, '#ff44ff', 0.95);
      const [gc, gr] = worldToGrid(bx + boss.w / 2, by - 12);
      const barW = Math.max(8, Math.floor(boss.w / CW));
      const filled = Math.ceil((boss.hp / boss.maxHp) * barW);
      const bs = gc - Math.floor(barW / 2);
      setCell(bs - 1, gr, '[', '#ff44ff', 0.8);
      setCell(bs + barW, gr, ']', '#ff44ff', 0.8);
      for (let i = 0; i < barW; i++) {
        const hpRatio = boss.hp / boss.maxHp;
        const bc = hpRatio > 0.5 ? '#44ff44' : hpRatio > 0.25 ? '#ffcc00' : '#ff3333';
        setCell(bs + i, gr, i < filled ? '=' : '-', i < filled ? bc : '#333333', 0.8);
      }
      stampText('BOSS', bx + boss.w / 2, by - 24, '#ff44ff', 0.9, 'center');
    }
  }

  // Hazards
  for (const h of world.hazards) {
    if (!h.alive) continue;
    const [hx, hy] = lerpPos(h, lerp);
    stampArt(HAZARD_ART, hx + h.w / 2, hy, Math.floor(h.animTimer * 0.8) % 2 === 0 ? '#ff8800' : '#ff6622', 0.95);
  }

  // Bullets (with sub-pixel offsets)
  for (const b of world.bullets) {
    if (!b.alive) continue;
    const [bx, by] = lerpPos(b, lerp);
    const bgx = (bx - gridOffsetX) / CW;
    const bgy = by / CH;
    const gc = Math.round(bgx), gr = Math.round(bgy);
    const ox = (bgx - gc) * CW, oy = (bgy - gr) * CH;
    if (b.owner === 'player') {
      if (b.isRocket) {
        setCell(gc, gr, '#', '#ffcc44', 0.95, ox, oy);
        setCell(gc, gr + 1, gameTime % 6 < 3 ? '*' : '~', '#ff6622', 0.8, ox, oy);
        setCell(gc, gr + 2, '.', '#ff4400', 0.4, ox, oy);
      } else {
        setCell(gc, gr, '|', '#ffffff', 0.95, ox, oy);
        setCell(gc, gr + 1, '.', '#8888ff', 0.3, ox, oy);
      }
    } else {
      setCell(gc, gr, '!', '#ff4444', 0.95, ox, oy);
      setCell(gc, gr - 1, '.', '#ff2222', 0.3, ox, oy);
    }
  }

  // Particles (with sub-pixel offsets)
  for (const p of particles) {
    const pgx = (p.x - gridOffsetX) / CW;
    const pgy = p.y / CH;
    const gc = Math.round(pgx), gr = Math.round(pgy);
    const ox = (pgx - gc) * CW, oy = (pgy - gr) * CH;
    setCell(gc, gr, p.char, p.color, p.life * 0.85, ox, oy);
  }

  // Players
  for (const p of players) {
    if (!p.alive) continue;
    // VOID bomb makes player invisible (but still controllable)
    if (world.bombEffect && world.bombEffect.type === 'void' && world.bombEffect.playerId === p.id) {
      // Draw semi-transparent ghost
      if (Math.floor(gameTime / 8) % 2 === 0) continue;
    }
    if (p.invincibleTimer > 0 && Math.floor(p.invincibleTimer / 4) % 2 === 0) continue;
    const [px, py] = lerpPos(p, lerp);
    const color = p.id === 0 ? C.player1 : C.player2;
    const art = getPlayerShipArt(p);
    stampArt(art, px + p.w / 2, py, color, 1.0);
    // Compute sub-pixel offsets matching stampArt for consistent alignment
    const pcx = (px + p.w / 2 - gridOffsetX) / CW;
    const pcy = py / CH;
    const sc = Math.round(pcx), sr = Math.round(pcy);
    const pox = (pcx - sc) * CW, poy = (pcy - sr) * CH;
    // Exhaust (center column of art)
    setCell(sc, sr + art.length, gameTime % 4 < 2 ? '*' : '^', '#4488ff', 0.5, pox, poy);
    setCell(sc, sr + art.length + 1, '.', '#2244aa', 0.25, pox, poy);
    if (p.shieldHP > 0) {
      for (let i = 0; i < p.shieldHP; i++) setCell(sc - Math.floor(p.shieldHP / 2) + i, sr - 1, 'O', C.powerup, 0.6, pox, poy);
    }
  }

  // UI (stamped into the grid too)
  if (uiData) {
    const { players: pl, coopMode, world: w, startTimer, gameTime: gt } = uiData;
    stampText(`HP${pl[0].lives} ${pl[0].score}`, 10, 8, C.player1, 0.9, 'left');
    if (coopMode && pl[1]) stampText(`HP${pl[1].lives} ${pl[1].score}`, W - 10, 8, C.player2, 0.9, 'right');
    stampText(`LV${w.difficulty}`, W / 2, 8, C.ui, 0.7, 'center');
    const weaps = [];
    if (pl[0].spreadLevel > 0) weaps.push('SPR' + pl[0].spreadLevel);
    if (pl[0].hasRocket) weaps.push('RKT');
    if (pl[0].rapidLevel > 0) weaps.push('RPD' + pl[0].rapidLevel);
    if (weaps.length) stampText(weaps.join('+'), 10, 24, C.powerup, 0.7, 'left');

    // Bomb count display
    if (pl[0].bombs > 0) {
      stampText(`B:${pl[0].bombs}`, 10, 40, '#ff44ff', 0.8, 'left');
    }

    // Fuel bar
    {
      const fuelRatio = pl[0].fuel / pl[0].maxFuel;
      const barLen = 10;
      const filled = Math.ceil(fuelRatio * barLen);
      let barStr = '';
      for (let i = 0; i < barLen; i++) barStr += i < filled ? '=' : '-';
      const fuelColor = fuelRatio > 0.5 ? '#44ff44' : fuelRatio > 0.25 ? '#ffcc00' : '#ff3333';
      const blinkFuel = fuelRatio < FUEL.warningThreshold && Math.floor(gt / 10) % 2 === 0;
      if (!blinkFuel) {
        stampText(`FUEL [${barStr}]`, 10, 56, fuelColor, 0.8, 'left');
      }
    }

    // Active bomb effect indicator
    if (w.bombEffect) {
      const effectName = w.bombEffect.type.toUpperCase().replace('_', ' ');
      const timer = Math.ceil(w.bombEffect.timer / 60);
      stampText(`${effectName} ${timer}s`, W / 2, 24, '#ff44ff', 0.7, 'center');
    }

    if (startTimer > 0) stampText('GET READY', W / 2, H / 2 - 16, C.title, Math.min(1, startTimer / 20), 'center');
    stampText('VIBE JAM 2026', W - 10, H - 10, C.badge, 0.4, 'right');
    if (uiData.fps) stampText(`${uiData.fps}fps`, W - 10, 8, '#336644', 0.35, 'right');
  }

  // 3. Single render pass
  ctx.save(); renderGrid(); ctx.restore();

  // 4. Screen flash overlay (rendered AFTER the grid)
  if (world.screenFlash > 0) {
    ctx.save();
    ctx.globalAlpha = world.screenFlash / 10 * 0.3;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }

  // 5. Last-life tension: pulsing red vignette when one hit from death
  if (uiData) {
    const p0 = uiData.players[0];
    if (p0 && p0.alive && p0.lives === 1 && p0.shieldHP <= 0) {
      const pulse = (Math.sin(uiData.gameTime * 0.08) + 1) * 0.5; // 0-1
      const alpha = 0.06 + pulse * 0.1;
      const grad = ctx.createRadialGradient(W / 2, H / 2, H * 0.25, W / 2, H / 2, H * 0.7);
      grad.addColorStop(0, 'rgba(0,0,0,0)');
      grad.addColorStop(1, `rgba(255,30,30,${alpha})`);
      ctx.save();
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, W, H);
      ctx.restore();
    }
  }
}

// ── Menu ──
export function renderMenu(menuBob, selectedShip, progress) {
  ensureCW();
  const W = width(), H = height();
  const cols = Math.ceil(W / CW) + 1, rows = Math.ceil(H / CH) + 1;
  initGrid(cols, rows);
  fillBackground(menuBob * 20);

  selectedShip = selectedShip || 0;
  progress = progress || { unlockedShips: [0] };
  const ship = SHIPS[selectedShip];
  const isUnlocked = progress.unlockedShips.includes(selectedShip);

  // ── Title ──
  stampText('=================', W / 2, 10, C.title, 0.3, 'center');
  stampText('R E S C R A M B L E', W / 2, 32, C.title, 1.0, 'center');
  stampText('=================', W / 2, 54, '#ff3355', 0.3, 'center');
  stampText('>> ascii assault <<', W / 2, 72, '#ff3355', 0.5, 'center');

  // ── Divider ──
  stampText('--------------------', W / 2, 104, C.ui, 0.2, 'center');

  // ── Ship selector ──
  const arrowBlink = Math.sin(menuBob * 4) > 0 ? 0.9 : 0.5;
  // Arrows flanking the ship art, centered line
  let artW = 0;
  for (const l of ship.art) if (l.length > artW) artW = l.length;
  const arrowPad = Math.floor(artW / 2) + 3; // chars from center
  const arrowRow = 148;
  stampText('<<', W / 2 - arrowPad * CW, arrowRow, C.player1, arrowBlink, 'center');
  stampText('>>', W / 2 + arrowPad * CW, arrowRow, C.player1, arrowBlink, 'center');

  if (isUnlocked) {
    stampArt(ship.art, W / 2, 128, C.player1, 0.95);
    stampText(ship.name, W / 2, 192, C.player1, 0.8, 'center');
    stampText(ship.ability, W / 2, 210, C.powerup, 0.5, 'center');
    stampText(`BOMB: ${ship.bombName}`, W / 2, 228, '#ff44ff', 0.5, 'center');
  } else {
    stampText('[LOCKED]', W / 2, 148, '#ff3355', 0.7, 'center');
    stampText(ship.name, W / 2, 192, '#554444', 0.5, 'center');
    stampText(ship.unlock, W / 2, 210, '#554444', 0.35, 'center');
  }

  stampText('A/D to switch', W / 2, 250, C.ui, 0.25, 'center');

  // ── Divider ──
  stampText('--------------------', W / 2, 272, C.ui, 0.2, 'center');

  // ── Score table ──
  stampText('\\v/', W / 2 - 60, 296, C.enemySmall, 0.8, 'center');
  stampText('10 pts', W / 2 + 50, 296, C.text, 0.5, 'center');
  stampText('={O}=', W / 2 - 60, 316, C.enemyMed, 0.8, 'center');
  stampText('25 pts', W / 2 + 50, 316, C.text, 0.5, 'center');
  stampText('([===])', W / 2 - 60, 336, C.enemyBig, 0.8, 'center');
  stampText('50 pts', W / 2 + 50, 336, C.text, 0.5, 'center');

  // ── Divider ──
  stampText('--------------------', W / 2, 356, C.ui, 0.2, 'center');

  // ── Start prompt ──
  if (isUnlocked && Math.sin(menuBob * 3) > 0) {
    stampText('>> PRESS ENTER <<', W / 2, 380, C.player1, 0.9, 'center');
  }
  stampText('Press 2 for co-op', W / 2, 404, C.text, 0.3, 'center');

  // ── Bottom ──
  stampText('WASD:Move SPACE:Fire', W / 2, H - 64, C.ui, 0.3, 'center');
  stampText('B:Bomb H:Help', W / 2, H - 48, C.ui, 0.3, 'center');

  ctx.save(); renderGrid(); ctx.restore();
}

export function renderPaused(gameTime) {
  ensureCW();
  const W = width(), H = height();
  const cols = Math.ceil(W / CW) + 1, rows = Math.ceil(H / CH) + 1;
  initGrid(cols, rows);
  fillBackground(gameTime * 0.5);
  stampText('PAUSED', W / 2, H * 0.35, '#00ffcc', 1.0, 'center');
  stampText('ESC to resume', W / 2, H * 0.48, C.ui, 0.6, 'center');
  stampText('H for help', W / 2, H * 0.55, C.ui, 0.5, 'center');
  ctx.save(); renderGrid(); ctx.restore();
}

export function renderGameOver(players, world, gameTime, newUnlocks) {
  ensureCW();
  const W = width(), H = height();
  const cols = Math.ceil(W / CW) + 1, rows = Math.ceil(H / CH) + 1;
  initGrid(cols, rows);
  fillBackground(gameTime * 0.3);
  const total = players.reduce((s, p) => s + p.score, 0);
  stampText('GAME OVER', W / 2, H * 0.25, '#ff3355', 1.0, 'center');
  stampText(`SCORE: ${total}`, W / 2, H * 0.38, C.score, 0.9, 'center');
  stampText(`${world.enemiesKilled} kills LV${world.difficulty}`, W / 2, H * 0.46, C.text, 0.5, 'center');

  // Show newly unlocked ships
  if (newUnlocks && newUnlocks.length > 0) {
    let uy = H * 0.54;
    stampText('NEW UNLOCK!', W / 2, uy, C.powerup, 0.9, 'center');
    uy += 20;
    for (const idx of newUnlocks) {
      const ship = SHIPS[idx];
      if (ship) {
        const blink = Math.sin(gameTime * 0.12) > -0.2 ? 1.0 : 0.5;
        stampText(`>> ${ship.name} <<`, W / 2, uy, '#ffee44', blink, 'center');
        uy += 18;
      }
    }
  }

  if (Math.sin(gameTime * 0.08) > 0) stampText('PRESS ENTER', W / 2, H * 0.72, C.ui, 0.7, 'center');
  ctx.save(); renderGrid(); ctx.restore();
}

export function renderHelp(gameTime, isMuted) {
  ensureCW();
  const W = width(), H = height();
  const cols = Math.ceil(W / CW) + 1, rows = Math.ceil(H / CH) + 1;
  initGrid(cols, rows);
  fillBackground(gameTime * 0.2);

  const L = W / 2 - 80; // left column
  const R = W / 2 + 30;  // right column
  let y = 10;

  stampText('HOW TO PLAY', W / 2, y, C.title, 1.0, 'center');
  y += 28;

  // Controls - two columns
  stampText('CONTROLS', W / 2, y, C.ui, 0.6, 'center'); y += 18;
  stampText('Move', L, y, C.text, 0.4, 'left');
  stampText('WASD/Arrows', R, y, C.text, 0.5, 'left'); y += 16;
  stampText('Fire', L, y, C.text, 0.4, 'left');
  stampText('SPACE', R, y, C.text, 0.5, 'left'); y += 16;
  stampText('Bomb', L, y, C.text, 0.4, 'left');
  stampText('B', R, y, C.text, 0.5, 'left'); y += 16;
  stampText('Pause', L, y, C.text, 0.4, 'left');
  stampText('ESC', R, y, C.text, 0.5, 'left'); y += 16;
  stampText('Mute', L, y, C.text, 0.4, 'left');
  stampText('M', R, y, C.text, 0.5, 'left');
  y += 22;

  // Enemies - art on left, info on right
  stampText('ENEMIES', W / 2, y, C.ui, 0.6, 'center'); y += 18;

  stampText('\\v/', L + 10, y, C.enemySmall, 0.7, 'left');
  stampText('Small   1HP  10pt', R - 20, y, C.enemySmall, 0.45, 'left'); y += 16;

  stampText('={O}=', L, y, C.enemyMed, 0.7, 'left');
  stampText('Medium  3HP  25pt', R - 20, y, C.enemyMed, 0.45, 'left'); y += 16;

  stampText('([===])', L - 5, y, C.enemyBig, 0.7, 'left');
  stampText('Big     6HP  50pt', R - 20, y, C.enemyBig, 0.45, 'left'); y += 16;

  stampText('={=}=', L, y, '#4488ff', 0.7, 'left');
  stampText('Shield  4HP  40pt', R - 20, y, '#4488ff', 0.45, 'left'); y += 16;

  stampText('\\!/', L + 10, y, '#ff6622', 0.7, 'left');
  stampText('Kamikaze     15pt', R - 20, y, '#ff6622', 0.45, 'left'); y += 16;

  stampText('{===}', L, y, C.enemyBig, 0.7, 'left');
  stampText('Spawner 8HP  75pt', R - 20, y, C.enemyBig, 0.45, 'left'); y += 16;

  stampText('(*)', L + 10, y, '#ff8800', 0.7, 'left');
  stampText('Mine    prox  5pt', R - 20, y, '#ff8800', 0.45, 'left');
  y += 22;

  // Boss
  stampText('BOSS', W / 2, y, '#ff44ff', 0.6, 'center'); y += 18;
  stampText('Every 10 LVs', W / 2, y, '#ff44ff', 0.35, 'center'); y += 14;
  stampText('Bigger at LV20, LV30+', W / 2, y, '#ff44ff', 0.35, 'center');
  y += 22;

  // Power-ups - grid layout
  stampText('POWER-UPS', W / 2, y, C.ui, 0.6, 'center'); y += 18;
  stampText('<3> Spread', L, y, C.powerup, 0.45, 'left');
  stampText('<S> Speed', R, y, C.powerup, 0.45, 'left'); y += 16;
  stampText('<O> Shield', L, y, C.powerup, 0.45, 'left');
  stampText('<R> Rocket', R, y, C.powerup, 0.45, 'left'); y += 16;
  stampText('<F> Rapid', L, y, C.powerup, 0.45, 'left');
  stampText('<B> Bomb', R, y, C.powerup, 0.45, 'left'); y += 16;
  stampText('+F+ Fuel', L, y, '#ffaa22', 0.45, 'left');
  y += 22;

  // Tips
  stampText('TIPS', W / 2, y, C.ui, 0.6, 'center'); y += 18;
  stampText('Weapons stack!', W / 2, y, C.text, 0.35, 'center'); y += 14;
  stampText('Rockets have AOE', W / 2, y, C.text, 0.35, 'center'); y += 14;
  stampText('Hazards strip all buffs', W / 2, y, '#ff8800', 0.35, 'center');
  y += 22;

  // Sound + back
  stampText(isMuted ? 'M:Unmute' : 'M:Mute', W / 2, y, C.ui, 0.4, 'center'); y += 18;
  stampText('ESC to go back', W / 2, y, C.ui, 0.5, 'center');

  ctx.save(); renderGrid(); ctx.restore();
}
