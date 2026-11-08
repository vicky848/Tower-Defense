// Pure simulation (no DOM). Struct-of-arrays + typed arrays, zero per-frame allocation.
import { CELL, COLS, ROWS, W, H, WAYPOINTS, ENEMIES, TOWERS, TOTAL_WAVES, MAX_LEVEL,
  towerStats, upgradeCost, waveSpec, hpMul, rewardMul } from '../data/config.js';

export const STEP = 1 / 60;           // fixed simulation timestep => identical behaviour at any refresh rate
const MAXSTEPS = 8;                   // spiral-of-death guard
export const MAXE = 12000, MAXP = 2600, MAXFX = 300;
const GC = 64, GW = Math.ceil(W / GC), GH = Math.ceil(H / GC), GN = GW * GH; // spatial hash

function buildPath() {
  const pts = WAYPOINTS.map(([c, r]) => [(c + 0.5) * CELL, (r + 0.5) * CELL]);
  const xs = [], ys = [];
  for (let s = 0; s < pts.length - 1; s++) {
    const [x0, y0] = pts[s], [x1, y1] = pts[s + 1];
    const len = Math.round(Math.hypot(x1 - x0, y1 - y0));
    for (let d = 0; d < len; d++) { xs.push(x0 + (x1 - x0) * d / len); ys.push(y0 + (y1 - y0) * d / len); }
  }
  const last = pts[pts.length - 1]; xs.push(last[0]); ys.push(last[1]);
  return { px: Float32Array.from(xs), py: Float32Array.from(ys), len: xs.length - 1, base: last };
}
export const PATH = buildPath();   // lookup table: 1 sample per world px of path length
export const BLOCKED = (() => {
  const b = new Uint8Array(COLS * ROWS);
  for (let s = 0; s < WAYPOINTS.length - 1; s++) {
    const [c0, r0] = WAYPOINTS[s], [c1, r1] = WAYPOINTS[s + 1];
    for (let c = Math.min(c0, c1); c <= Math.max(c0, c1); c++)
      for (let r = Math.min(r0, r1); r <= Math.max(r0, r1); r++)
        if (c >= 0 && c < COLS && r >= 0 && r < ROWS) b[r * COLS + c] = 1;
  }
  return b;
})();
const BASE_SPD = Float32Array.from(ENEMIES.map(e => e.speed));
const DMG = Int32Array.from(ENEMIES.map(e => e.dmg));

export class Game {
  constructor() {
    this.ex = new Float32Array(MAXE); this.ey = new Float32Array(MAXE);
    this.edist = new Float32Array(MAXE); this.ehp = new Float32Array(MAXE); this.emax = new Float32Array(MAXE);
    this.eslow = new Float32Array(MAXE); this.eslowAmt = new Float32Array(MAXE); this.espd = new Float32Array(MAXE);
    this.etype = new Uint8Array(MAXE); this.ealive = new Uint8Array(MAXE); this.egen = new Uint32Array(MAXE);
    this.efree = new Int32Array(MAXE); this.eCell = new Int32Array(MAXE);
    this.cellStart = new Int32Array(GN + 1); this.cellCur = new Int32Array(GN); this.cellItems = new Int32Array(MAXE);
    this.px = new Float32Array(MAXP); this.py = new Float32Array(MAXP);
    this.ptx = new Float32Array(MAXP); this.pty = new Float32Array(MAXP);
    this.pdmg = new Float32Array(MAXP); this.pspd = new Float32Array(MAXP); this.pslow = new Float32Array(MAXP);
    this.plife = new Float32Array(MAXP); this.pslot = new Int32Array(MAXP); this.pgen = new Uint32Array(MAXP);
    this.pkind = new Uint8Array(MAXP);
    this.fxx = new Float32Array(MAXFX); this.fxy = new Float32Array(MAXFX); this.fxr = new Float32Array(MAXFX);
    this.fxl = new Float32Array(MAXFX); this.fxm = new Float32Array(MAXFX); this.fxk = new Uint8Array(MAXFX);
    // Optimisation switches (so before/after can be shown live)
    this.opts = { grid: true, batch: true, cull: true, cache: true };
    this.reset();
  }
  reset() {
    this.state = 'menu'; this.paused = false; this.speed = 1; this.acc = 0;
    this.lives = 20; this.gold = 220; this.score = 0; this.kills = 0;
    this.wave = 0; this.waveActive = false; this.intermission = 0; this.auto = true;
    this.stress = null; this.pcap = MAXP; this.pspdScale = 1;
    this.ealive.fill(0); this.eHigh = 0; this.nfree = 0; this.nE = 0; this.np = 0; this.nfx = 0;
    this.towers = []; this.occ = new Array(COLS * ROWS).fill(null);
    this.spawnTimes = []; this.spawnTypes = []; this.spawnPtr = 0; this.spawnT = 0; this.hpm = 1;
    this.selected = null; this.placing = -1; this.hover = null; this.hurt = 0;
    this.toast = ''; this.toastT = 0; this.time = 0;
  }
  start() { if (this.state === 'menu') this.state = 'playing'; }
  say(t) { this.toast = t; this.toastT = 1.6; }

