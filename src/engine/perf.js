// Frame-time meter: ring buffer (rolling 600 frames) + timed capture window. No per-frame allocation.
export class PerfMeter {
  constructor() {
    this.N = 600; this.buf = new Float32Array(this.N); this.i = 0; this.n = 0;
    this.cap = new Float32Array(30000); this.capN = 0; this.capUntil = 0; this.capResult = null;
  }
  push(ms, now) {
    this.buf[this.i] = ms; this.i = (this.i + 1) % this.N; if (this.n < this.N) this.n++;
    if (this.capUntil) {
      if (now >= this.capUntil) { this.capResult = this.calc(this.cap, this.capN); this.capUntil = 0; }
      else if (this.capN < this.cap.length) this.cap[this.capN++] = ms;
    }
  }
  startCapture(sec, now) { this.capN = 0; this.capUntil = now + sec * 1000; this.capResult = null; }
  reset() { this.n = 0; this.i = 0; }
  stats() { return this.calc(this.buf, this.n); }
  calc(arr, n) {            // called at ~2 Hz, allocation here is fine
    if (n < 5) return null;
    const s = Float32Array.from(arr.subarray(0, n)).sort();
    let sum = 0, o33 = 0, o22 = 0;
    for (let k = 0; k < n; k++) { sum += s[k]; if (s[k] > 33.4) o33++; if (s[k] > 22.3) o22++; }
    const avg = sum / n;
    return { n, fps: 1000 / avg, avg, p50: s[(n * 0.5) | 0], p95: s[Math.min(n - 1, (n * 0.95) | 0)], p99: s[Math.min(n - 1, (n * 0.99) | 0)],
      over33: 100 * o33 / n, over22: 100 * o22 / n, worst: s[n - 1] };
  }
}