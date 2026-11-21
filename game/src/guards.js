// Shadow Vault — guards: waypoint patrols, vision cones, detection, alarm.
// A guard's state machine: patrol -> suspicious (investigate a noise or a
// glimpse) -> alert (chase the player) -> search -> patrol. Detection is a
// shared 0..100 meter: it fills while any guard sees the player and drains
// while nobody does, so the player always has a chance to recover.

import {
  VISION_RANGE,
  VISION_HALF_ANGLE,
  SHADOW_RANGE,
  SHADOW_FILL_FACTOR,
  DETECT_FILL_NEAR,
  DETECT_FILL_FAR,
  ALERT_GIVE_UP,
} from './config.js';

function angleTo(x0, y0, x1, y1) {
  return Math.atan2(y1 - y0, x1 - x0);
}

function angleDiff(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= 2 * Math.PI;
  while (d < -Math.PI) d += 2 * Math.PI;
  return d;
}

function dist(x0, y0, x1, y1) {
  return Math.hypot(x1 - x0, y1 - y0);
}

export class Guard {
  constructor(waypoints, patrolSpeed, chaseSpeed) {
    this.waypoints = waypoints.map(([x, y]) => ({ x: x + 0.5, y: y + 0.5 }));
    this.x = this.waypoints[0].x;
    this.y = this.waypoints[0].y;
    this.patrolSpeed = patrolSpeed;
    this.chaseSpeed = chaseSpeed;
    this.targetIndex = 1 % this.waypoints.length;
    this.facing = 0;
    this.state = 'patrol'; // patrol | suspicious | alert | search
    this.stateTime = 0;
    this.lastSeen = null; // {x, y} of the player when last spotted
    this.suspicion = 0; // 0..1, how sure this guard is something is there
    this.investigatePoint = null;
    this.searchTime = 0;
    this.pauseTime = 0; // brief halt at each waypoint, so patrols read
  }

  // Does this guard see the player right now? Range, cone angle and a
  // wall-blocked line of sight must all agree. Shadow shortens the range.
  canSee(world, px, py, playerInShadow) {
    const d = dist(this.x, this.y, px, py);
    const range = playerInShadow ? SHADOW_RANGE : VISION_RANGE;
    if (d > range) return false;
    const toPlayer = angleTo(this.x, this.y, px, py);
    if (Math.abs(angleDiff(toPlayer, this.facing)) > VISION_HALF_ANGLE) return false;
    return world.hasLineOfSight(this.x, this.y, px, py);
  }

  // Detection fill this guard contributes per second while it sees the
  // player: near and in the open fills fast; far or in shadow fills slow.
  fillRate(px, py, playerInShadow) {
    const d = dist(this.x, this.y, px, py);
    const range = playerInShadow ? SHADOW_RANGE : VISION_RANGE;
    const t = Math.max(0, Math.min(1, d / range));
    let rate = DETECT_FILL_NEAR + (DETECT_FILL_FAR - DETECT_FILL_NEAR) * t;
    if (playerInShadow) rate *= SHADOW_FILL_FACTOR;
    return rate;
  }

  // A noise pulse at (nx, ny): guards close enough walk over to look.
  hearNoise(nx, ny, radius) {
    if (this.state === 'alert') return;
    if (dist(this.x, this.y, nx, ny) > radius) return;
    this.state = 'suspicious';
    this.stateTime = 0;
    this.investigatePoint = { x: nx, y: ny };
    this.suspicion = Math.max(this.suspicion, 0.6);
  }

  update(dt, world, player, detection) {
    this.stateTime += dt;
    const d = dist(this.x, this.y, player.x, player.y);
    const playerInShadow = world.isShadow(Math.floor(player.x), Math.floor(player.y));
    const sees = this.canSee(world, player.x, player.y, playerInShadow);

    if (sees) {
      this.lastSeen = { x: player.x, y: player.y };
      this.suspicion = 1;
      if (detection >= 100) {
        this.state = 'alert';
        this.stateTime = 0;
      } else if (this.state === 'patrol') {
        this.state = 'suspicious';
        this.stateTime = 0;
      }
    }

    switch (this.state) {
      case 'patrol':
        this.patrolStep(dt);
        break;
      case 'suspicious': {
        const target = this.investigatePoint ?? this.lastSeen;
        if (target && this.moveToward(target.x, target.y, this.patrolSpeed * 1.25, dt)) {
          // Arrived: look around, then give up and go back to patrol.
          this.stateTime = 0;
          this.state = 'search';
          this.searchTime = 0;
        }
        break;
      }
      case 'search':
        this.searchTime += dt;
        this.facing += dt * 1.4; // slow scan of the room
        if (this.searchTime > 2) {
          this.state = 'patrol';
          this.stateTime = 0;
          this.investigatePoint = null;
          this.suspicion = 0;
        }
        break;
      case 'alert': {
        if (sees) {
          this.moveToward(player.x, player.y, this.chaseSpeed, dt);
          this.stateTime = 0; // still on the trail
        } else if (this.lastSeen) {
          this.moveToward(this.lastSeen.x, this.lastSeen.y, this.chaseSpeed, dt);
          if (this.stateTime > ALERT_GIVE_UP) {
            // Lost the trail: search where the player was last seen.
            this.state = 'search';
            this.searchTime = 0;
            this.investigatePoint = { ...this.lastSeen };
          }
        } else {
          this.state = 'patrol';
        }
        break;
      }
    }

    // A guard that can no longer see the player slowly calms down.
    if (!sees && this.state !== 'alert') {
      this.suspicion = Math.max(0, this.suspicion - dt * 0.25);
    }
    return d;
  }

  patrolStep(dt) {
    if (this.pauseTime > 0) {
      this.pauseTime -= dt;
      return;
    }
    const target = this.waypoints[this.targetIndex];
    if (this.moveToward(target.x, target.y, this.patrolSpeed, dt)) {
      this.targetIndex = (this.targetIndex + 1) % this.waypoints.length;
      this.pauseTime = 0.6;
    }
  }

  // Walk toward (tx, ty) at speed; returns true on arrival.
  moveToward(tx, ty, speed, dt) {
    const dx = tx - this.x;
    const dy = ty - this.y;
    const d = Math.hypot(dx, dy);
    if (d < 0.08) return true;
    const step = Math.min(d, speed * dt);
    this.x += (dx / d) * step;
    this.y += (dy / d) * step;
    this.facing = angleTo(0, 0, dx, dy);
    return d - step < 0.08;
  }
}