  // ---------- enemies ----------
  spawn(type, mul) {
    let i;
    if (this.nfree > 0) i = this.efree[--this.nfree];
    else { if (this.eHigh >= MAXE) return -1; i = this.eHigh++; }
    const hp = ENEMIES[type].hp * mul;
    this.ealive[i] = 1; this.etype[i] = type; this.edist[i] = 0; this.ehp[i] = hp; this.emax[i] = hp;
    this.eslow[i] = 0; this.eslowAmt[i] = 0; this.espd[i] = BASE_SPD[type]; this.egen[i]++;
    this.ex[i] = PATH.px[0]; this.ey[i] = PATH.py[0]; this.nE++;
    return i;
  }
  removeE(i) { this.ealive[i] = 0; this.efree[this.nfree++] = i; this.nE--; }
  hit(i, dmg, pierce, slowAmt) {
    if (!this.ealive[i]) return;
    const a = ENEMIES[this.etype[i]].armor;
    this.ehp[i] -= pierce ? dmg : Math.max(dmg - a, dmg * 0.2);
    if (slowAmt > 0) { if (this.eslow[i] <= 0 || slowAmt > this.eslowAmt[i]) this.eslowAmt[i] = slowAmt; this.eslow[i] = 2; }
    if (this.ehp[i] <= 0) {
      const E = ENEMIES[this.etype[i]];
      this.gold += Math.round(E.reward * rewardMul(this.wave));
      this.score += E.reward * 10; this.kills++;
      this.removeE(i);
    }
  }

  // ---------- waves ----------
  startWave() {
    if (this.state !== 'playing' || this.waveActive || this.stress || this.wave >= TOTAL_WAVES) return;
    this.wave++; this.waveActive = true; this.spawnT = 0; this.spawnPtr = 0; this.hpm = hpMul(this.wave);
    const ev = [];
    for (const g of waveSpec(this.wave)) for (let k = 0; k < g.count; k++) ev.push([g.delay + k * g.gap, g.type]);
    ev.sort((a, b) => a[0] - b[0]);
    this.spawnTimes = ev.map(e => e[0]); this.spawnTypes = ev.map(e => e[1]);
  }
  togglePause() { if (this.state === 'playing') this.paused = !this.paused; }
  setSpeed(s) { this.speed = s; }

  // ---------- towers ----------
  refresh(t) { const s = towerStats(t.kind, t.lvl); t.dmg = s.dmg; t.rcd = s.rcd; t.range = s.range; t.slow = s.slow; }
  addTower(kind, c, r, lvl) {
    const t = { kind, col: c, row: r, x: (c + 0.5) * CELL, y: (r + 0.5) * CELL, lvl, cd: 0, ang: -Math.PI / 2, spent: TOWERS[kind].cost, dmg: 0, rcd: 0, range: 0, slow: 0 };
    this.refresh(t); this.towers.push(t); this.occ[r * COLS + c] = t; return t;
  }
  place(kind, c, r) {
    if (this.state !== 'playing') return false;
    if (c < 0 || r < 0 || c >= COLS || r >= ROWS || BLOCKED[r * COLS + c] || this.occ[r * COLS + c]) { this.say("Can't build there"); return false; }
    if (this.gold < TOWERS[kind].cost) { this.say('Not enough gold'); return false; }
    this.gold -= TOWERS[kind].cost; this.addTower(kind, c, r, 0); return true;
  }
  upgrade(t) {
    if (!t || t.lvl >= MAX_LEVEL) return false;
    const c = upgradeCost(t.kind, t.lvl);
    if (this.gold < c) { this.say('Not enough gold'); return false; }
    this.gold -= c; t.spent += c; t.lvl++; this.refresh(t); return true;
  }
  sell(t) {
    if (!t) return;
    this.gold += Math.floor(t.spent * 0.7);
    this.towers.splice(this.towers.indexOf(t), 1); this.occ[t.row * COLS + t.col] = null;
    if (this.selected === t) this.selected = null;
  }

