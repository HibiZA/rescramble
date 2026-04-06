// ── Leaderboard API client ──

let cachedScores = null;
let lastFetch = 0;
let sessionToken = null;

export async function requestToken() {
  try {
    const res = await fetch('/api/token', { method: 'POST' });
    if (!res.ok) return;
    const data = await res.json();
    sessionToken = data.token;
  } catch (e) {
    sessionToken = null;
  }
}

export async function submitScore(name, score, level, kills, ship) {
  if (!sessionToken) return null;
  try {
    const res = await fetch('/api/scores', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, score, level, kills, ship, token: sessionToken }),
    });
    // Token is consumed regardless of outcome
    sessionToken = null;
    if (!res.ok) return null;
    cachedScores = null;
    return await res.json();
  } catch (e) {
    sessionToken = null;
    return null;
  }
}

export async function fetchScores() {
  if (cachedScores && Date.now() - lastFetch < 5000) return cachedScores;
  try {
    const res = await fetch('/api/scores');
    if (!res.ok) return cachedScores || [];
    cachedScores = await res.json();
    lastFetch = Date.now();
    return cachedScores;
  } catch (e) {
    return cachedScores || [];
  }
}
