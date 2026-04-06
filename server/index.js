const crypto = require('crypto');
const express = require('express');
const { insertScore, getTopScores, isDuplicate } = require('./db');

const app = express();

// ── Request size limit ──
app.use(express.json({ limit: '1kb' }));

// ── Trust proxy (behind nginx) ──
app.set('trust proxy', 1);

// ── Origin check ──
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || 'https://rescramble.app').split(',');

function checkOrigin(req, res, next) {
  const origin = req.get('origin') || req.get('referer') || '';
  // Allow in development (no origin = same-origin request)
  if (!origin || ALLOWED_ORIGINS.some(o => origin.startsWith(o))) {
    return next();
  }
  return res.status(403).json({ error: 'Forbidden' });
}

// ── Rate limiting (in-memory, per IP) ──
const submitLog = new Map();
const RATE_WINDOW = 30_000;
const RATE_MAX = 2;

function rateLimit(req, res, next) {
  const ip = req.ip;
  const now = Date.now();
  const timestamps = (submitLog.get(ip) || []).filter(t => now - t < RATE_WINDOW);

  if (timestamps.length >= RATE_MAX) {
    return res.status(429).json({ error: 'Too many submissions, try again later' });
  }

  timestamps.push(now);
  submitLog.set(ip, timestamps);
  next();
}

setInterval(() => {
  const now = Date.now();
  for (const [ip, timestamps] of submitLog) {
    const valid = timestamps.filter(t => now - t < RATE_WINDOW);
    if (valid.length === 0) submitLog.delete(ip);
    else submitLog.set(ip, valid);
  }
}, 300_000);

// ── Session tokens ──
// Single-use tokens issued when a game starts, consumed on score submit.
const activeTokens = new Map(); // token -> { ip, createdAt }
const TOKEN_RATE_WINDOW = 10_000; // 10s between token requests per IP
const tokenRequestLog = new Map();

function generateToken() {
  return crypto.randomBytes(24).toString('base64url');
}

// Cleanup stale tokens every 30 minutes (tokens with no expiry can accumulate
// from games that were abandoned without submitting)
setInterval(() => {
  const staleThreshold = Date.now() - 3_600_000; // 1 hour
  for (const [token, data] of activeTokens) {
    if (data.createdAt < staleThreshold) activeTokens.delete(token);
  }
}, 1_800_000);

// ── Sanity bounds ──
const MAX_SCORE = 999_999;
const MAX_LEVEL = 100;
const MAX_KILLS = 50_000;
const VALID_SHIPS = ['SCOUT', 'FALCON', 'FORTRESS', 'STRIKER', 'PHANTOM'];
const NAME_REGEX = /^[a-zA-Z0-9 _\-.]+$/;

function sanitizeName(raw) {
  if (!raw || typeof raw !== 'string') return null;
  const clean = raw.replace(/[\x00-\x1f\x7f]/g, '').trim().slice(0, 12);
  if (clean.length < 1 || !NAME_REGEX.test(clean)) return null;
  return clean;
}

// ── POST /api/token — Request a session token when game starts ──
app.post('/api/token', checkOrigin, (req, res) => {
  const ip = req.ip;
  const now = Date.now();

  // Rate limit token requests
  const lastRequest = tokenRequestLog.get(ip) || 0;
  if (now - lastRequest < TOKEN_RATE_WINDOW) {
    return res.status(429).json({ error: 'Too many requests' });
  }
  tokenRequestLog.set(ip, now);

  const token = generateToken();
  activeTokens.set(token, { ip, createdAt: now });

  res.json({ token });
});

// ── GET /api/scores ──
app.get('/api/scores', (req, res) => {
  const scores = getTopScores(20);
  res.json(scores);
});

// ── POST /api/scores ──
app.post('/api/scores', checkOrigin, rateLimit, (req, res) => {
  const { name, score, level, kills, ship, token } = req.body;

  // Validate token
  if (!token || typeof token !== 'string') {
    return res.status(401).json({ error: 'Token required' });
  }

  const tokenData = activeTokens.get(token);
  if (!tokenData) {
    return res.status(401).json({ error: 'Invalid or already used token' });
  }

  // Token must come from the same IP that requested it
  if (tokenData.ip !== req.ip) {
    return res.status(401).json({ error: 'Token mismatch' });
  }

  // Consume the token (single-use)
  activeTokens.delete(token);

  // Validate name
  const cleanName = sanitizeName(name);
  if (!cleanName) {
    return res.status(400).json({ error: 'Invalid name' });
  }

  // Validate score
  if (typeof score !== 'number' || !Number.isInteger(score) || score < 0 || score > MAX_SCORE) {
    return res.status(400).json({ error: 'Invalid score' });
  }

  // Validate level
  const cleanLevel = (typeof level === 'number' && Number.isInteger(level) && level >= 0 && level <= MAX_LEVEL)
    ? level : 0;

  // Validate kills
  const cleanKills = (typeof kills === 'number' && Number.isInteger(kills) && kills >= 0 && kills <= MAX_KILLS)
    ? kills : 0;

  // Validate ship
  const cleanShip = (typeof ship === 'string' && VALID_SHIPS.includes(ship)) ? ship : '';

  // Consistency check
  if (cleanLevel > 1 && cleanKills > 0) {
    const maxPlausibleKills = cleanLevel * 100;
    if (cleanKills > maxPlausibleKills) {
      return res.status(400).json({ error: 'Invalid score data' });
    }
  }

  // Duplicate check
  if (isDuplicate(cleanName, score)) {
    return res.status(409).json({ error: 'Duplicate submission' });
  }

  const id = insertScore(cleanName, score, cleanLevel, cleanKills, cleanShip);
  res.status(201).json({ id, name: cleanName, score });
});

// ── 404 ──
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Rescramble API listening on port ${PORT}`);
});