  // ---------- spatial hash (counting sort, no allocation) ----------
  buildGrid() {
    const cs = this.cellStart, cur = this.cellCur, items = this.cellItems, ec = this.eCell, al = this.ealive, ex = this.ex, ey = this.ey;
    cs.fill(0);
    for (let i = 0; i < this.eHigh; i++) {
      if (!al[i]) continue;
      let cx = (ex[i] / GC) | 0, cy = (ey[i] / GC) | 0;
      cx = cx < 0 ? 0 : cx >= GW ? GW - 1 : cx; cy = cy < 0 ? 0 : cy >= GH ? GH - 1 : cy;
      const c = cy * GW + cx; ec[i] = c; cs[c + 1]++;
    }
    for (let c = 0; c < GN; c++) { cs[c + 1] += cs[c]; cur[c] = cs[c]; }
    for (let i = 0; i < this.eHigh; i++) if (al[i]) items[cur[ec[i]]++] = i;
  }
  findTarget(t) {
    const r = t.range, r2 = r * r, strong = TOWERS[t.kind].target === 'strong';
    const al = this.ealive, ex = this.ex, ey = this.ey, key = strong ? this.ehp : this.edist;
    let best = -1, bs = -1;
    if (this.opts.grid) {
      const x0 = Math.max(0, ((t.x - r) / GC) | 0), x1 = Math.min(GW - 1, ((t.x + r) / GC) | 0);
      const y0 = Math.max(0, ((t.y - r) / GC) | 0), y1 = Math.min(GH - 1, ((t.y + r) / GC) | 0);
      for (let cy = y0; cy <= y1; cy++) for (let cx = x0; cx <= x1; cx++) {
        const c = cy * GW + cx;
        for (let k = this.cellStart[c], e = this.cellStart[c + 1]; k < e; k++) {
          const i = this.cellItems[k]; if (!al[i]) continue;
          const dx = ex[i] - t.x, dy = ey[i] - t.y;
          if (dx * dx + dy * dy <= r2 && key[i] > bs) { bs = key[i]; best = i; }
        }
      }
    } else {
      for (let i = 0; i < this.eHigh; i++) {   // naive O(enemies) scan per tower
        if (!al[i]) continue;
        const dx = ex[i] - t.x, dy = ey[i] - t.y;
        if (dx * dx + dy * dy <= r2 && key[i] > bs) { bs = key[i]; best = i; }
      }
    }
    return best;
  }
  splash(x, y, r, dmg, pierce, slow) {
    const r2 = r * r, al = this.ealive, ex = this.ex, ey = this.ey;
    if (this.opts.grid) {
      const x0 = Math.max(0, ((x - r) / GC) | 0), x1 = Math.min(GW - 1, ((x + r) / GC) | 0);
      const y0 = Math.max(0, ((y - r) / GC) | 0), y1 = Math.min(GH - 1, ((y + r) / GC) | 0);
      for (let cy = y0; cy <= y1; cy++) for (let cx = x0; cx <= x1; cx++) {
        const c = cy * GW + cx;
        for (let k = this.cellStart[c], e = this.cellStart[c + 1]; k < e; k++) {
          const i = this.cellItems[k]; if (!al[i]) continue;
          const dx = ex[i] - x, dy = ey[i] - y;
          if (dx * dx + dy * dy <= r2) this.hit(i, dmg, pierce, slow);
        }
      }
    } else {
      for (let i = 0; i < this.eHigh; i++) {
        if (!al[i]) continue;
        const dx = ex[i] - x, dy = ey[i] - y;
        if (dx * dx + dy * dy <= r2) this.hit(i, dmg, pierce, slow);
      }
    }
  }

