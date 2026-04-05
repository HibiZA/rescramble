import { C } from './constants.js';

export let particles = [];

const CHARS = ['*', '+', '.', '~', '^', '#', '@', '!', ':', '\u2726'];

export function spawnParticles(x, y, _z, color, count = 8, spread = 3) {
  for (let i = 0; i < count; i++) {
    particles.push({
      x, y,
      vx: (Math.random() - 0.5) * spread * 2,
      vy: -Math.random() * spread * 2 - 1,  // burst upward
      life: 1,
      decay: 0.015 + Math.random() * 0.025,
      char: CHARS[Math.random() * CHARS.length | 0],
      color: color || C.particle[Math.random() * C.particle.length | 0],
    });
  }
}

export function updateParticles() {
  let write = 0;
  for (let i = 0; i < particles.length; i++) {
    const p = particles[i];
    p.x += p.vx;
    p.y += p.vy;
    p.vy += 0.1;
    p.life -= p.decay;
    if (p.life > 0) particles[write++] = p;
  }
  particles.length = write;
}
