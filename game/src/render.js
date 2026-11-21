// Shadow Vault — renderer: everything the judge sees, drawn on one canvas.
// Top-down museum at night: stone walls, a checkerboard floor, pools of
// shadow you can hide in, warm vision cones, a glowing exit door and the
// gold relic. The player is teal; guards are red-orange so they read
// against the floor at a glance.

import { TILE, COLS, ROWS, VISION_RANGE, VISION_HALF_ANGLE, NOISE_RADIUS } from './config.js';

const FLOOR_A = '#232a3d';
const FLOOR_B = '#1e2436';
const WALL_TOP = '#4a5470';
const WALL_FACE = '#2e3550';
const SHADOW_TILE = '#0b0e1a';
const CONE_COLOR = 'rgba(255, 196, 66, 0.20)';
const CONE_ALERT = 'rgba(255, 70, 60, 0.30)';

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.canvas.width = COLS * TILE;
    this.canvas.height = ROWS * TILE;
    this.motes = [];
    for (let i = 0; i < 40; i++) {
      this.motes.push({
        x: Math.random() * this.canvas.width,
        y: Math.random() * this.canvas.height,
        r: 0.6 + Math.random() * 1.4,
        drift: 2 + Math.random() * 5,
      });
    }
  }

  draw(game) {
    const { ctx } = this;
    const { world, player, guards } = game;
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.drawFloor(world);
    this.drawExit(world);
    this.drawRelic(world, game.time);
    this.drawNoiseRings(player);
    for (const g of guards) this.drawVisionCone(g, world);
    for (const g of guards) this.drawGuard(g);
    this.drawPlayer(player);
    this.drawMotes(game.time);
    this.drawVignette();
    if (game.state === 'title') this.drawTitle(game);
    if (game.state === 'caught') this.drawCaught(game);
    if (game.state === 'levelclear') this.drawLevelClear(game);
    if (game.state === 'win') this.drawWin(game);
    if (game.state === 'paused') this.drawPaused();
  }

  drawFloor(world) {
    const { ctx } = this;
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        const c = world.tileAt(x, y);
        const px = x * TILE;
        const py = y * TILE;
        if (c === '#') {
          ctx.fillStyle = WALL_FACE;
          ctx.fillRect(px, py, TILE, TILE);
          ctx.fillStyle = WALL_TOP;
          ctx.fillRect(px, py + 2, TILE, 8);
          ctx.fillStyle = 'rgba(255,255,255,0.05)';
          ctx.fillRect(px, py, TILE, 2);
        } else if (c === '~') {
          ctx.fillStyle = SHADOW_TILE;
          ctx.fillRect(px, py, TILE, TILE);
          ctx.fillStyle = 'rgba(120,140,255,0.06)';
          ctx.fillRect(px + 4, py + 4, TILE - 8, TILE - 8);
        } else {
          ctx.fillStyle = (x + y) % 2 === 0 ? FLOOR_A : FLOOR_B;
          ctx.fillRect(px, py, TILE, TILE);
          ctx.fillStyle = 'rgba(255,255,255,0.03)';
          ctx.fillRect(px, py, TILE, 1);
          ctx.fillRect(px, py, 1, TILE);
        }
      }
    }
  }

  drawExit(world) {
    const { ctx } = this;
    const e = world.exit;
    const cx = e.x * TILE;
    const cy = e.y * TILE;
    const glow = ctx.createRadialGradient(cx, cy, 4, cx, cy, 46);
    glow.addColorStop(0, 'rgba(80, 255, 140, 0.45)');
    glow.addColorStop(1, 'rgba(80, 255, 140, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(cx - 46, cy - 46, 92, 92);
    ctx.fillStyle = '#0e2b1a';
    ctx.fillRect(cx - 16, cy - 20, 32, 40);
    ctx.fillStyle = '#39d98a';
    ctx.fillRect(cx - 13, cy - 17, 26, 34);
    ctx.fillStyle = '#0e2b1a';
    ctx.font = 'bold 15px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('EXIT', cx, cy + 1);
  }

  drawRelic(world, time) {
    const { ctx } = this;
    const r = world.relic;
    const cx = r.x * TILE;
    const cy = r.y * TILE + Math.sin(time * 2) * 2;
    const glow = ctx.createRadialGradient(cx, cy, 2, cx, cy, 40);
    glow.addColorStop(0, 'rgba(255, 210, 80, 0.5)');
    glow.addColorStop(1, 'rgba(255, 210, 80, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(cx - 40, cy - 40, 80, 80);
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(Math.PI / 4);
    ctx.fillStyle = '#ffd250';
    ctx.fillRect(-9, -9, 18, 18);
    ctx.fillStyle = '#fff3c4';
    ctx.fillRect(-9, -9, 18, 6);
    ctx.restore();
  }

  drawNoiseRings(player) {
    const { ctx } = this;
    for (const p of player.noisePulses) {
      const t = p.age / 0.8;
      ctx.strokeStyle = `rgba(255, 255, 255, ${0.5 * (1 - t)})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(p.x * TILE, p.y * TILE, NOISE_RADIUS * TILE * t, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  // The cone is a fan of rays: each ray stops at the first wall, so the
  // cone wraps around cover exactly like the guard's sight does.
  drawVisionCone(guard, world) {
    const { ctx } = this;
    const gx = guard.x * TILE;
    const gy = guard.y * TILE;
    const steps = 26;
    ctx.beginPath();
    ctx.moveTo(gx, gy);
    for (let i = 0; i <= steps; i++) {
      const a = guard.facing - VISION_HALF_ANGLE + (2 * VISION_HALF_ANGLE * i) / steps;
      const end = this.rayToWall(world, guard.x, guard.y, a, VISION_RANGE);
      ctx.lineTo(end.x * TILE, end.y * TILE);
    }
    ctx.closePath();
    ctx.fillStyle = guard.state === 'alert' ? CONE_ALERT : CONE_COLOR;
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 210, 90, 0.25)';
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  rayToWall(world, x, y, angle, maxDist) {
    const step = 0.15;
    let d = 0.3;
    while (d < maxDist) {
      const px = x + Math.cos(angle) * d;
      const py = y + Math.sin(angle) * d;
      if (world.blocksPoint(px, py)) break;
      d += step;
    }
    return { x: x + Math.cos(angle) * d, y: y + Math.sin(angle) * d };
  }

  drawGuard(guard) {
    const { ctx } = this;
    const cx = guard.x * TILE;
    const cy = guard.y * TILE;
    // Body: red-orange so it reads against the blue floor.
    ctx.fillStyle = guard.state === 'alert' ? '#ff3b30' : '#e8622c';
    ctx.beginPath();
    ctx.arc(cx, cy, 13, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffd9c2';
    ctx.beginPath();
    ctx.arc(cx, cy, 7, 0, Math.PI * 2);
    ctx.fill();
    // Facing tick: the direction the guard looks.
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(guard.facing) * 18, cy + Math.sin(guard.facing) * 18);
    ctx.stroke();
    // State mark: '!' while alert, '?' while suspicious.
    if (guard.state === 'alert' || guard.state === 'suspicious') {
      ctx.fillStyle = guard.state === 'alert' ? '#ff3b30' : '#ffd250';
      ctx.font = 'bold 20px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillText(guard.state === 'alert' ? '!' : '?', cx, cy - 16);
    }
  }

  drawPlayer(player) {
    const { ctx } = this;
    const cx = player.x * TILE;
    const cy = player.y * TILE;
    // A soft teal glow so the player is findable in the dark.
    const glow = ctx.createRadialGradient(cx, cy, 2, cx, cy, 26);
    glow.addColorStop(0, 'rgba(64, 224, 208, 0.35)');
    glow.addColorStop(1, 'rgba(64, 224, 208, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(cx - 26, cy - 26, 52, 52);
    // Hooded figure: cloak triangle + hood circle, facing the walk direction.
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(player.facing);
    ctx.fillStyle = '#14b8a6';
    ctx.beginPath();
    ctx.moveTo(14, 0);
    ctx.lineTo(-10, -10);
    ctx.lineTo(-10, 10);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#0f766e';
    ctx.beginPath();
    ctx.arc(2, 0, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  drawMotes(time) {
    const { ctx } = this;
    ctx.fillStyle = 'rgba(200, 210, 255, 0.25)';
    for (const m of this.motes) {
      const y = (m.y + time * m.drift) % this.canvas.height;
      ctx.beginPath();
      ctx.arc(m.x, y, m.r, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  drawVignette() {
    const { ctx } = this;
    const g = ctx.createRadialGradient(
      this.canvas.width / 2, this.canvas.height / 2, this.canvas.height * 0.35,
      this.canvas.width / 2, this.canvas.height / 2, this.canvas.height * 0.75,
    );
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, 'rgba(0,0,0,0.45)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
  }

  overlay(title, lines, accent) {
    const { ctx } = this;
    ctx.fillStyle = 'rgba(5, 8, 18, 0.82)';
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = accent;
    ctx.font = 'bold 44px system-ui, sans-serif';
    ctx.fillText(title, this.canvas.width / 2, this.canvas.height / 2 - 70);
    ctx.fillStyle = '#e6e9f2';
    ctx.font = '18px system-ui, sans-serif';
    lines.forEach((line, i) => {
      ctx.fillText(line, this.canvas.width / 2, this.canvas.height / 2 - 10 + i * 30);
    });
  }

  drawTitle(game) {
    this.overlay('SHADOW VAULT', [
      'A night thief in the Blackwood Museum.',
      'Steal the relic, reach the green EXIT — unseen.',
      '',
      'WASD / arrows — move    Shift — run (loud!)    Click — walk here',
      'Hide in the dark tiles. A full meter means the alarm.',
      '',
      'Press ENTER or click to begin',
    ], '#ffd250');
  }

  drawCaught(game) {
    this.overlay('CAUGHT!', [
      `The guard caught you on ${game.levelName}.`,
      'The museum keeps its relic — for now.',
      '',
      'Press R to try again',
    ], '#ff3b30');
  }

  drawLevelClear(game) {
    this.overlay('CLEAN GETAWAY', [
      `${game.levelName} — relic stolen, exit reached unseen.`,
      `Time ${game.levelTimeText} — best ${game.bestTimeText}`,
      '',
      'Press ENTER for the next level',
    ], '#39d98a');
  }

  drawWin(game) {
    this.overlay('THE VAULT IS YOURS', [
      'Three relics, three clean getaways, no alarm that mattered.',
      `Total time ${game.totalTimeText} — best ${game.bestTimeText}`,
      '',
      'Press R to play again',
    ], '#ffd250');
  }

  drawPaused() {
    this.overlay('PAUSED', ['Press Esc to keep playing'], '#e6e9f2');
  }
}
