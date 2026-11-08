// All tunable game data lives here: map, enemies, towers, waves, balance curves.
export const CELL = 40, COLS = 40, ROWS = 24, W = COLS * CELL, H = ROWS * CELL;
export const TOTAL_WAVES = 50, MAX_LEVEL = 3;
// Serpentine path in cell coords (axis-aligned). Last point is the base.
export const WAYPOINTS = [[-1,3],[34,3],[34,8],[5,8],[5,13],[34,13],[34,18],[5,18],[5,22]];

export const ENEMIES = [
  { name: 'Grunt',  hp: 40,   speed: 70,  armor: 0,  r: 7,   color: '#8bd17c', reward: 4,   dmg: 1,  note: 'Balanced foot soldier' },
  { name: 'Runner', hp: 24,   speed: 130, armor: 0,  r: 5.5, color: '#ffd166', reward: 3,   dmg: 1,  note: 'Fast, fragile' },
  { name: 'Tank',   hp: 320,  speed: 42,  armor: 6,  r: 11,  color: '#9aa7c0', reward: 14,  dmg: 3,  note: 'Armor 6: shrugs off small hits' },
  { name: 'Swarm',  hp: 9,    speed: 95,  armor: 0,  r: 3.5, color: '#ef476f', reward: 1,   dmg: 1,  note: 'Huge packs: splash food' },
  { name: 'Boss',   hp: 2400, speed: 30,  armor: 10, r: 17,  color: '#b58cf0', reward: 150, dmg: 15, note: 'Every 10th wave. Armor 10' },
];

export const TOWERS = [
  { name: 'Gunner',  cost: 60,  range: 120, dmg: 8,   cd: 0.25, speed: 520,  splash: 0,  slow: 0,    pierce: false, target: 'first',  color: '#4cc9f0', r: 2.6, desc: 'Rapid fire, single target' },
  { name: 'Cannon',  cost: 120, range: 140, dmg: 42,  cd: 1.2,  speed: 320,  splash: 56, slow: 0,    pierce: false, target: 'first',  color: '#f8961e', r: 4.5, desc: 'Slow shells, area damage' },
  { name: 'Frost',   cost: 90,  range: 110, dmg: 3,   cd: 0.7,  speed: 380,  splash: 48, slow: 0.45, pierce: false, target: 'first',  color: '#9bf6ff', r: 3.4, desc: 'Slows everything in the burst' },
  { name: 'Railgun', cost: 220, range: 300, dmg: 130, cd: 2.2,  speed: 1400, splash: 0,  slow: 0,    pierce: true,  target: 'strong', color: '#f72585', r: 3.2, desc: 'Long range, ignores armor, hits the strongest' },
];

export function towerStats(kind, lvl) {
  const t = TOWERS[kind];
  return {
    dmg: t.dmg * Math.pow(1.7, lvl),
    rcd: t.cd * Math.pow(0.9, lvl),
    range: t.range * (1 + 0.07 * lvl),
    slow: t.slow ? Math.min(0.8, t.slow + 0.1 * lvl) : 0,
  };
}
export const upgradeCost = (kind, lvl) => Math.round(TOWERS[kind].cost * (0.7 + 0.6 * lvl));

// Difficulty curves
export const hpMul = (n) => 1 + 0.25 * n + 0.016 * n * n;      // wave 50 = 53x
export const rewardMul = (n) => 1 + 0.05 * n;
export function waveSpec(n) {
  const g = [];
  const add = (type, count, gap, delay = 0) => g.push({ type, count, gap, delay });
  add(0, 6 + Math.floor(n * 1.3), Math.max(0.25, 0.8 - n * 0.012));
  if (n >= 3 && n % 2 === 1) add(1, 4 + Math.floor(n * 0.8), 0.4, 2);
  if (n >= 5 && n % 2 === 0) add(2, 1 + Math.floor(n / 6), 1.5, 3);
  if (n >= 8 && n % 4 === 0) add(3, 20 + n * 2, 0.1, 4);
  if (n >= 15 && n % 5 === 0) add(2, 3 + Math.floor(n / 4), 1.0, 0);
  if (n % 10 === 0) add(4, n / 10, 6, 6);
  return g;
}