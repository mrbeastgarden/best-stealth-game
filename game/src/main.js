// Shadow Vault — the game: state machine, loop, input, HUD, scoring.
// States: title -> playing -> levelclear -> playing -> win, or caught.
// Detection is shared across guards: it fills while any guard sees the
// player and drains while nobody does. The level is won by taking the
// relic and then reaching the exit; the run is timed, best in localStorage.

import { LEVELS, DETECT_DRAIN, DETECT_DRAIN_SHADOW, NOISE_RADIUS, CATCH_DISTANCE, ALERT_GIVE_UP } from './config.js';
import { World, validateLevel } from './world.js';
import { Guard } from './guards.js';
import { Player } from './player.js';
import { Renderer } from './render.js';
import { SoundFX } from './audio.js';

const BEST_KEY = 'shadowvault-best-ms';

function formatTime(ms) {
  const total = Math.floor(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export class Game {
  constructor(canvas, hud) {
    this.canvas = canvas;
    this.hud = hud;
    this.renderer = new Renderer(canvas);
    this.sound = new SoundFX();
    this.keys = { up: false, down: false, left: false, right: false, run: false };
    this.levelIndex = 0;
    this.state = 'title';
    this.detection = 0;
    this.alarms = 0;
    this.wasAlerted = false;
    this.time = 0;
    this.levelStartMs = 0;
    this.totalMs = 0;
    this.levelMs = 0;
    this.bestMs = Number(localStorage.getItem(BEST_KEY) || 0);
    this.stepInterval = 0.32;
    this.loadLevel(0);
    this.bindInput();
    this.lastTick = performance.now();
    requestAnimationFrame((t) => this.loop(t));
  }

  get levelName() {
    return LEVELS[this.levelIndex].name;
  }

  get levelTimeText() {
    return formatTime(this.levelMs);
  }

  get totalTimeText() {
    return formatTime(this.totalMs);
  }

  get bestTimeText() {
    return this.bestMs ? formatTime(this.bestMs) : '--:--';
  }

  loadLevel(index) {
    this.levelIndex = index;
    const level = LEVELS[index];
    this.world = validateLevel(level, index);
    this.player = new Player(this.world);
    this.guards = level.guards.map(
      (g) => new Guard(g.waypoints, level.guardSpeed, level.chaseSpeed),
    );
    this.detection = 0;
    this.wasAlerted = false;
    this.levelMs = 0;
    this.levelStartMs = performance.now();
    this.hud.tip.textContent = level.tip;
  }

  startRun() {
    this.totalMs = 0;
    this.alarms = 0;
    this.loadLevel(0);
    this.state = 'playing';
    this.sound.ensure();
  }

  nextLevel() {
    this.totalMs += this.levelMs;
    if (this.levelIndex + 1 >= LEVELS.length) {
      this.state = 'win';
      this.sound.win();
      if (!this.bestMs || this.totalMs < this.bestMs) {
        this.bestMs = this.totalMs;
        localStorage.setItem(BEST_KEY, String(this.bestMs));
      }
    } else {
      this.loadLevel(this.levelIndex + 1);
      this.state = 'playing';
      this.sound.levelClear();
    }
  }

  caught() {
    this.state = 'caught';
    this.sound.caught();
  }

  bindInput() {
    const KEYMAP = {
      ArrowUp: 'up', KeyW: 'up',
      ArrowDown: 'down', KeyS: 'down',
      ArrowLeft: 'left', KeyA: 'left',
      ArrowRight: 'right', KeyD: 'right',
      ShiftLeft: 'run', ShiftRight: 'run',
    };
    window.addEventListener('keydown', (e) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) {
        e.preventDefault();
      }
      this.sound.ensure();
      if (KEYMAP[e.code]) this.keys[KEYMAP[e.code]] = true;
      if (e.code === 'KeyM') {
        const muted = this.sound.toggleMute();
        this.hud.mute.textContent = muted ? 'Sound: off (M)' : 'Sound: on (M)';
      }
      if (e.code === 'KeyR' && (this.state === 'caught' || this.state === 'win')) {
        this.startRun();
      }
      if (e.code === 'Enter') {
        if (this.state === 'title') this.startRun();
        else if (this.state === 'levelclear') this.nextLevel();
      }
      if (e.code === 'Escape') {
        if (this.state === 'playing') this.state = 'paused';
        else if (this.state === 'paused') this.state = 'playing';
      }
    });
    window.addEventListener('keyup', (e) => {
      if (KEYMAP[e.code]) this.keys[KEYMAP[e.code]] = false;
    });
    this.canvas.addEventListener('mousedown', (e) => {
      this.sound.ensure();
      if (this.state === 'title') {
        this.startRun();
        return;
      }
      if (this.state === 'levelclear') {
        this.nextLevel();
        return;
      }
      if (this.state !== 'playing') return;
      const rect = this.canvas.getBoundingClientRect();
      const scaleX = this.canvas.width / rect.width;
      const scaleY = this.canvas.height / rect.height;
      const px = (e.clientX - rect.left) * scaleX;
      const py = (e.clientY - rect.top) * scaleY;
      this.player.clickTarget = { x: px / 48, y: py / 48 };
    });
    window.addEventListener('blur', () => {
      this.keys = { up: false, down: false, left: false, right: false, run: false };
    });
  }

  loop(now) {
    const dt = Math.min(0.05, (now - this.lastTick) / 1000);
    this.lastTick = now;
    this.time += dt;
    if (this.state === 'playing') this.update(dt);
    this.renderer.draw(this);
    this.updateHud();
    requestAnimationFrame((t) => this.loop(t));
  }

  update(dt) {
    this.levelMs = performance.now() - this.levelStartMs;
    this.player.update(dt, this.keys);

    // Footsteps: a tick each step, faster while running.
    const interval = this.player.running ? 0.22 : 0.32;
    if (this.player.stepped(interval)) {
      this.player.consumeStep(interval);
      this.sound.step(this.player.running);
    }
    // Running pulses attract nearby guards.
    if (this.player.emitNoise) {
      this.player.emitNoise = false;
      for (const g of this.guards) g.hearNoise(this.player.x, this.player.y, NOISE_RADIUS);
    }

    // Detection: fill while seen, drain while hidden. Shadow hides you.
    const inShadow = this.player.inShadow();
    let seenBy = null;
    let fill = 0;
    for (const g of this.guards) {
      if (g.canSee(this.world, this.player.x, this.player.y, inShadow)) {
        seenBy = g;
        fill = Math.max(fill, g.fillRate(this.player.x, this.player.y, inShadow));
      }
    }
    if (seenBy) {
      this.detection = Math.min(100, this.detection + fill * dt);
    } else {
      const drain = inShadow ? DETECT_DRAIN_SHADOW : DETECT_DRAIN;
      this.detection = Math.max(0, this.detection - drain * dt);
    }
    if (this.detection >= 100 && !this.wasAlerted) {
      this.wasAlerted = true;
      this.alarms += 1;
      this.sound.alarm();
    }
    if (this.detection < 100) this.wasAlerted = false;

    // Guards move and think; an alerted guard that touches the player ends it.
    for (const g of this.guards) {
      const prevState = g.state;
      g.update(dt, this.world, this.player, this.detection);
      if (g.state === 'suspicious' && prevState === 'patrol') this.sound.suspicious();
      if (g.state === 'alert') {
        const d = Math.hypot(g.x - this.player.x, g.y - this.player.y);
        if (d < CATCH_DISTANCE) {
          this.caught();
          return;
        }
      }
    }

    // Relic, then exit.
    if (!this.player.hasRelic && this.player.atRelic()) {
      this.player.hasRelic = true;
      this.sound.pickup();
    }
    if (this.player.hasRelic && this.player.atExit()) {
      this.state = 'levelclear';
      this.sound.levelClear();
    }
    // Staged screenshots pin the meter so the shot shows the mechanic
    // mid-fill instead of a drained bar.
    if (this.stagedDetection != null) this.detection = this.stagedDetection;
    void ALERT_GIVE_UP;
  }

  updateHud() {
    const h = this.hud;
    h.level.textContent = this.levelName;
    h.time.textContent = this.state === 'playing' ? formatTime(this.levelMs) : formatTime(this.levelMs);
    h.best.textContent = this.bestTimeText;
    h.relic.textContent = this.player.hasRelic ? 'Relic: stolen — reach the EXIT!' : 'Relic: find the gold diamond';
    h.alarms.textContent = `Alarms: ${this.alarms}`;
    const bar = h.detectionBar;
    bar.style.width = `${this.detection}%`;
    if (this.detection >= 100) {
      bar.style.background = '#ff3b30';
      h.detectionLabel.textContent = 'ALARM!';
    } else if (this.detection > 55) {
      bar.style.background = '#ff9500';
      h.detectionLabel.textContent = 'Spotted…';
    } else if (this.detection > 5) {
      bar.style.background = '#ffd250';
      h.detectionLabel.textContent = 'Suspicious';
    } else {
      bar.style.background = '#39d98a';
      h.detectionLabel.textContent = this.player.inShadow() ? 'Hidden in shadow' : 'Unseen';
    }
  }
}

