import React from 'react';
import { game } from '../engine/shared.js';
import { TOWERS, ENEMIES, TOTAL_WAVES, MAX_LEVEL } from '../data/config.js';
const fmt = (n) => Math.floor(n).toLocaleString();

export function MenuOverlay({ onStress }) {
  return (
    <div className="overlay"><div className="card">
      <h1>Bastion</h1>
      <p>Hold the keep for {TOTAL_WAVES} waves. Build towers on open ground, upgrade them up to level {MAX_LEVEL + 1}, and sell the ones you outgrow for 70% back.</p>
      <div className="legend">{ENEMIES.map(e => <div key={e.name}><i style={{ background: e.color }} /><span><b>{e.name}</b> — {e.note}</span></div>)}</div>
      <div className="legend">{TOWERS.map((t, i) => <div key={t.name}><i style={{ background: t.color, borderRadius: 3 }} /><span><b>{i + 1}. {t.name}</b> — {t.desc}</span></div>)}</div>
      <p>Keys: 1–4 pick tower · U upgrade · S sell · N next wave · Space pause · P perf panel · Esc cancel</p>
      <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
        <button className="go" style={{ padding: '10px 22px', fontSize: 16 }} onClick={() => game.start()}>Play</button>
        <button onClick={onStress}>Open stress test</button>
      </div>
    </div></div>
  );
}

export function EndOverlay({ s }) {
  const won = s.state === 'won';
  return (
    <div className="overlay"><div className="card" style={{ textAlign: 'center' }}>
      <h1>{won ? 'Victory!' : 'The keep has fallen'}</h1>
      <p>{won ? `All ${TOTAL_WAVES} waves repelled with ${s.lives} lives to spare.` : `You held out until wave ${s.wave}.`}</p>
      <div className="big">{fmt(s.score)}</div><p>score · {s.kills.toLocaleString()} enemies defeated</p>
      <button className="go" style={{ padding: '10px 22px', fontSize: 16, marginTop: 8 }} onClick={() => { game.reset(); game.start(); }}>Play again</button>
    </div></div>
  );
}