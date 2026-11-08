// Canvas2D renderer. Static map is cached to an offscreen canvas; dynamic entities are batched by colour
// (one path + one fill per group) and culled against the camera viewport.
import { CELL, COLS, ROWS, W, H, ENEMIES, TOWERS, MAX_LEVEL } from '../data/config.js';
import { PATH, BLOCKED, STEP } from './game.js';

const TAU = Math.PI * 2;
const SLOW_COLOR = '#7fd8ff';
let staticCv = null;

export function drawStatic(c) {
  c.fillStyle = '#0f1b1a'; c.fillRect(0, 0, W, H);
  for (let r = 0; r < ROWS; r++) for (let q = 0; q < COLS; q++) {
    c.fillStyle = (q + r) & 1 ? '#13231f' : '#112019'; c.fillRect(q * CELL, r * CELL, CELL, CELL);
  }
  c.lineJoin = 'round'; c.lineCap = 'round';
  c.beginPath(); c.moveTo(PATH.px[0], PATH.py[0]);
  for (let i = 40; i <= PATH.len; i += 40) c.lineTo(PATH.px[i], PATH.py[i]);
  c.lineTo(PATH.px[PATH.len], PATH.py[PATH.len]);
  c.strokeStyle = '#3a2e22'; c.lineWidth = 42; c.stroke();
  c.strokeStyle = '#7a6347'; c.lineWidth = 34; c.stroke();
  c.strokeStyle = '#8f7650'; c.lineWidth = 26; c.stroke();
  c.setLineDash([2, 18]); c.strokeStyle = 'rgba(255,240,200,.25)'; c.lineWidth = 2; c.stroke(); c.setLineDash([]);
  // base keep
  const [bx, by] = PATH.base;
  c.fillStyle = '#26324a'; c.fillRect(bx - 26, by - 26, 52, 52);
  c.fillStyle = '#3b4d73'; c.fillRect(bx - 20, by - 20, 40, 40);
  c.fillStyle = '#ffcf5a'; c.beginPath(); c.moveTo(bx - 12, by + 8); c.lineTo(bx - 12, by - 8); c.lineTo(bx - 6, by - 2); c.lineTo(bx, by - 12); c.lineTo(bx + 6, by - 2); c.lineTo(bx + 12, by - 8); c.lineTo(bx + 12, by + 8); c.closePath(); c.fill();
  // entrance marker
  c.fillStyle = 'rgba(239,71,111,.5)'; c.fillRect(0, PATH.py[0] - 20, 6, 40);
}
function getStatic() {
  if (!staticCv) {
    staticCv = document.createElement('canvas'); const S = 2;
    staticCv.width = W * S; staticCv.height = H * S;
    const c = staticCv.getContext('2d'); c.scale(S, S); drawStatic(c);
  }
  return staticCv;
}

