// Coldwire — the map: tile queries, line of sight, reachability.
// The world is a grid of characters; the renderer and the guards both ask
// it the same questions, so a wall blocks sight exactly where it blocks feet.
// Vents ('V') and loot ('$') are floor tiles with something on them.

import { COLS, ROWS } from './config.js';

export class World {
  constructor(mapRows) {
    this.rows = mapRows;
    this.height = mapRows.length;
    this.width = mapRows[0].length;
    this.playerStart = null;
    this.relic = null;
    this.exit = null;
    this.vents = []; // {x, y} tile centres, in tile units
    this.loot = []; // {x, y, taken} in tile units
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        const c = mapRows[y][x];
        if (c === 'P') this.playerStart = { x: x + 0.5, y: y + 0.5 };
        if (c === 'R') this.relic = { x: x + 0.5, y: y + 0.5 };
        if (c === 'E') this.exit = { x: x + 0.5, y: y + 0.5 };
        if (c === 'V') this.vents.push({ x: x + 0.5, y: y + 0.5 });
        if (c === '$') this.loot.push({ x: x + 0.5, y: y + 0.5, taken: false });
      }
    }
  }

  tileAt(tx, ty) {
    if (tx < 0 || ty < 0 || tx >= this.width || ty >= this.height) return '#';
    return this.rows[ty][tx];
  }

  isWall(tx, ty) {
    return this.tileAt(tx, ty) === '#';
  }

  isShadow(tx, ty) {
    return this.tileAt(tx, ty) === '~';
  }

  isFloor(tx, ty) {
    const c = this.tileAt(tx, ty);
    return c !== '#';
  }

  // True when the tile (in tile units, may be fractional) is a wall.
  blocksPoint(px, py) {
    return this.isWall(Math.floor(px), Math.floor(py));
  }

  // The vent whose tile the player stands on (within 0.7 tiles), or null.
  ventNear(px, py) {
    for (const v of this.vents) {
      if (Math.hypot(px - v.x, py - v.y) < 0.7) return v;
    }
    return null;
  }

  // The vent paired with the given one (vents come in pairs, so the
  // player who crawls in at one end comes out at the other).
  ventPair(v) {
    for (const other of this.vents) {
      if (other !== v) return other;
    }
    return null;
  }

  // Uncollected loot within reach of the player, or null.
  lootNear(px, py) {
    for (const l of this.loot) {
      if (!l.taken && Math.hypot(px - l.x, py - l.y) < 0.6) return l;
    }
    return null;
  }

  // Circle (in tile units) against walls: used for smooth player movement.
  // Returns the position with the blocked axis removed.
  slideCircle(px, py, nx, ny, radius) {
    let outX = nx;
    let outY = ny;
    if (this.circleHitsWall(nx, py, radius)) outX = px;
    if (this.circleHitsWall(outX, ny, radius)) outY = py;
    return { x: outX, y: outY };
  }

  circleHitsWall(cx, cy, radius) {
    const x0 = Math.floor(cx - radius);
    const x1 = Math.floor(cx + radius);
    const y0 = Math.floor(cy - radius);
    const y1 = Math.floor(cy + radius);
    for (let ty = y0; ty <= y1; ty++) {
      for (let tx = x0; tx <= x1; tx++) {
        if (!this.isWall(tx, ty)) continue;
        const nearX = Math.max(tx, Math.min(cx, tx + 1));
        const nearY = Math.max(ty, Math.min(cy, ty + 1));
        const dx = cx - nearX;
        const dy = cy - nearY;
        if (dx * dx + dy * dy < radius * radius) return true;
      }
    }
    return false;
  }

  // Bresenham line of sight between two points in tile units.
  // Walls block sight; shadow and floor do not.
  hasLineOfSight(x0, y0, x1, y1) {
    const dx = Math.abs(x1 - x0);
    const dy = Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;
    let err = dx - dy;
    let x = Math.floor(x0);
    let y = Math.floor(y0);
    const endX = Math.floor(x1);
    const endY = Math.floor(y1);
    let guard = 0;
    while (guard++ < 200) {
      if (x === endX && y === endY) return true;
      if (this.isWall(x, y)) return false;
      const e2 = 2 * err;
      if (e2 > -dy) {
        err -= dy;
        x += sx;
      }
      if (e2 < dx) {
        err += dx;
        y += sy;
      }
    }
    return false;
  }

  // Flood fill from the player start: every floor tile it can reach.
  // Used by the level validator and by the win check (exit must be reachable).
  reachableFromStart() {
    const seen = new Set();
    const start = this.playerStart;
    const stack = [[Math.floor(start.x), Math.floor(start.y)]];
    while (stack.length) {
      const [x, y] = stack.pop();
      const key = x + ',' + y;
      if (seen.has(key) || !this.isFloor(x, y)) continue;
      seen.add(key);
      stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
    }
    return seen;
  }
}

// Throws on the first problem found; run at load so a broken map never ships.
export function validateLevel(level, index) {
  const { map, guards } = level;
  if (map.length !== ROWS) throw new Error(`level ${index}: ${map.length} rows, want ${ROWS}`);
  for (let y = 0; y < map.length; y++) {
    if (map[y].length !== COLS) throw new Error(`level ${index} row ${y}: ${map[y].length} cols, want ${COLS}`);
  }
  const world = new World(map);
  if (!world.playerStart) throw new Error(`level ${index}: no player start (P)`);
  if (!world.relic) throw new Error(`level ${index}: no relic (R)`);
  if (!world.exit) throw new Error(`level ${index}: no exit (E)`);
  if (world.vents.length !== 0 && world.vents.length !== 2) {
    throw new Error(`level ${index}: vents must come in pairs, found ${world.vents.length}`);
  }
  const reached = world.reachableFromStart();
  const relicKey = Math.floor(world.relic.x) + ',' + Math.floor(world.relic.y);
  const exitKey = Math.floor(world.exit.x) + ',' + Math.floor(world.exit.y);
  if (!reached.has(relicKey)) throw new Error(`level ${index}: relic unreachable`);
  if (!reached.has(exitKey)) throw new Error(`level ${index}: exit unreachable`);
  for (const v of world.vents) {
    if (!reached.has(Math.floor(v.x) + ',' + Math.floor(v.y))) {
      throw new Error(`level ${index}: vent at ${v.x},${v.y} unreachable`);
    }
  }
  for (const l of world.loot) {
    if (!reached.has(Math.floor(l.x) + ',' + Math.floor(l.y))) {
      throw new Error(`level ${index}: loot at ${l.x},${l.y} unreachable`);
    }
  }
  for (const [gi, g] of guards.entries()) {
    for (const [wx, wy] of g.waypoints) {
      if (!world.isFloor(wx, wy)) throw new Error(`level ${index} guard ${gi}: waypoint ${wx},${wy} is not floor`);
      if (!reached.has(wx + ',' + wy)) throw new Error(`level ${index} guard ${gi}: waypoint ${wx},${wy} unreachable from start`);
    }
  }
  return world;
}
