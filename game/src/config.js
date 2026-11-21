// Shadow Vault — level data and tuning constants.
// Tiles: '#' wall, '.' floor, '~' shadow (dark cover), 'P' player start,
// 'R' relic (the objective), 'E' exit. Guards patrol the waypoint lists
// (tile coordinates, [x, y]); every waypoint must be a floor tile.

export const TILE = 48;
export const COLS = 20;
export const ROWS = 13;

// Player movement, in tiles per second.
export const PLAYER_WALK = 3.2;
export const PLAYER_RUN = 4.6;
// Running is loud: guards inside this radius (tiles) come to investigate.
export const NOISE_RADIUS = 3.2;
export const NOISE_PULSE_EVERY = 0.35;

// Vision: cone range in tiles, half-angle in radians.
export const VISION_RANGE = 5.5;
export const VISION_HALF_ANGLE = 0.61;
// A player standing in shadow is harder to spot: shorter effective range
// and a slower detection fill.
export const SHADOW_RANGE = 3.5;
export const SHADOW_FILL_FACTOR = 0.5;
// Detection (0..100) fill per second at point blank / at max range.
export const DETECT_FILL_NEAR = 50;
export const DETECT_FILL_FAR = 18;
// Detection drain per second when unseen (faster while hidden in shadow).
export const DETECT_DRAIN = 30;
export const DETECT_DRAIN_SHADOW = 45;
// An alerted guard chases; if it loses sight this long it gives up.
export const ALERT_GIVE_UP = 2.5;
// Caught when an alerted guard gets this close (tiles).
export const CATCH_DISTANCE = 0.55;

export const LEVELS = [
  {
    name: 'Level 1 — The Gallery',
    tip: 'Two guards patrol the middle. Cross behind them, in the dark tiles.',
    guardSpeed: 1.5,
    chaseSpeed: 2.7,
    map: [
      '####################',
      '#P....#......~~...R#',
      '#.....#......~~....#',
      '#.~~..#..~~........#',
      '#.~~..#..~~...#....#',
      '#.....#......#.....#',
      '#.####....####.....#',
      '#..................#',
      '#....~~.....~~.....#',
      '#....~~.....~~.....#',
      '#..................#',
      '#..E...............#',
      '####################',
    ],
    guards: [
      { waypoints: [[4, 7], [15, 7]] },
      { waypoints: [[3, 10], [16, 10]] },
    ],
  },
  {
    name: 'Level 2 — The Vault Wing',
    tip: 'Three guards, one on a vertical beat. Wait for the gap, then run the corridor.',
    guardSpeed: 1.8,
    chaseSpeed: 2.9,
    map: [
      '####################',
      '#P..~~.#.....~~...R#',
      '#....~~.#.....~~...#',
      '#.##...#..##.......#',
      '#......#......#....#',
      '#..~~..####..#..~~.#',
      '#..~~........#..~~.#',
      '#......##....#.....#',
      '#.####.....####....#',
      '#..................#',
      '#..~~....~~....~~..#',
      '#..~~....~~..E.~~..#',
      '####################',
    ],
    guards: [
      { waypoints: [[2, 9], [17, 9]] },
      { waypoints: [[9, 1], [9, 4]] },
      { waypoints: [[15, 3], [18, 3]] },
    ],
  },
  {
    name: 'Level 3 — The Inner Vault',
    tip: 'Four guards, fast patrols. The exit guard walks the vault door — time it.',
    guardSpeed: 2.1,
    chaseSpeed: 3.1,
    map: [
      '####################',
      '#P...#....~~..#...R#',
      '#....#....~~..#....#',
      '#.~~.#..##....#..~~#',
      '#.~~.#..##....#..~~#',
      '#....#........#....#',
      '#.####..####..###..#',
      '#..................#',
      '#..~~...##...~~....#',
      '#..~~...##...~~....#',
      '#......##.....#....#',
      '#..E....#.....#....#',
      '####################',
    ],
    guards: [
      { waypoints: [[2, 7], [17, 7]] },
      { waypoints: [[10, 1], [10, 5]] },
      { waypoints: [[5, 9], [5, 11]] },
      { waypoints: [[15, 8], [18, 8]] },
    ],
  },
];
