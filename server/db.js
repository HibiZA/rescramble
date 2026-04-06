const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = path.join(process.env.DB_DIR || '/app/data', 'scores.db');
const db = new Database(DB_PATH);

// WAL mode for better concurrent read performance
db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS scores (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    score INTEGER NOT NULL,
    level INTEGER NOT NULL DEFAULT 0,
    kills INTEGER NOT NULL DEFAULT 0,
    ship TEXT NOT NULL DEFAULT '',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  CREATE INDEX IF NOT EXISTS idx_scores_score ON scores(score DESC);
  CREATE INDEX IF NOT EXISTS idx_scores_recent ON scores(name, score, created_at);
`);

const insertStmt = db.prepare(
  'INSERT INTO scores (name, score, level, kills, ship) VALUES (?, ?, ?, ?, ?)'
);

const topStmt = db.prepare(
  'SELECT name, score, level, kills, ship, created_at FROM scores ORDER BY score DESC LIMIT ?'
);

const dupeStmt = db.prepare(
  `SELECT COUNT(*) as cnt FROM scores
   WHERE name = ? AND score = ? AND created_at > datetime('now', '-60 seconds')`
);

function insertScore(name, score, level, kills, ship) {
  const info = insertStmt.run(name, score, level, kills, ship);
  return info.lastInsertRowid;
}

function getTopScores(limit = 20) {
  return topStmt.all(limit);
}

function isDuplicate(name, score) {
  const row = dupeStmt.get(name, score);
  return row.cnt > 0;
}

module.exports = { insertScore, getTopScores, isDuplicate };
