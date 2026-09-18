// Zvukové efekty syntetizované přes Web Audio API – žádné soubory.

const STORAGE_KEY = 'mistryimpostor.muted';
const listeners = new Set();

let ctx = null;
let master = null;
let noiseBuffer = null;
let muted = loadMuted();

function loadMuted() {
  try {
    return localStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

export function isMuted() {
  return muted;
}

export function setMuted(value) {
  muted = Boolean(value);
  try {
    localStorage.setItem(STORAGE_KEY, muted ? '1' : '0');
  } catch {
    // Bez úložiště platí jen do reloadu.
  }
  for (const fn of listeners) fn(muted);
}

export function onMutedChange(fn) {
  listeners.add(fn);
}

/**
 * AudioContext smí vzniknout až po gestu uživatele (autoplay policy),
 * proto se vytváří při prvním dotyku/klávese.
 */
function unlock() {
  if (!ctx) {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    ctx = new AudioCtx();
    master = ctx.createGain();
    master.gain.value = 0.5;
    master.connect(ctx.destination);
  }
  if (ctx.state === 'suspended') ctx.resume();
}

for (const type of ['pointerdown', 'keydown']) {
  document.addEventListener(type, unlock, { capture: true, passive: true });
}

function ready() {
  return !muted && ctx && ctx.state === 'running';
}

// ---------- stavební kameny ----------

function tone({ freq, freqEnd, type = 'sine', at = 0, dur = 0.1, gain = 0.3, attack = 0.005 }) {
  const t = ctx.currentTime + at;
  const osc = ctx.createOscillator();
  const env = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  if (freqEnd) osc.frequency.exponentialRampToValueAtTime(freqEnd, t + dur);
  env.gain.setValueAtTime(0.0001, t);
  env.gain.exponentialRampToValueAtTime(gain, t + attack);
  env.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(env).connect(master);
  osc.start(t);
  osc.stop(t + dur + 0.02);
}

function noise({ at = 0, dur = 0.2, from = 2000, to = 500, q = 1.2, gain = 0.25 }) {
  if (!noiseBuffer) {
    noiseBuffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  }
  const t = ctx.currentTime + at;
  const src = ctx.createBufferSource();
  const filter = ctx.createBiquadFilter();
  const env = ctx.createGain();
  src.buffer = noiseBuffer;
  filter.type = 'bandpass';
  filter.Q.value = q;
  filter.frequency.setValueAtTime(from, t);
  filter.frequency.exponentialRampToValueAtTime(to, t + dur);
  env.gain.setValueAtTime(0.0001, t);
  env.gain.exponentialRampToValueAtTime(gain, t + dur * 0.25);
  env.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(filter).connect(env).connect(master);
  src.start(t);
  src.stop(t + dur + 0.02);
}

function play(fn) {
  return () => {
    if (!ready()) return;
    try {
      fn();
    } catch {
      // Zvuk nikdy nesmí shodit hru.
    }
  };
}

// ---------- efekty ----------

export const sound = {
  tap: play(() => tone({ freq: 620, freqEnd: 520, dur: 0.05, gain: 0.12 })),

  flip: play(() => {
    noise({ dur: 0.14, from: 1200, to: 3200, gain: 0.12 });
    tone({ freq: 440, freqEnd: 880, type: 'triangle', dur: 0.12, gain: 0.08 });
  }),

  swipe: play(() => noise({ dur: 0.28, from: 3000, to: 400, q: 0.8, gain: 0.3 })),

  tick: play(() => {
    tone({ freq: 880, type: 'triangle', dur: 0.12, gain: 0.3 });
    tone({ freq: 1760, dur: 0.05, gain: 0.08 });
  }),

  reveal: play(() => {
    // Krátká fanfára: arpeggio C dur a držený akord.
    [523.25, 659.25, 783.99].forEach((f, i) => tone({ freq: f, type: 'triangle', at: i * 0.09, dur: 0.18, gain: 0.25 }));
    [523.25, 659.25, 783.99, 1046.5].forEach((f) => tone({ freq: f, type: 'sawtooth', at: 0.28, dur: 0.9, gain: 0.06, attack: 0.02 }));
    tone({ freq: 1046.5, type: 'triangle', at: 0.28, dur: 0.9, gain: 0.2, attack: 0.02 });
    noise({ at: 0.28, dur: 0.5, from: 6000, to: 2500, q: 0.6, gain: 0.08 });
  }),

  timerTick: play(() => tone({ freq: 1320, type: 'square', dur: 0.04, gain: 0.06 })),

  timeUp: play(() => {
    [0, 0.22, 0.44].forEach((at) => tone({ freq: 330, freqEnd: 300, type: 'sawtooth', at, dur: 0.18, gain: 0.18 }));
    tone({ freq: 220, type: 'square', at: 0.66, dur: 0.5, gain: 0.12 });
  }),
};
