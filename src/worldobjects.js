// ═══════════════════════════════════════════════════════
// WORLD OBJECTS - decorative drifting space objects
// Purely visual, no collision. Adds variety as you progress.
// ═══════════════════════════════════════════════════════

import { WORLD_W, WORLD_H } from './constants.js';

// ── Object art by type ──
const OBJECTS = {
  asteroid: {
    arts: [
      ['  __', ' /  \\', '|    |', ' \\__/'],
      [' _', '/ \\', '\\_/'],
      ['  ___', ' / o \\', '|     |', ' \\___/'],
    ],
    color: '#3a3530',
    alpha: 0.25,
    speedMin: 0.3,
    speedMax: 0.8,
    unlocksAt: 1,
  },
  nebula: {
    arts: [
      ['  . * .', ' * . * .', '. . * . *', ' * . * .', '  . * .'],
      [' .::', '::..:', ' .::.'],
    ],
    color: '#2a2244',
    alpha: 0.12,
    speedMin: 0.1,
    speedMax: 0.3,
    unlocksAt: 3,
  },
  satellite: {
    arts: [
      ['[=|=]'],
      ['--[o]--'],
      ['+--+', '|<>|', '+--+'],
    ],
    color: '#445566',
    alpha: 0.2,
    speedMin: 0.5,
    speedMax: 1.0,
    unlocksAt: 5,
  },
  station: {
    arts: [
      ['  |=|', '=[===]=', '  |=|', '=[===]=', '  |=|'],
      ['[--+--]', '|  O  |', '[--+--]'],
    ],
    color: '#334455',
    alpha: 0.18,
    speedMin: 0.15,
    speedMax: 0.35,
    unlocksAt: 8,
  },
  comet: {
    arts: [
      ['    *', '  **', ' **', '****...'],
      ['  *', ' **..', '***....'],
    ],
    color: '#445588',
    alpha: 0.2,
    speedMin: 1.5,
    speedMax: 3.0,
    unlocksAt: 4,
  },
  wreckage: {
    arts: [
      ['/==\\', '|xx|', '\\==/'],
      ['#//', ' ##', '//'],
    ],
    color: '#443333',
    alpha: 0.15,
    speedMin: 0.2,
    speedMax: 0.6,
    unlocksAt: 10,
  },
  planet: {
    arts: [
      ['   ____', '  /    \\', ' | (  ) |', ' |      |', '  \\____/'],
      ['  __', ' /  \\', '|    |', ' \\__/'],
    ],
    color: '#2a3344',
    alpha: 0.1,
    speedMin: 0.05,
    speedMax: 0.15,
    unlocksAt: 6,
  },
  constellation: {
    arts: [
      ['*   *', ' \\ /', '  *', ' / \\', '*   *'],
      ['*--*', '|  |', '*--*'],
      ['  *', ' /|\\', '* | *', ' \\|/', '  *'],
    ],
    color: '#334466',
    alpha: 0.08,
    speedMin: 0.02,
    speedMax: 0.08,
    unlocksAt: 2,
  },
};

const OBJECT_TYPES = Object.keys(OBJECTS);

// ── World object state ──
export function createWorldObjects() {
  return {
    objects: [],
    spawnTimer: 0,
  };
}

export function updateWorldObjects(state, difficulty) {
  // Spawn timer
  state.spawnTimer--;
  if (state.spawnTimer <= 0) {
    // Spawn rate: every 200-400 frames, faster at higher difficulty
    state.spawnTimer = 200 + Math.random() * 200 - difficulty * 3;
    if (state.spawnTimer < 60) state.spawnTimer = 60;

    // Pick a random type that's unlocked at current difficulty
    const available = OBJECT_TYPES.filter(t => OBJECTS[t].unlocksAt <= difficulty);
    if (available.length > 0) {
      const typeName = available[Math.random() * available.length | 0];
      const obj = OBJECTS[typeName];
      const art = obj.arts[Math.random() * obj.arts.length | 0];
      const x = 20 + Math.random() * (WORLD_W - 40);

      state.objects.push({
        art,
        x,
        y: -art.length * 16 - 10,
        speed: obj.speedMin + Math.random() * (obj.speedMax - obj.speedMin),
        color: obj.color,
        alpha: obj.alpha + Math.random() * 0.05,
        type: typeName,
      });
    }
  }

  // Update positions
  for (let i = state.objects.length - 1; i >= 0; i--) {
    const o = state.objects[i];
    o.y += o.speed;
    // Remove when off screen
    if (o.y > WORLD_H + 60) {
      state.objects.splice(i, 1);
    }
  }
}

// Max objects on screen to avoid clutter
export function cleanupWorldObjects(state) {
  if (state.objects.length > 8) {
    state.objects.splice(0, state.objects.length - 8);
  }
}
