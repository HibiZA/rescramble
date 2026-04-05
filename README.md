# RESCRAMBLE

A vertical space shooter rendered entirely in ASCII text on HTML5 Canvas, inspired by *Scramble* (1981) — the Konami arcade classic that had you weaving through caves, dodging missiles, and managing fuel. Rescramble takes that core loop — survive, shoot, don't run out of fuel — and reimagines it as a roguelike with ship progression, boss fights, and escalating chaos.

A game doesn't need fancy graphics to be satisfying. No 3D models, no sprite sheets, no asset pipeline. Just monospace characters on a black screen, a handful of colors, and tight mechanics. The satisfaction comes from the loop: dodge, shoot, collect, survive one more wave. That's what made the original Scramble work on 1981 hardware, and it's what makes this work now.

## How to Play

**Move:** `WASD` or `Arrow Keys`
**Shoot:** `Space` or `Enter`
**Bomb:** `B` (ship-specific special ability)
**Pause:** `Escape`
**Help:** `H`
**Mute:** `M`
**Co-op:** `2` (from the menu)

Touch controls are supported on mobile — left side of the screen for movement, right side to fire.

### The Rules

- Enemies come in waves that get harder over time
- Killing enemies gives you score and restores fuel
- Fuel drains constantly — if it hits zero, you're done
- Powerups drop every ~20 kills: spread shot, rapid fire, rockets, shields, speed boost, bombs
- A boss shows up every 10 difficulty levels
- Your high score, max difficulty, and total kills persist between sessions

## Ships

You start with the **Scout**. New ships unlock as you hit milestones:

| Ship | Unlock | Ability |
|------|--------|---------|
| **Scout** | Default | EMP Blast — clears bullets, damages nearby enemies |
| **Falcon** | Score 5,000+ | 50% faster movement, Sonic Dash bomb |
| **Fortress** | Reach Difficulty 15 | Extra shields, slower speed, deployable shield wall |
| **Striker** | 500+ total kills | Starts with spread + rapid fire, Mega Burst bomb |
| **Phantom** | Reach Difficulty 25 | 2x invincibility duration, Void freeze bomb |

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
docker build -t rescramble .
docker run -p 80:80 rescramble
```

Multi-stage build: Node for bundling, Nginx for serving.

## Tech

- Vanilla JavaScript (ES6 modules)
- HTML5 Canvas (2D context, monospace text grid rendering)
- Web Audio API (procedural sound — no audio files)
- localStorage for progression
- esbuild for bundling
- Nginx + Docker for deployment