export function render(g, ctx, cam, cw, ch, dpr) {
  const o = g.opts;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#080d12'; ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  const s = cam.z * dpr;
  ctx.setTransform(s, 0, 0, s, -cam.x * s, -cam.y * s);
  const vx0 = o.cull ? cam.x : -1e9, vy0 = o.cull ? cam.y : -1e9;
  const vx1 = o.cull ? cam.x + cw / cam.z : 1e9, vy1 = o.cull ? cam.y + ch / cam.z : 1e9;
  const al = (g.paused || g.state !== 'playing') ? 0 : Math.min(1, g.acc / STEP);

  if (o.cache) ctx.drawImage(getStatic(), 0, 0, W, H); else drawStatic(ctx);

  // build-grid hint while placing
  if (g.placing >= 0) {
    ctx.fillStyle = 'rgba(255,255,255,.05)';
    for (let r = 0; r < ROWS; r++) for (let q = 0; q < COLS; q++)
      if (!BLOCKED[r * COLS + q] && !g.occ[r * COLS + q] && (q + r) % 2 === 0) ctx.fillRect(q * CELL + 2, r * CELL + 2, CELL - 4, CELL - 4);
  }
  drawTowers(g, ctx, vx0, vy0, vx1, vy1);
  if (o.batch) drawEnemiesBatched(g, ctx, vx0, vy0, vx1, vy1, al, cam.z);
  else drawEnemiesNaive(g, ctx, vx0, vy0, vx1, vy1, al);
  drawProjectiles(g, ctx, o.batch, vx0, vy0, vx1, vy1);
  // impact rings
  for (let f = 0; f < g.nfx; f++) {
    const t = 1 - g.fxl[f] / g.fxm[f], x = g.fxx[f], y = g.fxy[f];
    if (x < vx0 - 60 || x > vx1 + 60 || y < vy0 - 60 || y > vy1 + 60) continue;
    ctx.globalAlpha = (1 - t) * 0.55; ctx.fillStyle = TOWERS[g.fxk[f]].color;
    ctx.beginPath(); ctx.arc(x, y, g.fxr[f] * (0.3 + 0.7 * t), 0, TAU); ctx.fill();
  }
  ctx.globalAlpha = 1;
  // selection / placement overlays
  const sel = g.selected;
  if (sel) {
    ctx.strokeStyle = 'rgba(255,255,255,.8)'; ctx.lineWidth = 1.5; ctx.fillStyle = 'rgba(255,255,255,.06)';
    ctx.beginPath(); ctx.arc(sel.x, sel.y, sel.range, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = '#ffcf5a'; ctx.lineWidth = 2; ctx.strokeRect(sel.col * CELL + 1, sel.row * CELL + 1, CELL - 2, CELL - 2);
  }
  if (g.placing >= 0 && g.hover) {
    const { c, r } = g.hover, T = TOWERS[g.placing];
    const ok = c >= 0 && r >= 0 && c < COLS && r < ROWS && !BLOCKED[r * COLS + c] && !g.occ[r * COLS + c] && g.gold >= T.cost;
    const x = (c + 0.5) * CELL, y = (r + 0.5) * CELL;
    ctx.fillStyle = ok ? 'rgba(120,255,170,.10)' : 'rgba(255,90,90,.12)'; ctx.strokeStyle = ok ? 'rgba(120,255,170,.7)' : 'rgba(255,90,90,.7)'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(x, y, T.range, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.globalAlpha = 0.8; ctx.fillStyle = T.color; ctx.beginPath(); ctx.arc(x, y, 13, 0, TAU); ctx.fill(); ctx.globalAlpha = 1;
  }
  if (g.hurt > 0) { ctx.fillStyle = `rgba(255,40,60,${g.hurt * 0.28})`; ctx.fillRect(cam.x, cam.y, cw / cam.z, ch / cam.z); }
}

function drawTowers(g, ctx, vx0, vy0, vx1, vy1) {
  const ts = g.towers;
  for (let n = 0; n < ts.length; n++) {
    const t = ts[n];
    if (t.x < vx0 - 30 || t.x > vx1 + 30 || t.y < vy0 - 30 || t.y > vy1 + 30) continue;
    const T = TOWERS[t.kind];
    ctx.fillStyle = '#1b2735'; ctx.fillRect(t.col * CELL + 3, t.row * CELL + 3, CELL - 6, CELL - 6);
    ctx.strokeStyle = '#2f4258'; ctx.lineWidth = 1; ctx.strokeRect(t.col * CELL + 3.5, t.row * CELL + 3.5, CELL - 7, CELL - 7);
    ctx.strokeStyle = '#d6e2f0'; ctx.lineWidth = 3 + T.r * 0.4; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(t.x, t.y); ctx.lineTo(t.x + Math.cos(t.ang) * 16, t.y + Math.sin(t.ang) * 16); ctx.stroke();
    ctx.fillStyle = T.color; ctx.beginPath(); ctx.arc(t.x, t.y, 10 + (t.kind === 1 ? 2 : 0), 0, TAU); ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,.28)'; ctx.beginPath(); ctx.arc(t.x, t.y, 4.5, 0, TAU); ctx.fill();
    ctx.fillStyle = '#ffcf5a';
    for (let l = 0; l < t.lvl; l++) ctx.fillRect(t.col * CELL + 7 + l * 7, t.row * CELL + CELL - 9, 5, 3);
  }
}

function posAt(g, i, al) {
  let d = g.edist[i] + g.espd[i] * al * STEP; if (d >= PATH.len) d = PATH.len - 1;
  return d | 0;
}

function drawEnemiesBatched(g, ctx, vx0, vy0, vx1, vy1, al, z) {
  const al_ = g.ealive, ty = g.etype, sl = g.eslow, hi = g.eHigh, px = PATH.px, py = PATH.py;
  for (let t = 0; t < ENEMIES.length; t++) {
    const E = ENEMIES[t], r = E.r, rect = r * z < 1.6;
    for (let pass = 0; pass < 2; pass++) {
      ctx.fillStyle = pass ? SLOW_COLOR : E.color; ctx.beginPath(); let any = false;
      for (let i = 0; i < hi; i++) {
        if (!al_[i] || ty[i] !== t || (sl[i] > 0) !== (pass === 1)) continue;
        const k = posAt(g, i, al), x = px[k], y = py[k];
        if (x < vx0 - r || x > vx1 + r || y < vy0 - r || y > vy1 + r) continue;
        if (rect) ctx.rect(x - r, y - r, r * 2, r * 2); else { ctx.moveTo(x + r, y); ctx.arc(x, y, r, 0, TAU); }
        any = true;
      }
      if (any) ctx.fill();
    }
  }
  // health bars: damaged heavies always, everything damaged when the screen is not crowded
  const all = g.nE < 400 && z > 0.5;
  ctx.fillStyle = 'rgba(0,0,0,.6)'; ctx.beginPath(); let any = false;
  for (let i = 0; i < hi; i++) {
    if (!al_[i] || g.ehp[i] >= g.emax[i] || (!all && ty[i] !== 2 && ty[i] !== 4)) continue;
    const k = posAt(g, i, al), x = px[k], y = py[k], r = ENEMIES[ty[i]].r;
    if (x < vx0 - r || x > vx1 + r || y < vy0 - r || y > vy1 + r) continue;
    ctx.rect(x - r, y - r - 6, r * 2, 3); any = true;
  }
  if (any) ctx.fill();
  ctx.fillStyle = '#7dff9a'; ctx.beginPath(); any = false;
  for (let i = 0; i < hi; i++) {
    if (!al_[i] || g.ehp[i] >= g.emax[i] || (!all && ty[i] !== 2 && ty[i] !== 4)) continue;
    const k = posAt(g, i, al), x = px[k], y = py[k], r = ENEMIES[ty[i]].r;
    if (x < vx0 - r || x > vx1 + r || y < vy0 - r || y > vy1 + r) continue;
    ctx.rect(x - r, y - r - 6, r * 2 * (g.ehp[i] / g.emax[i]), 3); any = true;
  }
  if (any) ctx.fill();
}

// Deliberately naive path (the "initial implementation"): state changes + shadow + 3 draw calls per enemy.
function drawEnemiesNaive(g, ctx, vx0, vy0, vx1, vy1, al) {
  for (let i = 0; i < g.eHigh; i++) {
    if (!g.ealive[i]) continue;
    const E = ENEMIES[g.etype[i]], k = posAt(g, i, al), x = PATH.px[k], y = PATH.py[k];
    ctx.save(); ctx.translate(x, y);
    ctx.shadowColor = E.color; ctx.shadowBlur = 6;
    ctx.fillStyle = g.eslow[i] > 0 ? SLOW_COLOR : E.color;
    ctx.beginPath(); ctx.arc(0, 0, E.r, 0, TAU); ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(0,0,0,.6)'; ctx.fillRect(-E.r, -E.r - 6, E.r * 2, 3);
    ctx.fillStyle = '#7dff9a'; ctx.fillRect(-E.r, -E.r - 6, E.r * 2 * (g.ehp[i] / g.emax[i]), 3);
    ctx.restore();
  }
}

function drawProjectiles(g, ctx, batch, vx0, vy0, vx1, vy1) {
  const np = g.np;
  if (batch) {
    for (let kind = 0; kind < TOWERS.length; kind++) {
      const T = TOWERS[kind]; ctx.fillStyle = T.color; ctx.beginPath(); let any = false;
      for (let k = 0; k < np; k++) {
        if (g.pkind[k] !== kind) continue;
        const x = g.px[k], y = g.py[k];
        if (x < vx0 || x > vx1 || y < vy0 || y > vy1) continue;
        ctx.moveTo(x + T.r, y); ctx.arc(x, y, T.r, 0, TAU); any = true;
      }
      if (any) ctx.fill();
    }
  } else {
    for (let k = 0; k < np; k++) {
      const T = TOWERS[g.pkind[k]]; ctx.save(); ctx.shadowColor = T.color; ctx.shadowBlur = 8; ctx.fillStyle = T.color;
      ctx.beginPath(); ctx.arc(g.px[k], g.py[k], T.r, 0, TAU); ctx.fill(); ctx.restore();
    }
  }
}