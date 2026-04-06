import { canvas, ctx, width, height, screenToGame } from './canvas.js';
import { C } from './constants.js';
import { keys, touch } from './input.js';
import { spawnParticles, updateParticles } from './particles.js';
import { createPlayer, SHIPS } from './entities.js';
import { createWorld, spawnEnemies } from './level.js';
import { updatePlayer, updateEnemies, updateBullets, updateBoss, updateHazards, resetPhysicsState, updateWorldTimers } from './physics.js';
import { updateWorldObjects, cleanupWorldObjects } from './worldobjects.js';
import { loadProgress, updateProgress } from './progress.js';
import * as renderer from './renderer.js';
import { sfxMenuSelect, resumeAudio, startMusic, stopMusic, setMusicIntensity, toggleMute, isMuted } from './audio.js';
import { submitScore, fetchScores, requestToken } from './leaderboard.js';

let state = 'menu';
let prevState = 'menu'; // track where help was opened from
let coopMode = false;
let players = [];
let world = {};
let screenShake = 0;
let gameTime = 0;
let menuBob = 0;
let transitionAlpha = 0;
let transitionDir = 0;
let startTimer = 0;
let gameOverTimer = -1;
let fps = 0, fpsFrames = 0, fpsLast = performance.now();
const TICK_RATE = 1000 / 60; // fixed 60hz physics
let accumulator = 0;
let lastFrameTime = performance.now();
let slowMo = 1.0; // slow-motion factor (1.0 = normal, <1 = slow)

let escWasDown = false;
let hWasDown = false;
let mWasDown = false;
let helpPage = 0;
const HELP_PAGES = 3;
let helpLeftWas = false;
let helpRightWas = false;

// Ship selection state
let selectedShip = 0;
let progress = loadProgress();
let lastNewUnlocks = [];

// Ship select input edge detection
let leftWasDown = false;
let rightWasDown = false;
let enterWasDown = false;

// Leaderboard state
let nameInput = '';
let nameSubmitted = false;
let leaderboardScores = [];
let leaderboardFetched = false;
let menuScores = [];

// Fetch leaderboard for menu on load
fetchScores().then(scores => { menuScores = scores || []; });

// GitHub link click handler (help screen)
canvas.addEventListener('click', (e) => {
  if (state !== 'help') return;
  const H = height();
  const { x, y } = screenToGame(e.clientX, e.clientY);
  // GitHub link region: centered, near bottom (H - 46)
  if (y > H - 56 && y < H - 36 && x > 80 && x < 400) {
    window.open('https://github.com/HibiZA/rescramble', '_blank');
  }
});

// Capture text input for name entry
window.addEventListener('keydown', (e) => {
  if (state !== 'gameover' || nameSubmitted) return;
  if (e.key === 'Backspace') {
    nameInput = nameInput.slice(0, -1);
    e.preventDefault();
  } else if (e.key.length === 1 && nameInput.length < 12) {
    // Allow alphanumeric, spaces, and common symbols
    if (/[a-zA-Z0-9 _\-.]/.test(e.key)) {
      nameInput += e.key;
    }
  }
});

function startGame(coop, shipType) {
  resetPhysicsState();
  requestToken(); // get session token for leaderboard
  coopMode = coop;
  players = [createPlayer(0, 220, 560, shipType || 0)];
  if (coop) players.push(createPlayer(1, 260, 560, 0));
  world = createWorld();
  gameOverTimer = -1;
  slowMo = 1.0;
  transitionAlpha = 1;
  transitionDir = -1;
  startTimer = 60;
}

