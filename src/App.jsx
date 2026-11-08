// App = state holder. Game logic lives in engine/, tunable numbers in data/, UI pieces in components/.
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { game, meter } from './engine/shared.js';
import GameCanvas from './components/GameCanvas.jsx';
import TopBar from './components/TopBar.jsx';
import Shop from './components/Shop.jsx';
import PerfPanel from './components/PerfPanel.jsx';
import { MenuOverlay, EndOverlay } from './components/Overlays.jsx';

export default function App() {
  const [s, setS] = useState(game.snapshot());
  const [perf, setPerf] = useState(null);
  const [cap, setCap] = useState(null);
  const [showPerf, setShowPerf] = useState(false);
  const [opts, setOpts] = useState({ ...game.opts });
  const [sc, setSc] = useState({ e: 5000, t: 100, p: 1000 });
  const showRef = useRef(false); showRef.current = showPerf;
  const togglePerf = useCallback(() => setShowPerf(v => !v), []);

  // one timer refreshes the HUD 10x per second (the canvas itself runs on requestAnimationFrame)
  useEffect(() => {
    const id = setInterval(() => {
      setS(game.snapshot());
      if (showRef.current) {
        const m = performance.memory;
        const st = meter.stats();
setPerf(st ? { ...st, heap: m ? m.usedJSHeapSize / 1048576 : null } : null);
        setCap(meter.capResult || (meter.capUntil ? 'running' : null));
      }
    }, 100);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="app">
      <TopBar s={s} showPerf={showPerf} onTogglePerf={togglePerf} />
      <div className="stage">
        <GameCanvas onTogglePerf={togglePerf} />
        {s.toast && <div className="toast">{s.toast}</div>}
        {s.state === 'playing' && !s.stress && s.wave === 0 && <div className="banner">Pick a tower below (1–4), click the grass to build. Scroll to zoom, drag to pan.</div>}
        {s.paused && <div className="banner">Paused — press Space to resume</div>}
        {s.state === 'menu' && <MenuOverlay onStress={() => { game.applyStress(sc); setShowPerf(true); }} />}
        {(s.state === 'won' || s.state === 'lost') && <EndOverlay s={s} />}
        {showPerf && <PerfPanel s={s} perf={perf} cap={cap} setCap={setCap} opts={opts} setOpts={setOpts} sc={sc} setSc={setSc} />}
      </div>
      <Shop s={s} />
    </div>
  );
}