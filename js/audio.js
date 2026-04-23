/**
 * AUDIO ENGINE — Web Audio API synthesized sounds.
 * No external files needed.
 */
class AudioEngine {
  constructor() {
    this._ctx = null;
    this.enabled = true;
  }

  _getCtx() {
    if (!this._ctx) this._ctx = new (window.AudioContext || window.webkitAudioContext)();
    return this._ctx;
  }

  _play(freq, type, duration, gain = 0.25, delay = 0) {
    if (!this.enabled) return;
    try {
      const ctx = this._getCtx();
      const t = ctx.currentTime + delay;
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.connect(g); g.connect(ctx.destination);
      osc.type = type;
      osc.frequency.setValueAtTime(freq, t);
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(gain, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.001, t + duration);
      osc.start(t); osc.stop(t + duration + 0.05);
    } catch(e) {}
  }

  move() {
    this._play(440, 'sine', 0.12, 0.18);
    this._play(660, 'sine', 0.08, 0.10, 0.06);
  }

  capture() {
    this._play(220, 'sawtooth', 0.05, 0.2);
    this._play(180, 'sine',     0.15, 0.18, 0.04);
    this._play(140, 'sine',     0.12, 0.12, 0.10);
  }

  check() {
    this._play(880, 'square', 0.08, 0.15);
    this._play(660, 'square', 0.12, 0.12, 0.08);
  }

  castle() {
    this._play(523, 'sine', 0.1, 0.2);
    this._play(659, 'sine', 0.1, 0.2, 0.08);
    this._play(784, 'sine', 0.15, 0.2, 0.16);
  }

  gameOver(win) {
    if (win) {
      [523, 659, 784, 1047].forEach((f, i) => this._play(f, 'sine', 0.3, 0.2, i * 0.12));
    } else {
      [392, 330, 262].forEach((f, i) => this._play(f, 'sine', 0.4, 0.2, i * 0.18));
    }
  }

  toggle() {
    this.enabled = !this.enabled;
    return this.enabled;
  }
}
