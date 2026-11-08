// One shared game, perf meter and camera used by the whole UI.
import { Game } from './game.js';
import { PerfMeter } from './perf.js';
import { W, H } from '../data/config.js';
export const game = new Game();
export const meter = new PerfMeter();
export const cam = { x: 0, y: 0, z: 1, fit: 1, init: false, cw: 1, ch: 1 };
export const clampCam = () => {
  const vw = cam.cw / cam.z, vh = cam.ch / cam.z;
  cam.x = vw >= W ? (W - vw) / 2 : Math.max(0, Math.min(W - vw, cam.x));
  cam.y = vh >= H ? (H - vh) / 2 : Math.max(0, Math.min(H - vh, cam.y));
};