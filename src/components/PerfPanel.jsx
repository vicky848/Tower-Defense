import React from 'react';
import { game, meter } from '../engine/shared.js';
import { MAXE } from '../engine/game.js';

export default function PerfPanel({ s, perf, cap, setCap, opts, setOpts, sc, setSc }) {
  const setOpt = (k) => { game.opts[k] = !game.opts[k]; setOpts({ ...game.opts }); };
  const preset = (v) => { for (const k in game.opts) game.opts[k] = v; setOpts({ ...game.opts }); };
  const done = cap && cap !== 'running';
  return (
    <div className="perf">
      <b>Performance</b>
      <table><tbody>
        <tr><td>FPS (avg)</td><td className={perf && perf.fps < 45 ? 'bad' : 'good'}>{perf ? perf.fps.toFixed(1) : '…'}</td></tr>
        <tr><td>Frame p95 / p99</td><td className={perf && perf.p95 > 22.2 ? 'bad' : ''}>{perf ? `${perf.p95.toFixed(1)} / ${perf.p99.toFixed(1)} ms` : '…'}</td></tr>
        <tr><td>Frames &gt;22.2ms (&lt;45fps)</td><td className={perf && perf.over22 > 5 ? 'bad' : ''}>{perf ? perf.over22.toFixed(1) + '%' : '…'}</td></tr>
        <tr><td>Frames &gt;33ms</td><td className={perf && perf.over33 > 5 ? 'bad' : ''}>{perf ? perf.over33.toFixed(1) + '%' : '…'}</td></tr>
        <tr><td>Worst frame</td><td>{perf ? perf.worst.toFixed(1) + ' ms' : '…'}</td></tr>
        <tr><td>JS heap</td><td>{perf && perf.heap ? perf.heap.toFixed(1) + ' MB' : 'n/a (Chrome only)'}</td></tr>
        <tr><td>Enemies / Towers / Projectiles</td><td>{s.nE} / {s.nT} / {s.nP}</td></tr>
      </tbody></table>
      <h4>Optimisations (toggle live)</h4>
      {[['grid', 'Spatial hash targeting'], ['batch', 'Batched draw calls'], ['cull', 'Viewport culling'], ['cache', 'Cached static map']].map(([k, l]) =>
        <label key={k}><span>{l}</span><input type="checkbox" checked={opts[k]} onChange={() => setOpt(k)} /></label>)}
      <div className="btns"><button onClick={() => preset(false)}>All off (naive)</button><button onClick={() => preset(true)}>All on</button></div>
      <h4>Stress scenario</h4>
      {[['e', 'Enemies', 0, MAXE, 250], ['t', 'Towers', 0, 200, 5], ['p', 'Projectiles', 0, 2600, 50]].map(([k, l, mn, mx, st]) =>
        <label key={k}><span>{l}: {sc[k]}</span><input type="range" min={mn} max={mx} step={st} value={sc[k]} onChange={(e) => setSc({ ...sc, [k]: +e.target.value })} /></label>)}
      <div className="btns">
        <button onClick={() => { game.applyStress(sc); meter.reset(); }}>Apply</button>
        <button onClick={() => { const c = { e: 5000, t: 100, p: 1000 }; setSc(c); game.applyStress(c); meter.reset(); }}>5000/100/1000</button>
        <button onClick={() => meter.reset()}>Reset stats</button>
      </div>
      <h4>10-second capture</h4>
      <div className="btns">
        <button onClick={() => { meter.startCapture(10, performance.now()); setCap('running'); }}>Capture</button>
        {done && <button onClick={() => navigator.clipboard?.writeText(`| ${s.nE} | ${s.nT} | ${s.nP} | ${cap.fps.toFixed(1)} | ${cap.p95.toFixed(1)} | ${cap.over33.toFixed(1)}% | ${cap.worst.toFixed(1)} |`)}>Copy table row</button>}
      </div>
      {cap === 'running' && <p>Capturing…</p>}
      {done && <table><tbody>
        <tr><td>FPS avg</td><td>{cap.fps.toFixed(1)}</td></tr><tr><td>p95 / p99 ms</td><td>{cap.p95.toFixed(1)} / {cap.p99.toFixed(1)}</td></tr>
        <tr><td>&gt;22.2ms / &gt;33ms</td><td>{cap.over22.toFixed(1)}% / {cap.over33.toFixed(1)}%</td></tr><tr><td>Frames</td><td>{cap.n}</td></tr></tbody></table>}
    </div>
  );
}