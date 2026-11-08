// The <canvas>: runs the single animation loop, handles resize, mouse, wheel and keyboard.
import React, { useEffect, useRef } from 'react';
import { game, meter, cam, clampCam } from '../engine/shared.js';
import { render } from '../engine/render.js';
import { COLS, ROWS, CELL, W, H } from '../data/config.js';

export default function GameCanvas({ onTogglePerf }) {
  const wrap = useRef(null), cv = useRef(null);

  useEffect(() => {
    const canvas = cv.current, ctx = canvas.getContext('2d', { alpha: false });
    let raf, last = performance.now(), dpr = 1;
    const resize = () => {
      const r = wrap.current.getBoundingClientRect(); dpr = Math.min(2, window.devicePixelRatio || 1);
      cam.cw = r.width; cam.ch = r.height; canvas.width = Math.round(r.width * dpr); canvas.height = Math.round(r.height * dpr);
      canvas.style.width = r.width + 'px'; canvas.style.height = r.height + 'px';
      const fit = Math.min(r.width / W, r.height / H);
      if (!cam.init) { cam.z = fit; cam.init = true; } else if (cam.z < fit || cam.z === cam.fit) cam.z = fit;
      cam.fit = fit; clampCam();
    };
    resize(); const ro = new ResizeObserver(resize); ro.observe(wrap.current);
    const loop = (now) => {
      const dt = now - last; last = now; meter.push(dt, now);
      game.frame(dt / 1000); render(game, ctx, cam, cam.cw, cam.ch, dpr);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(raf); ro.disconnect(); };
  }, []);

  useEffect(() => {
    const canvas = cv.current; let drag = null;
    const world = (e) => { const r = canvas.getBoundingClientRect(); return [cam.x + (e.clientX - r.left) / cam.z, cam.y + (e.clientY - r.top) / cam.z]; };
    const cellOf = (e) => { const [wx, wy] = world(e); return { c: Math.floor(wx / CELL), r: Math.floor(wy / CELL) }; };
    const down = (e) => { drag = { x: e.clientX, y: e.clientY, cx: cam.x, cy: cam.y, moved: false, btn: e.button }; canvas.setPointerCapture(e.pointerId); };
    const move = (e) => {
      game.hover = cellOf(e);
      if (!drag) return;
      const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
      if (drag.btn !== 0 || Math.hypot(dx, dy) > 6) drag.moved = true;
      if (drag.moved && (drag.btn !== 0 || game.placing < 0)) { cam.x = drag.cx - dx / cam.z; cam.y = drag.cy - dy / cam.z; clampCam(); }
    };
    const up = (e) => {
      if (!drag) return; const d = drag; drag = null;
      if (d.btn === 2 && !d.moved) { game.placing = -1; game.selected = null; return; }
      if (d.btn !== 0 || d.moved) return;
      const { c, r } = cellOf(e);
      if (game.placing >= 0) game.place(game.placing, c, r);
      else game.selected = (c >= 0 && r >= 0 && c < COLS && r < ROWS && game.occ[r * COLS + c]) || null;
    };
    const wheel = (e) => {
      e.preventDefault(); const r = canvas.getBoundingClientRect(), px = e.clientX - r.left, py = e.clientY - r.top;
      const wx = cam.x + px / cam.z, wy = cam.y + py / cam.z;
      cam.z = Math.max(cam.fit, Math.min(cam.fit * 4, cam.z * Math.exp(-e.deltaY * 0.0015)));
      cam.x = wx - px / cam.z; cam.y = wy - py / cam.z; clampCam();
    };
    const key = (e) => {
      if (e.target.tagName === 'INPUT') return;
      const k = e.key.toLowerCase();
      if (k >= '1' && k <= '4') game.placing = game.placing === +k - 1 ? -1 : +k - 1;
      else if (k === ' ') { e.preventDefault(); game.togglePause(); }
      else if (k === 'escape') { game.placing = -1; game.selected = null; }
      else if (k === 'u') game.upgrade(game.selected);
      else if (k === 's') game.sell(game.selected);
      else if (k === 'n') game.startWave();
      else if (k === 'p') onTogglePerf();
    };
    const leave = () => { game.hover = null; }, ctx = (e) => e.preventDefault();
    canvas.addEventListener('pointerdown', down); canvas.addEventListener('pointermove', move); canvas.addEventListener('pointerup', up);
    canvas.addEventListener('pointerleave', leave); canvas.addEventListener('wheel', wheel, { passive: false }); canvas.addEventListener('contextmenu', ctx);
    window.addEventListener('keydown', key);
    return () => {
      window.removeEventListener('keydown', key);
      canvas.removeEventListener('pointerdown', down); canvas.removeEventListener('pointermove', move); canvas.removeEventListener('pointerup', up);
      canvas.removeEventListener('pointerleave', leave); canvas.removeEventListener('wheel', wheel); canvas.removeEventListener('contextmenu', ctx);
    };
  }, [onTogglePerf]);

  return <div className="canvas-wrap" ref={wrap}><canvas ref={cv} /></div>;
}