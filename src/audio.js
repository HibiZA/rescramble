const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

let muted = false;
export function isMuted() { return muted; }
export function toggleMute() {
  muted = !muted;
  if (muted) {
    if (musicNodes) musicNodes.masterGain.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 0.3);
  } else {
    if (musicNodes) musicNodes.masterGain.gain.linearRampToValueAtTime(MUSIC_VOLUME, audioCtx.currentTime + 0.3);
  }
  return muted;
}

function play(freq, duration, type = 'square', volume = 0.1) {
  if (muted) return;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  gain.gain.value = volume;
  gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  osc.start();
  osc.stop(audioCtx.currentTime + duration);
}

// ── Sound design notes ──
// 200-400Hz: warm, comfortable range (cello, human voice fundamentals)
// 1-4kHz: ear is most sensitive here - use sparingly and quietly
// <200Hz: felt more than heard, good for impacts and weight
// Sine: pure, gentle. Triangle: slightly richer. Square/saw: harsh, use low volume
// Short durations (<50ms) feel like clicks. 100-300ms feels like impacts.

// Shoot: soft low "pew" - 350Hz is warm and non-fatiguing
let lastShootTime = 0;
export function sfxShoot() {
  const now = audioCtx.currentTime;
  if (now - lastShootTime < 0.12) return;
  lastShootTime = now;
  play(350, 0.03, 'triangle', 0.02);
}

