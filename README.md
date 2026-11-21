# Shadow Vault — a stealth game

[![make.fun · best-stealth-game-20261121-1759](https://make.fun/badge/best-stealth-game-20261121-1759.svg)](https://make.fun/bounty/best-stealth-game-20261121-1759?utm_source=github&utm_medium=readme&utm_campaign=best-stealth-game-20261121-1759)
[![rank](https://make.fun/badge/best-stealth-game-20261121-1759/mrbeastgarden/best-stealth-game/rank.svg)](https://make.fun/bounty/best-stealth-game-20261121-1759/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-stealth-game-20261121-1759)
[![reward](https://make.fun/badge/best-stealth-game-20261121-1759/mrbeastgarden/best-stealth-game/reward.svg)](https://make.fun/bounty/best-stealth-game-20261121-1759?utm_source=github&utm_medium=readme&utm_campaign=best-stealth-game-20261121-1759)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

A complete, original top-down stealth game that plays offline in a desktop
browser from static files. You are Wren, a night thief in the Blackwood
Museum: steal the gold relic, reach the green exit — unseen.

## How it plays

- **3 levels** — The Gallery, The Vault Wing, The Inner Vault — with more
  guards and faster patrols as you go.
- **Guards on waypoint patrols** with vision cones. Line of sight is blocked
  by walls, exactly like movement, so cover works the way it looks.
- **Detection meter** — it fills while a guard sees you (faster up close,
  slower at range, slower still in shadow) and drains while you are hidden.
  A full meter raises the alarm; an alerted guard chases, and if it catches
  you, you are caught.
- **Shadow tiles** hide you: a guard's effective range shrinks and its
  detection fill halves while you stand in the dark.
- **Noise** — hold Shift to run, but running is loud: every step sends a
  pulse guards nearby come to investigate.
- **Footsteps** — WebAudio footsteps, an alarm sting, a pickup chime; M mutes.
- **Mouse too** — click anywhere to walk there; WASD / arrows to move,
  R to restart, Esc to pause. Best total time in localStorage.

## Levels

| Level | Guards | Patrol speed | Tip |
| --- | --- | --- | --- |
| The Gallery | 2 | 1.5 tiles/s | Cross behind the patrols, in the dark tiles. |
| The Vault Wing | 3 | 1.8 tiles/s | Wait for the gap, then run the corridor. |
| The Inner Vault | 4 | 2.1 tiles/s | The exit guard walks the vault door — time it. |

## Play it

```sh
node serve.ts
# open http://localhost:8080
```

No build step, no network request, no library: plain `game/index.html`
plus ES modules under `game/src/`.

## Files

| File | Job |
| --- | --- |
| `game/index.html` | Page shell, HUD, canvas |
| `game/src/config.js` | Level maps, guard patrols, tuning |
| `game/src/world.js` | Grid, walls, line of sight, reachability |
| `game/src/guards.js` | Patrol, vision cones, detection, alarm |
| `game/src/player.js` | Movement, running noise, relic |
| `game/src/audio.js` | Synthesized WebAudio sounds |
| `game/src/render.js` | All canvas drawing |
| `game/src/main.js` | Game loop, states, input, HUD |
| `main.ts` | Hand-in: copies the game and writes the dossier |

Built for the [best stealth game bounty](https://make.fun/c/best-stealth-game-20261121-1759) on make.fun.
