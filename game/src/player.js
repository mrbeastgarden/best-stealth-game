// Coldwire — the player: smooth tile movement, running noise, gadgets.
// The player walks with keys or toward a mouse click; holding Shift runs,
// which is faster but loud — every step sends a noise pulse guards can hear.
// Gadgets: C throws a coin ahead (guards investigate the clink), Q pops a
// smoke cloud at the player's feet (blinds nearby cones).

import {
  PLAYER_WALK,
  PLAYER_RUN,
  NOISE_PULSE_EVERY,
  COINS_PER_LEVEL,
  SMOKE_PER_LEVEL,
} from './config.js';

export class Player {
  constructor(world) {
    this.world = world;
    this.x = world.playerStart.x;
    this.y = world.playerStart.y;
    this.radius = 0.3; // tiles, for wall collision
    this.facing = 0;
    this.moving = false;
    this.running = false;
    this.clickTarget = null; // {x, y} in tile units, or null
    this.noiseTimer = 0;
    this.stepTimer = 0; // drives the footstep sound
    this.hasRelic = false;
    this.emitNoise = false; // set for one frame when a run pulse goes out
    this.noisePulses = []; // {x, y, age} rings the renderer draws
    // Gadgets refresh every level: a fresh pouch of coins and smoke, and
    // the loot count starts over for the new heist.
    this.coins = COINS_PER_LEVEL;
    this.smoke = SMOKE_PER_LEVEL;
    this.lootTaken = 0;
  }

  reset(world) {
    this.world = world;
    this.x = world.playerStart.x;
    this.y = world.playerStart.y;
    this.facing = 0;
    this.moving = false;
    this.running = false;
    this.clickTarget = null;
    this.noiseTimer = 0;
    this.stepTimer = 0;
    this.hasRelic = false;
    this.emitNoise = false;
    this.noisePulses = [];
    this.coins = COINS_PER_LEVEL;
    this.smoke = SMOKE_PER_LEVEL;
    this.lootTaken = 0;
  }

  // Spend one coin; false when the pouch is empty.
  useCoin() {
    if (this.coins <= 0) return false;
    this.coins -= 1;
    return true;
  }

  // Spend one smoke; false when the pouch is empty.
  useSmoke() {
    if (this.smoke <= 0) return false;
    this.smoke -= 1;
    return true;
  }

  // keys: {up, down, left, right, run} — true while held.
  update(dt, keys) {
    let dx = 0;
    let dy = 0;
    if (keys.up) dy -= 1;
    if (keys.down) dy += 1;
    if (keys.left) dx -= 1;
    if (keys.right) dx += 1;

    if (dx === 0 && dy === 0 && this.clickTarget) {
      const tx = this.clickTarget.x - this.x;
      const ty = this.clickTarget.y - this.y;
      const d = Math.hypot(tx, ty);
      if (d < 0.12) {
        this.clickTarget = null;
      } else {
        dx = tx / d;
        dy = ty / d;
      }
    }

    this.moving = dx !== 0 || dy !== 0;
    this.running = this.moving && keys.run;
    const speed = this.running ? PLAYER_RUN : PLAYER_WALK;

    if (this.moving) {
      const len = Math.hypot(dx, dy);
      const nx = this.x + (dx / len) * speed * dt;
      const ny = this.y + (dy / len) * speed * dt;
      const slid = this.world.slideCircle(this.x, this.y, nx, ny, this.radius);
      this.x = slid.x;
      this.y = slid.y;
      this.facing = Math.atan2(dy, dx);
      this.stepTimer += dt;
    } else {
      this.stepTimer = 0;
    }

    // Running is loud: a pulse every NOISE_PULSE_EVERY seconds.
    if (this.running) {
      this.noiseTimer -= dt;
      if (this.noiseTimer <= 0) {
        this.noiseTimer = NOISE_PULSE_EVERY;
        this.noisePulses.push({ x: this.x, y: this.y, age: 0 });
        this.emitNoise = true;
      }
    }
    for (const p of this.noisePulses) p.age += dt;
    this.noisePulses = this.noisePulses.filter((p) => p.age < 0.8);
  }

  // A footstep happened when stepTimer crosses a step interval.
  stepped(stepInterval) {
    if (!this.moving) return false;
    return this.stepTimer >= stepInterval;
  }

  consumeStep(stepInterval) {
    this.stepTimer -= stepInterval;
  }

  inShadow() {
    return this.world.isShadow(Math.floor(this.x), Math.floor(this.y));
  }

  atRelic() {
    const r = this.world.relic;
    return Math.hypot(this.x - r.x, this.y - r.y) < 0.6;
  }

  atExit() {
    const e = this.world.exit;
    return Math.hypot(this.x - e.x, this.y - e.y) < 0.6;
  }
}