// Rocket: deep thud with falling pitch
export function sfxRocket() {
  if (muted) return;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(180, audioCtx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(60, audioCtx.currentTime + 0.15);
  gain.gain.setValueAtTime(0.06, audioCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.15);
  osc.connect(gain); gain.connect(audioCtx.destination);
  osc.start(); osc.stop(audioCtx.currentTime + 0.15);
}

// Hit: barely audible soft tap
export function sfxHit() { play(250, 0.02, 'sine', 0.015); }

// Explosion: quiet low thump, throttled
let lastExpTime = 0;
export function sfxExplosion() {
  const now = audioCtx.currentTime;
  if (now - lastExpTime < 0.08) return;
  lastExpTime = now;
  play(55, 0.12, 'triangle', 0.04);
}

// Player hit: dissonant low buzz (urgent but not painful)
export function sfxPlayerHit() { play(120, 0.18, 'sawtooth', 0.09); }

// Powerup: pleasant rising two-tone in the 300-500Hz range
export function sfxPowerup() {
  play(330, 0.08, 'sine', 0.05);
  setTimeout(() => play(440, 0.08, 'sine', 0.04), 60);
}

// Bomb: deep sub-bass sweep
export function sfxBomb() {
  if (muted) return;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(80, audioCtx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(30, audioCtx.currentTime + 0.4);
  gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.4);
  osc.connect(gain); gain.connect(audioCtx.destination);
  osc.start(); osc.stop(audioCtx.currentTime + 0.4);
}

// Boss warning: two low pulses
export function sfxBossWarning() {
  play(160, 0.15, 'square', 0.06);
  setTimeout(() => play(160, 0.15, 'square', 0.06), 200);
}

// Fuel warning: low periodic beep - urgent but not grating
let lastFuelWarnTime = 0;
export function sfxFuelWarning() {
  const now = audioCtx.currentTime;
  if (now - lastFuelWarnTime < 0.4) return;
  lastFuelWarnTime = now;
  play(90, 0.12, 'square', 0.05);
  setTimeout(() => play(80, 0.08, 'square', 0.03), 120);
}

// Fuel pickup: satisfying rising refuel sound
export function sfxFuelPickup() {
  if (muted) return;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(200, audioCtx.currentTime);
  osc.frequency.linearRampToValueAtTime(500, audioCtx.currentTime + 0.15);
  gain.gain.setValueAtTime(0.06, audioCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.2);
  osc.connect(gain); gain.connect(audioCtx.destination);
  osc.start(); osc.stop(audioCtx.currentTime + 0.2);
  // Second tone for richness
  setTimeout(() => play(600, 0.06, 'sine', 0.04), 100);
}

// Menu: gentle click at 440Hz (A4, musical reference pitch - feels natural)
export function sfxMenuSelect() { play(440, 0.03, 'sine', 0.03); }

// ═══════════════════════════════════════════════════════
// AMBIENT MUSIC - generative space drone
// Layered sine oscillators at harmonic intervals that
// slowly shift pitch, creating an evolving ambient pad.
// Pentatonic-ish intervals for pleasant consonance.
// ═══════════════════════════════════════════════════════

let musicNodes = null;
let musicPlaying = false;
const MUSIC_VOLUME = 0.025; // very subtle background

// Base notes (Hz) - Am pentatonic spread across octaves for spacey feel
const DRONE_FREQS = [55, 82.5, 110, 165, 220]; // A1, E2, A2, E3, A3

export function startMusic() {
  if (musicPlaying) return;
  musicPlaying = true;

  const masterGain = audioCtx.createGain();
  masterGain.gain.value = 0;
  masterGain.gain.linearRampToValueAtTime(MUSIC_VOLUME, audioCtx.currentTime + 3); // fade in
  masterGain.connect(audioCtx.destination);

  const oscs = [];
  const gains = [];

  for (let i = 0; i < DRONE_FREQS.length; i++) {
    const osc = audioCtx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = DRONE_FREQS[i];

    // Slow pitch drift: each oscillator wobbles ±2-5% over 20-40 seconds
    const driftAmount = DRONE_FREQS[i] * (0.02 + Math.random() * 0.03);
    const driftPeriod = 20 + Math.random() * 20;
    scheduleDrift(osc, DRONE_FREQS[i], driftAmount, driftPeriod);

    const gain = audioCtx.createGain();
    // Lower voices louder, higher voices softer
    gain.gain.value = i === 0 ? 1.0 : i === 1 ? 0.7 : i === 2 ? 0.5 : i === 3 ? 0.3 : 0.2;

    // Slow volume swell per voice
    scheduleVolumeBreath(gain, gain.gain.value, 15 + Math.random() * 15);

    osc.connect(gain);
    gain.connect(masterGain);
    osc.start();
    oscs.push(osc);
    gains.push(gain);
  }

  musicNodes = { masterGain, oscs, gains };
}

function scheduleDrift(osc, baseFreq, amount, period) {
  // Create continuous pitch drift using setValueAtTime in a loop
  const steps = 20;
  const t = audioCtx.currentTime;
  for (let s = 0; s < steps * 4; s++) { // ~4 full cycles
    const time = t + (s / steps) * period;
    const phase = (s / steps) * Math.PI * 2;
    osc.frequency.setValueAtTime(baseFreq + Math.sin(phase) * amount, time);
  }
  // After initial schedule, re-schedule periodically
  const reSchedule = () => {
    if (!musicPlaying) return;
    const now = audioCtx.currentTime;
    for (let s = 0; s < steps; s++) {
      const time = now + (s / steps) * period;
      const phase = ((now / period) + s / steps) * Math.PI * 2;
      osc.frequency.setValueAtTime(baseFreq + Math.sin(phase) * amount, time);
    }
    setTimeout(reSchedule, period * 500); // re-schedule halfway through
  };
  setTimeout(reSchedule, period * 2000);
}

function scheduleVolumeBreath(gain, baseVol, period) {
  const breathe = () => {
    if (!musicPlaying) return;
    const now = audioCtx.currentTime;
    const low = baseVol * 0.4;
    gain.gain.setValueAtTime(gain.gain.value, now);
    gain.gain.linearRampToValueAtTime(low, now + period / 2);
    gain.gain.linearRampToValueAtTime(baseVol, now + period);
    setTimeout(breathe, period * 1000);
  };
  setTimeout(breathe, Math.random() * 5000); // stagger start
}

export function stopMusic() {
  if (!musicPlaying || !musicNodes) return;
  musicPlaying = false;
  const { masterGain, oscs } = musicNodes;
  // Fade out over 2 seconds
  masterGain.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 2);
  setTimeout(() => {
    for (const osc of oscs) { try { osc.stop(); } catch(e) {} }
    musicNodes = null;
  }, 2500);
}

// Intensity: subtly shift the music based on game state
export function setMusicIntensity(level) {
  // level 0 = menu (calm), 1 = playing, 2 = boss fight
  if (!musicNodes) return;
  const targetVol = level === 0 ? MUSIC_VOLUME * 0.6
    : level === 2 ? MUSIC_VOLUME * 1.5
    : MUSIC_VOLUME;
  musicNodes.masterGain.gain.linearRampToValueAtTime(targetVol, audioCtx.currentTime + 1);
}

// Resume audio context on first user interaction
let resumed = false;
export function resumeAudio() {
  if (!resumed && audioCtx.state === 'suspended') {
    audioCtx.resume();
    resumed = true;
  }
}
