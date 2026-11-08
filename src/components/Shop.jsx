import React from 'react';
import { game } from '../engine/shared.js';
import { TOWERS, MAX_LEVEL } from '../data/config.js';

export default function Shop({ s }) {
  const sel = s.sel;
  return (
    <div className="shop">
      {TOWERS.map((t, i) => (
        <button key={t.name} className={'tw' + (s.placing === i ? ' sel' : '')} disabled={s.state !== 'playing'}
          onClick={() => { game.placing = game.placing === i ? -1 : i; game.selected = null; }}>
          <i style={{ background: t.color }} />
          <span><b>{i + 1}. {t.name}</b> · <span style={{ color: s.gold >= t.cost ? 'var(--gold)' : 'var(--hp)' }}>{t.cost}g</span><small>{t.desc}</small></span>
        </button>
      ))}
      {sel && (
        <div className="sel-panel">
          <b>{TOWERS[sel.kind].name}</b> · level {sel.lvl + 1}/{MAX_LEVEL + 1}
          <div style={{ color: 'var(--dim)', fontSize: 12 }}>dmg {sel.dmg.toFixed(0)} · {(1 / sel.cd).toFixed(1)}/s · range {sel.range.toFixed(0)}{sel.slow ? ` · slow ${Math.round(sel.slow * 100)}%` : ''}</div>
          <div className="row">
            <button disabled={!sel.up || s.gold < sel.up} onClick={() => game.upgrade(game.selected)}>{sel.up ? `Upgrade ${sel.up}g (U)` : 'Max level'}</button>
            <button onClick={() => game.sell(game.selected)}>Sell +{sel.sell}g (S)</button>
          </div>
        </div>
      )}
    </div>
  );
}