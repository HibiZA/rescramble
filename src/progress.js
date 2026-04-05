import { SHIPS } from './entities.js';
// ── Progress Tracking (localStorage) ──

const STORAGE_KEY = 'vibetext-progress';

function defaultProgress() {
  return {
    highScore: 0,
    maxDifficulty: 0,
    totalKills: 0,
    unlockedShips: [0],
  };
}

export function loadProgress() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultProgress();
    const data = JSON.parse(raw);
    // Validate / fill missing fields
    const def = defaultProgress();
    if (typeof data.highScore !== 'number') data.highScore = def.highScore;
    if (typeof data.maxDifficulty !== 'number') data.maxDifficulty = def.maxDifficulty;
    if (typeof data.totalKills !== 'number') data.totalKills = def.totalKills;
    if (!Array.isArray(data.unlockedShips) || data.unlockedShips.length === 0) {
      data.unlockedShips = def.unlockedShips;
    }
    // Ship 0 must always be unlocked
    if (!data.unlockedShips.includes(0)) data.unlockedShips.unshift(0);
    return data;
  } catch (e) {
    return defaultProgress();
  }
}

function saveProgress(data) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (e) {
    // Storage full or unavailable - silently fail
  }
}

function checkUnlocks(progress) {
  const newlyUnlocked = [];
  // Use unlockCheck functions from gameconfig via SHIPS
  for (let i = 1; i < SHIPS.length; i++) {
    if (!progress.unlockedShips.includes(i) && SHIPS[i].unlockCheck(progress)) {
      newlyUnlocked.push(i);
    }
  }
  return newlyUnlocked;
}

export function updateProgress(players, world) {
  const progress = loadProgress();

  // Update high score (total across all players)
  const totalScore = players.reduce((s, p) => s + p.score, 0);
  if (totalScore > progress.highScore) progress.highScore = totalScore;

  // Update max difficulty reached
  if (world.difficulty > progress.maxDifficulty) progress.maxDifficulty = world.difficulty;

  // Update total kills (cumulative across all games)
  progress.totalKills += world.enemiesKilled;

  // Check for newly unlocked ships
  const newUnlocks = checkUnlocks(progress);
  for (const idx of newUnlocks) {
    if (!progress.unlockedShips.includes(idx)) {
      progress.unlockedShips.push(idx);
    }
  }

  saveProgress(progress);
  return { progress, newUnlocks };
}
