import React from 'react';
import { game } from '../engine/shared.js';
import { TOTAL_WAVES } from '../data/config.js';
const fmt = (n) => (n >= 1e5 ? '∞' : Math.floor(n).toLocaleString());

export default function TopBar({ s, showPerf, onTogglePerf }) {
  const restart = () => { game.reset(); game.start(); };
  const nextLabel = s.stress ? '—' : s.waveActive ? `Wave ${s.wave} · ${s.left} left` : s.wave === 0 ? 'Start wave 1' : `Next wave ${s.wave + 1}${s.auto ? ` (${s.intermission}s)` : ''}`;
  return (
    <div className="top">
      <div className="brand">🏰 Bastion</div>
      <div className="stat lives"><b>{fmt(s.lives)}</b><span>lives</span></div>
      <div className="stat gold"><b>{fmt(s.gold)}</b><span>gold</span></div>
      <div className="stat"><b>{s.stress ? 'STRESS' : `${s.wave}/${TOTAL_WAVES}`}</b><span>wave</span></div>
      <div className="stat"><b>{fmt(s.score)}</b><span>score</span></div>
      <div className="spacer" />
      <button className="go" disabled={s.stress || s.waveActive || s.state !== 'playing'} onClick={() => game.startWave()}>{nextLabel}</button>
      <button className={s.auto ? 'on' : ''} onClick={() => { game.auto = !game.auto; }} title="Auto-start next wave">Auto</button>
      <button className={s.paused ? 'on' : ''} onClick={() => game.togglePause()} title="Space">{s.paused ? '▶ Resume' : '⏸ Pause'}</button>
      {[1, 2, 4].map(v => <button key={v} className={s.speed === v ? 'on' : ''} onClick={() => game.setSpeed(v)}>{v}×</button>)}
      <button onClick={restart}>↺ Restart</button>
      <button className={showPerf ? 'on' : ''} onClick={onTogglePerf} title="P">Perf</button>
    </div>
  );
}