function gameLoop() {
  const now = performance.now();
  const frameDt = now - lastFrameTime;
  lastFrameTime = now;
  accumulator += Math.min(frameDt, 100) * slowMo; // cap to avoid spiral of death

  // FPS counter
  fpsFrames++;
  if (now - fpsLast >= 1000) {
    fps = fpsFrames;
    fpsFrames = 0;
    fpsLast = now;
  }

  // Edge detection for Escape, H, and R keys
  const escPressed = keys['Escape'] && !escWasDown;
  escWasDown = !!keys['Escape'];
  const hPressed = keys['KeyH'] && !hWasDown;
  hWasDown = !!keys['KeyH'];
  const mPressed = keys['KeyM'] && !mWasDown;
  mWasDown = !!keys['KeyM'];
  if (mPressed) toggleMute();

  const enterPressed = keys['Enter'] && !enterWasDown;
  enterWasDown = !!keys['Enter'];

  // Fixed timestep: run physics at 60hz regardless of display refresh rate
  while (accumulator >= TICK_RATE) {
    accumulator -= TICK_RATE;
    gameTime++;

    // Save previous positions for interpolation
    if (state === 'playing') {
      for (const p of players) { p.prevX = p.x; p.prevY = p.y; }
      for (const e of world.enemies) { e.prevX = e.x; e.prevY = e.y; }
      for (const b of world.bullets) { b.prevX = b.x; b.prevY = b.y; }
      for (const h of world.hazards) { h.prevX = h.x; h.prevY = h.y; }
      for (const pu of world.powerups) { pu.prevX = pu.x; pu.prevY = pu.y; }
      if (world.boss) { world.boss.prevX = world.boss.x; world.boss.prevY = world.boss.y; }
    }

    // Physics tick (only when playing)
    if (state === 'playing') {
      // Hit-stop: freeze frames on big impacts
      if (world.hitStop > 0) {
        world.hitStop--;
        continue; // skip this physics tick entirely
      }

      if (startTimer > 0) startTimer--;
      spawnEnemies(world);
      for (const p of players) updatePlayer(p, world, coopMode);
      updateEnemies(world, players);
      updateBoss(world, players);
      const bs = updateBullets(world, players);
      if (bs > screenShake) screenShake = bs;
      updateWorldTimers(world);
      const hs = updateHazards(world, players);
      if (hs > screenShake) screenShake = hs;
      updateWorldObjects(world.worldObjects, world.difficulty);
      cleanupWorldObjects(world.worldObjects);
      updateParticles();

      if (players.every(p => !p.alive)) {
        if (gameOverTimer < 0) {
          gameOverTimer = 48;
          slowMo = 0.2;
          world.bombSlowMo = 0; // death overrides bomb slow-mo
        }
      }

      // Bomb slow-mo: only runs when not in death sequence
      if (gameOverTimer < 0 && world.bombSlowMo > 0) {
        world.bombSlowMo--;
        slowMo = 0.4;
        if (world.bombSlowMo <= 0) slowMo = 1.0;
      }

      if (gameOverTimer > 0) {
        gameOverTimer--;
        slowMo = Math.min(1.0, slowMo + 0.015);
      }
      if (gameOverTimer === 0) {
        state = 'gameover';
        gameOverTimer = -1;
        slowMo = 1.0;
        stopMusic();
        const result = updateProgress(players, world);
        progress = result.progress;
        lastNewUnlocks = result.newUnlocks;
      }
    } else if (state === 'menu') {
      menuBob += 0.02;
      updateParticles();
    } else {
      updateParticles();
    }
  }

  const W = width(), H = height();

  // Clear: reset transform for full canvas clear, then restore
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.restore();

  ctx.fillStyle = C.bg;
  ctx.fillRect(0, 0, W, H);

  switch (state) {
    case 'menu':
      renderer.renderMenu(menuBob, selectedShip, progress, menuScores);
      // Ship switching with A/D or left/right
      {
        const leftPressed = (keys['KeyA'] || keys['ArrowLeft']) && !leftWasDown;
        leftWasDown = !!(keys['KeyA'] || keys['ArrowLeft']);
        const rightPressed = (keys['KeyD'] || keys['ArrowRight']) && !rightWasDown;
        rightWasDown = !!(keys['KeyD'] || keys['ArrowRight']);

        if (leftPressed) {
          selectedShip--;
          if (selectedShip < 0) selectedShip = SHIPS.length - 1;
          sfxMenuSelect();
        }
        if (rightPressed) {
          selectedShip++;
          if (selectedShip >= SHIPS.length) selectedShip = 0;
          sfxMenuSelect();
        }
      }
      // Start game
      if (enterPressed || touch.jump) {
        if (progress.unlockedShips.includes(selectedShip)) {
          resumeAudio();
          startMusic();
          sfxMenuSelect();
          setMusicIntensity(1);
          startGame(false, selectedShip);
          state = 'playing';
        }
        keys['Enter'] = false;
        touch.jump = false;
      }
      if (keys['Digit2'] || keys['Numpad2']) {
        if (progress.unlockedShips.includes(selectedShip)) {
          resumeAudio();
          startMusic();
          sfxMenuSelect();
          setMusicIntensity(1);
          startGame(true, selectedShip);
          state = 'playing';
        }
        keys['Digit2'] = false;
      }
      if (hPressed) { prevState = 'menu'; state = 'help'; helpPage = 0; }
      break;

    case 'playing': {
      let shakeX = 0, shakeY = 0;
      if (screenShake > 0) {
        shakeX = (Math.random() - 0.5) * screenShake * 2;
        shakeY = (Math.random() - 0.5) * screenShake * 2;
        screenShake *= 0.88;
        if (screenShake < 0.5) screenShake = 0;
      }

      ctx.save();
      ctx.translate(shakeX, shakeY);
      const lerpAlpha = accumulator / TICK_RATE; // 0-1: how far into the next tick
      renderer.renderWorld(world, players, gameTime, { players, coopMode, world, startTimer, gameTime, fps, lerpAlpha });
      ctx.restore();

      // Pause
      if (escPressed) { state = 'paused'; }
      break;
    }

    case 'paused':
      renderer.renderPaused(gameTime);
      if (escPressed) { state = 'playing'; }
      if (hPressed) { prevState = 'paused'; state = 'help'; helpPage = 0; }
      break;

    case 'help': {
      renderer.renderHelp(gameTime, isMuted(), helpPage, HELP_PAGES);
      if (escPressed) { state = prevState; helpPage = 0; }
      // Page navigation with own edge detection
      const hlDown = !!(keys['KeyA'] || keys['ArrowLeft']);
      const hrDown = !!(keys['KeyD'] || keys['ArrowRight']);
      if (hrDown && !helpRightWas && helpPage < HELP_PAGES - 1) {
        helpPage++;
        sfxMenuSelect();
      }
      if (hlDown && !helpLeftWas && helpPage > 0) {
        helpPage--;
        sfxMenuSelect();
      }
      helpLeftWas = hlDown;
      helpRightWas = hrDown;
      break;
    }

    case 'gameover':
      if (!nameSubmitted) {
        // Name entry phase
        renderer.renderGameOver(players, world, gameTime, lastNewUnlocks, nameInput, null);
        if (enterPressed || touch.jump) {
          keys['Enter'] = false;
          touch.jump = false;
          if (nameInput.trim().length > 0) {
            sfxMenuSelect();
            nameSubmitted = true;
            const total = players.reduce((s, p) => s + p.score, 0);
            const shipName = SHIPS[players[0].shipType || 0]?.name || 'SCOUT';
            submitScore(nameInput.trim(), total, world.difficulty, world.enemiesKilled, shipName)
              .then(() => fetchScores())
              .then(scores => { leaderboardScores = scores || []; })
              .catch(() => { leaderboardScores = []; })
              .finally(() => { leaderboardFetched = true; });
          }
        }
      } else {
        // Leaderboard phase
        renderer.renderGameOver(players, world, gameTime, lastNewUnlocks, nameInput, leaderboardScores);
        if (enterPressed || touch.jump) {
          sfxMenuSelect();
          state = 'menu';
          keys['Enter'] = false;
          touch.jump = false;
          lastNewUnlocks = [];
          nameInput = '';
          nameSubmitted = false;
          fetchScores().then(scores => { menuScores = scores || []; });
          leaderboardScores = [];
          leaderboardFetched = false;
        }
      }
      break;
  }

  if (transitionAlpha > 0 && transitionDir < 0) {
    transitionAlpha -= 0.03;
    ctx.save();
    ctx.globalAlpha = Math.max(0, transitionAlpha);
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }

  requestAnimationFrame(gameLoop);
}

document.fonts.ready.then(() => {
  gameLoop();
});
