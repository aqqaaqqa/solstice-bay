// Synthesised sound only: no audio files, nothing fetched. Engine hum,
// two-tone siren, gunshots, UI blips and three procedural radio stations
// built from small note loops. Everything is guarded so a blocked audio
// context never breaks the game.
import { RADIO } from './config.js';

const SCALES = [
  [220, 261.6, 293.7, 329.6, 392, 440],
  [174.6, 207.7, 233.1, 261.6, 311.1, 349.2],
  [261.6, 311.1, 349.2, 392, 466.2, 523.3],
];

export function createAudio() {
  let ctx = null;
  let master = null;
  let engineOsc = null;
  let engineGain = null;
  let sirenOsc = null;
  let sirenGain = null;
  let radioTimer = 0;
  let radioStep = 0;
  let radioOn = false;
  let station = 0;
  let muted = false;
  let sirenOn = false;
  let sirenPhase = 0;

  function ensure() {
    if (ctx) {
      if (ctx.state === 'suspended') ctx.resume().catch(() => {});
      return true;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : 0.32;
      master.connect(ctx.destination);
      engineOsc = ctx.createOscillator();
      engineOsc.type = 'sawtooth';
      engineOsc.frequency.value = 55;
      engineGain = ctx.createGain();
      engineGain.gain.value = 0;
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 420;
      engineOsc.connect(filter);
      filter.connect(engineGain);
      engineGain.connect(master);
      engineOsc.start();
      sirenOsc = ctx.createOscillator();
      sirenOsc.type = 'square';
      sirenOsc.frequency.value = 700;
      sirenGain = ctx.createGain();
      sirenGain.gain.value = 0;
      sirenOsc.connect(sirenGain);
      sirenGain.connect(master);
      sirenOsc.start();
      return true;
    } catch {
      ctx = null;
      return false;
    }
  }

  function blip(freq, dur, type, vol) {
    if (!ctx || muted) return;
    try {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = type || 'sine';
      o.frequency.value = freq;
      g.gain.setValueAtTime(vol || 0.25, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
      o.connect(g);
      g.connect(master);
      o.start();
      o.stop(ctx.currentTime + dur);
    } catch {
      // A failed blip is never worth crashing the frame for.
    }
  }

  function radioNote() {
    if (!ctx || muted || !radioOn) return;
    try {
      const scale = SCALES[station % SCALES.length];
      const note = scale[radioStep % scale.length];
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'triangle';
      o.frequency.value = note * (radioStep % 8 === 6 ? 0.5 : 1);
      g.gain.setValueAtTime(0.12, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.34);
      o.connect(g);
      g.connect(master);
      o.start();
      o.stop(ctx.currentTime + 0.36);
      radioStep += 1;
    } catch {
      // Ignore.
    }
  }

  return {
    ensure,
    setMuted(m) {
      muted = m;
      if (master) master.gain.value = m ? 0 : 0.32;
    },
    setStation(i) {
      station = i % RADIO.length;
      radioStep = 0;
    },
    stationName() { return RADIO[station % RADIO.length].name; },
    setRadio(on) { radioOn = on; },
    engine(speed01, driving) {
      if (!ctx || !engineOsc) return;
      try {
        engineGain.gain.value = driving ? 0.05 + speed01 * 0.09 : 0.015;
        engineOsc.frequency.value = 52 + speed01 * 130;
      } catch {
        // Ignore.
      }
    },
    siren(on) {
      sirenOn = on;
      if (!ctx || !sirenGain) return;
      try {
        sirenGain.gain.value = on && !muted ? 0.045 : 0;
      } catch {
        // Ignore.
      }
    },
    update(dt) {
      if (!ctx) return;
      if (sirenOn) {
        sirenPhase += dt;
        try {
          sirenOsc.frequency.value = Math.floor(sirenPhase / 0.42) % 2 === 0 ? 715 : 932;
        } catch {
          // Ignore.
        }
      }
      if (radioOn) {
        radioTimer -= dt;
        if (radioTimer <= 0) {
          radioTimer = 0.24;
          radioNote();
        }
      }
    },
    gunshot() { blip(160, 0.14, 'square', 0.4); blip(90, 0.2, 'sawtooth', 0.3); },
    punch() { blip(120, 0.08, 'sine', 0.3); },
    blip() { blip(880, 0.09, 'sine', 0.2); },
    jingle() {
      blip(523, 0.12, 'sine', 0.25);
      setTimeout(() => blip(659, 0.12, 'sine', 0.25), 130);
      setTimeout(() => blip(784, 0.22, 'sine', 0.25), 260);
    },
    busted() {
      blip(392, 0.3, 'square', 0.25);
      setTimeout(() => blip(311, 0.5, 'square', 0.25), 300);
    },
  };
}
