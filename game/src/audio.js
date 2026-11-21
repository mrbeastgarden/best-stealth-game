// Shadow Vault — sound: everything synthesized with WebAudio, no files.
// Footsteps tell you where guards are (a soft tick each step, lower when a
// guard is near); a two-tone sting marks the alarm, a chime the relic.

export class SoundFX {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.master = null;
  }

  // Called from the first user gesture: browsers need one before audio runs.
  ensure() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.5;
      this.master.connect(this.ctx.destination);
    } catch {
      this.ctx = null;
    }
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.master) this.master.gain.value = this.muted ? 0 : 0.5;
    return this.muted;
  }

  tone(freq, dur, type, volume, when = 0, slideTo = null) {
    if (!this.ctx || this.muted) return;
    if (this.ctx.state === 'suspended') this.ctx.resume();
    const t0 = this.ctx.currentTime + when;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
    gain.gain.setValueAtTime(0, t0);
    gain.gain.linearRampToValueAtTime(volume, t0 + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    osc.connect(gain);
    gain.connect(this.master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  }

  // Short filtered-noise tick, like a soft footstep on stone.
  step(running) {
    if (!this.ctx || this.muted) return;
    if (this.ctx.state === 'suspended') this.ctx.resume();
    const t0 = this.ctx.currentTime;
    const dur = 0.05;
    const buffer = this.ctx.createBuffer(1, this.ctx.sampleRate * dur, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
    }
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = running ? 900 : 500;
    const gain = this.ctx.createGain();
    gain.gain.value = running ? 0.25 : 0.12;
    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    src.start(t0);
  }

  // A guard heard something: one low note, so the player knows they are near.
  suspicious() {
    this.tone(196, 0.18, 'sine', 0.18);
  }

  // The alarm: two rising notes. The player has a moment to break sight.
  alarm() {
    this.tone(311, 0.16, 'square', 0.16);
    this.tone(466, 0.28, 'square', 0.16, 0.14);
  }

  pickup() {
    this.tone(880, 0.12, 'sine', 0.2);
    this.tone(1318, 0.22, 'sine', 0.2, 0.1);
  }

  levelClear() {
    this.tone(523, 0.14, 'triangle', 0.2);
    this.tone(659, 0.14, 'triangle', 0.2, 0.12);
    this.tone(784, 0.3, 'triangle', 0.22, 0.24);
  }

  win() {
    [523, 659, 784, 1046].forEach((f, i) => this.tone(f, 0.3, 'triangle', 0.2, i * 0.13));
  }

  caught() {
    this.tone(220, 0.5, 'sawtooth', 0.18, 0, 55);
  }
}