  // ---------- projectiles & fx (dense pools with swap-remove) ----------
  fire(t, target) {
    if (this.np >= this.pcap) return false;
    const k = this.np++;
    this.px[k] = t.x; this.py[k] = t.y; this.pslot[k] = target; this.pgen[k] = this.egen[target];
    this.ptx[k] = this.ex[target]; this.pty[k] = this.ey[target];
    this.pdmg[k] = t.dmg; this.pspd[k] = TOWERS[t.kind].speed * this.pspdScale; this.pkind[k] = t.kind;
    this.pslow[k] = t.slow; this.plife[k] = this.stress ? 6 : 3;
    return true;
  }
  removeP(k) {
    const l = --this.np;
    if (k !== l) {
      this.px[k] = this.px[l]; this.py[k] = this.py[l]; this.ptx[k] = this.ptx[l]; this.pty[k] = this.pty[l];
      this.pdmg[k] = this.pdmg[l]; this.pspd[k] = this.pspd[l]; this.pslow[k] = this.pslow[l]; this.plife[k] = this.plife[l];
      this.pslot[k] = this.pslot[l]; this.pgen[k] = this.pgen[l]; this.pkind[k] = this.pkind[l];
    }
  }
  addFx(x, y, r, kind) {
    if (this.nfx >= MAXFX) return;
    const f = this.nfx++;
    this.fxx[f] = x; this.fxy[f] = y; this.fxr[f] = r; this.fxl[f] = 0.3; this.fxm[f] = 0.3; this.fxk[f] = kind;
  }
  impact(k, x, y) {
    const kind = this.pkind[k], T = TOWERS[kind];
    if (T.splash > 0) { this.splash(x, y, T.splash, this.pdmg[k], T.pierce, this.pslow[k]); this.addFx(x, y, T.splash, kind); }
    else {
      const s = this.pslot[k];
      if (this.ealive[s] && this.egen[s] === this.pgen[k]) this.hit(s, this.pdmg[k], T.pierce, 0);
      this.addFx(x, y, 9, kind);
    }
  }

  // ---------- simulation step ----------
  step(dt) {
    this.time += dt;
    if (this.hurt > 0) this.hurt = Math.max(0, this.hurt - dt * 2);
    if (!this.stress && this.waveActive) {
      this.spawnT += dt;
      while (this.spawnPtr < this.spawnTimes.length && this.spawnTimes[this.spawnPtr] <= this.spawnT)
        this.spawn(this.spawnTypes[this.spawnPtr++], this.hpm);
    }
    this.moveEnemies(dt);
    if (this.opts.grid) this.buildGrid();
    this.updateTowers(dt);
    this.updateProjectiles(dt);
    for (let f = this.nfx - 1; f >= 0; f--) {
      if ((this.fxl[f] -= dt) <= 0) {
        const l = --this.nfx;
        if (f !== l) { this.fxx[f] = this.fxx[l]; this.fxy[f] = this.fxy[l]; this.fxr[f] = this.fxr[l]; this.fxl[f] = this.fxl[l]; this.fxm[f] = this.fxm[l]; this.fxk[f] = this.fxk[l]; }
      }
    }
    if (!this.stress) this.waveLogic(dt);
  }
  moveEnemies(dt) {
    const al = this.ealive, ty = this.etype, ed = this.edist, es = this.eslow, ea = this.eslowAmt, sp = this.espd, L = PATH.len;
    for (let i = 0; i < this.eHigh; i++) {
      if (!al[i]) continue;
      let s = BASE_SPD[ty[i]];
      if (es[i] > 0) { es[i] -= dt; s *= 1 - ea[i]; }
      sp[i] = s;
      let d = ed[i] + s * dt;
      if (d >= L) {
        if (this.stress) d -= L;
        else {
          this.lives -= DMG[ty[i]]; this.hurt = 1; this.removeE(i);
          if (this.lives <= 0) { this.lives = 0; this.state = 'lost'; }
          continue;
        }
      }
      ed[i] = d; const k = d | 0; this.ex[i] = PATH.px[k]; this.ey[i] = PATH.py[k];
    }
  }
  updateTowers(dt) {
    const ts = this.towers, boost = this.stress ? 0.4 : 1;
    for (let n = 0; n < ts.length; n++) {
      const t = ts[n];
      if ((t.cd -= dt) > 0) continue;
      const tg = this.findTarget(t);
      if (tg < 0) { t.cd = 0.03; continue; }
      t.ang = Math.atan2(this.ey[tg] - t.y, this.ex[tg] - t.x);
      if (this.fire(t, tg)) t.cd = t.rcd * boost; else t.cd = 0.05;
    }
  }
  updateProjectiles(dt) {
    const al = this.ealive, ex = this.ex, ey = this.ey, eg = this.egen;
    for (let k = this.np - 1; k >= 0; k--) {
      const s = this.pslot[k]; let tx = this.ptx[k], ty = this.pty[k];
      if (al[s] && eg[s] === this.pgen[k]) { tx = ex[s]; ty = ey[s]; this.ptx[k] = tx; this.pty[k] = ty; }
      const dx = tx - this.px[k], dy = ty - this.py[k], d = Math.sqrt(dx * dx + dy * dy), step = this.pspd[k] * dt;
      if (d <= step + 4) { this.impact(k, tx, ty); this.removeP(k); continue; }
      if ((this.plife[k] -= dt) <= 0) { this.removeP(k); continue; }
      this.px[k] += dx / d * step; this.py[k] += dy / d * step;
    }
  }
  waveLogic(dt) {
    if (this.waveActive) {
      if (this.spawnPtr >= this.spawnTimes.length && this.nE === 0 && this.state === 'playing') {
        this.waveActive = false; this.gold += 25 + this.wave * 5; this.score += this.wave * 100;
        if (this.wave >= TOTAL_WAVES) { this.state = 'won'; this.score += this.lives * 500; }
        else this.intermission = 8;
      }
    } else if (this.auto && this.wave > 0 && this.state === 'playing') {
      if ((this.intermission -= dt) <= 0) this.startWave();
    }
  }

