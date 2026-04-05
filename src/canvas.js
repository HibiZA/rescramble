// ── Canvas Setup ──
// Fixed game resolution, centered on screen with letterboxing.

import { WORLD_W, WORLD_H } from './constants.js';

export const canvas = document.getElementById('c');
export const ctx = canvas.getContext('2d');

let _scale = 1;
let _offsetX = 0;
let _offsetY = 0;

export function resize() {
  const dpr = window.devicePixelRatio || 1;
  const winW = window.innerWidth;
  const winH = window.innerHeight;

  // Scale to fit while maintaining aspect ratio
  _scale = Math.min(winW / WORLD_W, winH / WORLD_H);
  _offsetX = (winW - WORLD_W * _scale) / 2;
  _offsetY = (winH - WORLD_H * _scale) / 2;

  canvas.width = winW * dpr;
  canvas.height = winH * dpr;
  canvas.style.width = winW + 'px';
  canvas.style.height = winH + 'px';

  // Transform: DPR scale, then center + game scale
  ctx.setTransform(
    dpr * _scale, 0,
    0, dpr * _scale,
    _offsetX * dpr, _offsetY * dpr
  );
}

resize();
window.addEventListener('resize', resize);

// Always returns fixed game dimensions
export function width() { return WORLD_W; }
export function height() { return WORLD_H; }
