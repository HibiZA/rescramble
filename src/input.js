import { canvas } from './canvas.js';

// ── Keyboard ──
export const keys = {};
const GAME_KEYS = new Set([
  'KeyA','KeyD','KeyW','KeyS','Space','Enter','Escape','KeyH','KeyB','KeyM',
  'ArrowLeft','ArrowRight','ArrowUp','ArrowDown',
  'Digit1','Digit2','Numpad1','Numpad2','ShiftRight',
]);
function onDown(e) {
  keys[e.code] = true;
  if (GAME_KEYS.has(e.code)) e.preventDefault();
}
function onUp(e) {
  keys[e.code] = false;
}
window.addEventListener('keydown', onDown);
window.addEventListener('keyup', onUp);
canvas.setAttribute('tabindex', '0');
canvas.focus();
canvas.addEventListener('click', () => canvas.focus());

// ── Touch ──
export const touch = {
  left: false, right: false, up: false, down: false,
  jump: false, active: false,
};

function updateTouch(tl) {
  touch.left = touch.right = touch.up = touch.down = touch.jump = false;
  const dw = window.innerWidth;
  const dh = window.innerHeight;
  for (let i = 0; i < tl.length; i++) {
    const tx = tl[i].clientX;
    const ty = tl[i].clientY;
    if (tx < dw * 0.4) {
      const cx = dw * 0.15, cy = dh * 0.75;
      const dx = tx - cx, dy = ty - cy;
      if (Math.abs(dx) > 20) { if (dx < 0) touch.left = true; else touch.right = true; }
      if (Math.abs(dy) > 20) { if (dy < 0) touch.up = true; else touch.down = true; }
    } else if (tx > dw * 0.6) {
      touch.jump = true;
    }
  }
}

canvas.addEventListener('touchstart', e => {
  e.preventDefault(); updateTouch(e.touches); touch.active = true;
}, { passive: false });

canvas.addEventListener('touchmove', e => {
  e.preventDefault(); updateTouch(e.touches);
}, { passive: false });

canvas.addEventListener('touchend', e => {
  e.preventDefault(); updateTouch(e.touches);
  if (e.touches.length === 0) {
    touch.left = touch.right = touch.up = touch.down = touch.jump = false;
    touch.active = false;
  }
}, { passive: false });