  // Called once per rAF with real elapsed seconds. Fixed-step accumulator.
  frame(dtReal) {
    if (this.toastT > 0) this.toastT -= dtReal;
    if (this.state !== 'playing' || this.paused) return;
    this.acc += Math.min(dtReal, 0.1) * this.speed;
    let n = 0;
    while (this.acc >= STEP && n < MAXSTEPS) { this.step(STEP); this.acc -= STEP; n++; }
    if (n === MAXSTEPS) this.acc = 0;
  }

  // ---------- stress scenario ----------
  applyStress(cfg) {
    this.reset(); this.stress = cfg; this.state = 'playing'; this.lives = 999999; this.gold = 0;
    this.pcap = Math.min(cfg.p, MAXP); this.pspdScale = 0.25;
    const near = [], free = [];
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
      if (BLOCKED[r * COLS + c]) continue;
      free.push([c, r]);
      let ok = false;
      for (let dy = -2; dy <= 2 && !ok; dy++) for (let dx = -2; dx <= 2; dx++) {
        const cc = c + dx, rr = r + dy;
        if (cc >= 0 && cc < COLS && rr >= 0 && rr < ROWS && BLOCKED[rr * COLS + cc]) { ok = true; break; }
      }
      if (ok) near.push([c, r]);
    }
    const pool = near.length >= cfg.t ? near : free, nT = Math.min(cfg.t, pool.length);
    for (let i = 0; i < nT; i++) { const [c, r] = pool[Math.floor(i * pool.length / nT)]; this.addTower(i % 4, c, r, 2); }
    const mix = [0, 0, 1, 3, 3, 2, 3, 0, 1, 4];
    for (let i = 0; i < cfg.e; i++) {
      const id = this.spawn(mix[i % mix.length], 1e7); if (id < 0) break;
      const d = (i / cfg.e) * PATH.len; this.edist[id] = d; this.ex[id] = PATH.px[d | 0]; this.ey[id] = PATH.py[d | 0];
    }
  }

  snapshot() {
    const s = this.selected; let sel = null;
    if (s) sel = { kind: s.kind, lvl: s.lvl, dmg: s.dmg, cd: s.rcd, range: s.range, slow: s.slow, up: s.lvl < MAX_LEVEL ? upgradeCost(s.kind, s.lvl) : 0, sell: Math.floor(s.spent * 0.7) };
    return { state: this.state, paused: this.paused, speed: this.speed, lives: this.lives, gold: this.gold, score: this.score,
      wave: this.wave, waveActive: this.waveActive, intermission: Math.max(0, Math.ceil(this.intermission)), auto: this.auto,
      placing: this.placing, nE: this.nE, nT: this.towers.length, nP: this.np, stress: !!this.stress, kills: this.kills,
      left: this.nE + (this.waveActive ? this.spawnTimes.length - this.spawnPtr : 0), toast: this.toastT > 0 ? this.toast : '', sel };
  }
}