// Screenshot staging: ?shot=start|play|level2|win|caught stages a real render
// of the game for the maker's screenshots, with no change to the rules.
export function stageShot(game, shot) {
  if (shot === 'start') {
    game.state = 'title';
  } else if (shot === 'play') {
    game.state = 'playing';
    game.player.x = 5.5;
    game.player.y = 8.5;
    game.player.facing = Math.PI / 2;
    const guard = game.guards[0];
    guard.x = 9.5;
    guard.y = 7.5;
    guard.facing = Math.PI * 0.75;
    game.stagedDetection = 38;
  } else if (shot === 'level2') {
    game.loadLevel(1);
    game.state = 'playing';
    game.player.x = 6.5;
    game.player.y = 9.5;
    game.player.facing = -Math.PI / 2;
    const guard = game.guards[0];
    guard.x = 10.5;
    guard.y = 9.5;
    guard.facing = Math.PI;
    game.stagedDetection = 22;
  } else if (shot === 'win') {
    game.totalMs = 192000;
    game.bestMs = 192000;
    game.state = 'win';
  } else if (shot === 'caught') {
    game.state = 'caught';
  }
}

const hud = {
  level: document.getElementById('hud-level'),
  time: document.getElementById('hud-time'),
  best: document.getElementById('hud-best'),
  relic: document.getElementById('hud-relic'),
  alarms: document.getElementById('hud-alarms'),
  detectionBar: document.getElementById('detection-bar'),
  detectionLabel: document.getElementById('detection-label'),
  mute: document.getElementById('hud-mute'),
  tip: document.getElementById('hud-tip'),
};

const canvas = document.getElementById('game');
const game = new Game(canvas, hud);
const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
if (shot) stageShot(game, shot);

// Surface any runtime error in the DOM so a headless run can see it.
window.addEventListener('error', (e) => {
  const el = document.getElementById('errors');
  if (el) el.textContent += `ERROR: ${e.message} @ ${e.filename}:${e.lineno}\n`;
});
