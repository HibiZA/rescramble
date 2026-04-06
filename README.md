# RESCRAMBLE

A vertical space shooter rendered entirely in ASCII text on HTML5 Canvas, inspired by *Scramble* (1981) — the Konami arcade classic that had you weaving through caves, dodging missiles, and managing fuel. Rescramble takes that core loop — survive, shoot, don't run out of fuel — and reimagines it as a roguelike with ship progression, boss fights, and escalating chaos.

A game doesn't need fancy graphics to be satisfying. No 3D models, no sprite sheets, no asset pipeline. Just monospace characters on a black screen, a handful of colors, and tight mechanics. The satisfaction comes from the loop: dodge, shoot, collect, survive one more wave. That's what made the original Scramble work on 1981 hardware, and it's what makes this work now.

## How to Play

**Move:** `WASD` or `Arrow Keys`
**Shoot:** `Space` or `Enter`
**Ability:** `B` (ship-specific special)
**Pause:** `Escape`
**Help:** `H`
**Mute:** `M`
**Co-op:** `2` (from the menu)

Touch controls are supported on mobile — left side of the screen for movement, right side to fire.

### The Rules

- Enemies come in waves that get harder over time
- Killing enemies gives you score and restores fuel
- Fuel drains constantly and faster each level — if it hits zero, you're done
- Powerups drop from kills: spread, rapid, rockets, shields, speed, ability charges
- Spread and rapid fire level up with each pickup (up to LV3 and LV2)
- A boss shows up every 10 difficulty levels
- Hazards strip all your upgrades on contact
- Your high score, max difficulty, and total kills persist between sessions
- Online leaderboard tracks the top scores

## Ships

Each ship plays differently. You start with the **Scout** and unlock the rest by hitting milestones.

| Ship | Passive | Ability | Unlock |
|------|---------|---------|--------|
| **Scout** | -20% fuel burn | EMP Blast — clears bullets, damages all enemies | Default |
| **Falcon** | +50% speed, kills grant speed burst | Sonic Dash — invincible dash that damages on contact | Score 5,000+ |
| **Fortress** | +1 bullet damage, +2 shields, slower | Wall — shield row blocks bullets for 5s | Reach LV15 |
| **Striker** | Starts with Spread 2 + Rapid 1, only 2 lives | Mega Burst — 20 bullets in all directions | 500+ total kills |
| **Phantom** | Kills pause fuel drain for 0.5s | Void — freeze all enemies for 3s | Reach LV25 |

## Running Locally

```bash
npm install
npm run dev
```

Opens a local dev server. The game runs in the browser.

## Building for Production

```bash
npm run build
```

Bundles and minifies `src/main.js` into `dist/game.js` via esbuild.

## Docker

```bash
docker-compose up -d --build
```

Three containers:
- **rescramble** — Nginx serving the static game
- **backend** — Node/Express API with SQLite leaderboard
- **caddy** — Reverse proxy with auto-HTTPS

The backend stores scores in a persistent Docker volume. Nginx proxies `/api/` to the backend container.

## Tech

- Vanilla JavaScript (ES6 modules)
- HTML5 Canvas (2D context, monospace text grid rendering)
- Web Audio API (procedural sound — no audio files)
- Node.js + Express + better-sqlite3 (leaderboard API)
- localStorage for local progression
- esbuild for bundling
- Nginx + Caddy + Docker for deployment
