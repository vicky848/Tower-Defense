# Bastion — Tower Defense (React + Canvas2D)

50-wave browser tower defense. No backend, no external services.
Run: `npm install && npm run dev` · Build: `npm run build`

## Gameplay
4 towers (Gunner, Cannon, Frost, Railgun), 4 levels each, 70% sell refund. 5 enemies (Grunt, Runner, Tank, Swarm, Boss). 50 waves, pause/restart/1x-2x-4x speed, score, victory and game-over screens.

## Architecture
- src/data/config.js: all tunable data (map, towers, enemies, wave generator, balance curves)
- src/engine/game.js: simulation, no DOM. Typed-array pools, spatial hash, fixed timestep
- src/engine/render.js: Canvas2D renderer (cached map, batching, culling)
- src/engine/perf.js: frame-time meter (p95, % frames >33ms)
- src/components + App.jsx: React HUD only. Polled every 100 ms; the canvas runs on its own requestAnimationFrame loop.

## Design decisions
- One rAF loop, no per-entity timers.
- Fixed 1/60 s timestep with accumulator, so behaviour is the same on 60/120/144 Hz displays. Enemy drawing is extrapolated along the path for smooth motion.
- Enemies are struct-of-arrays (typed arrays, free list, generation counter). Projectiles use dense pools with swap-remove. No per-frame allocation, so memory stays flat.
- Enemies store only path distance; position = lookup table read.
- Difficulty: HP multiplier 1 + 0.25n + 0.016n^2 (about 53x at wave 50), new enemy types and bigger groups as waves increase.

## Rendering approach
Static map drawn once to an offscreen canvas and blitted. Enemies and projectiles are batched: one path and one fill per colour. Off-screen entities are culled using the camera viewport (zoom with the wheel, pan by dragging).

## Bottlenecks
1. Per-entity canvas state changes (save/restore/shadowBlur/arc/fill) = thousands of draw calls.
2. Redrawing the static map every frame.
3. O(towers x enemies) targeting and O(projectiles x enemies) splash.
4. GC from per-object allocation.
5. Drawing off-screen entities.

## Optimizations
Cached static layer, colour-batched paths, viewport culling, spatial hash (64 px cells) for targeting and splash, typed-array pools, fixed-step loop, React kept out of the hot path. Each of the first four can be toggled live in the Perf panel (press P).

## How performance was measured
Perf panel (key P): frame deltas from requestAnimationFrame go into a ring buffer. It shows avg FPS, p95/p99 frame time, % frames over 22.2 ms and 33 ms, JS heap (Chrome), and entity counts. "Capture" records 10 s. Stress sliders set enemies/towers/projectiles; the preset is 5000/100/1000. Results are in NUMBERS.md.