// Kruhová časomíra v SVG. Klepnutí = pauza/pokračování.
import { el } from './dom.js';
import { sound } from './sound.js';
import { vibrate, PATTERNS } from './haptics.js';

const R = 52;
const CIRCUMFERENCE = 2 * Math.PI * R;
const WARN_FROM = 5; // posledních N sekund tiká

/**
 * @param {object} opts
 * @param {number} opts.duration  s
 * @param {object} [opts.state]  uložený stav { remainingMs, running }
 * @param {(state: {remainingMs: number, running: boolean}) => void} [opts.onChange]
 */
export function ringTimer({ duration, state, onChange }) {
  const total = duration * 1000;
  let remaining = Math.max(0, Math.min(total, state?.remainingMs ?? total));
  let running = state ? state.running && remaining > 0 : true;
  let endsAt = running ? performance.now() + remaining : null;
  let lastSecond = Math.ceil(remaining / 1000);
  let raf = 0;
  let mounted = false; // obsah se vkládá až uvnitř přechodu obrazovky, tj. asynchronně

  const svgNs = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(svgNs, 'svg');
  svg.setAttribute('viewBox', '0 0 120 120');
  svg.setAttribute('aria-hidden', 'true');
  const track = circle('timer-track');
  const progress = circle('timer-progress');
  progress.setAttribute('stroke-dasharray', String(CIRCUMFERENCE));
  svg.append(track, progress);

  const value = el('span', { class: 'timer-value' });
  const status = el('span', { class: 'timer-status' });
  const face = el('button', { class: 'timer-face', type: 'button', onclick: toggle },
    svg, el('span', { class: 'timer-text' }, value, status));
  const restartBtn = el('button', { class: 'btn-link timer-restart', type: 'button', onclick: restart }, 'Znovu');
  const root = el('div', { class: 'timer', role: 'timer' }, face, restartBtn);

  function circle(cls) {
    const c = document.createElementNS(svgNs, 'circle');
    c.setAttribute('class', cls);
    c.setAttribute('cx', '60');
    c.setAttribute('cy', '60');
    c.setAttribute('r', String(R));
    return c;
  }

  function current() {
    return running ? Math.max(0, endsAt - performance.now()) : remaining;
  }

  function paint() {
    const ms = current();
    const secs = Math.ceil(ms / 1000);
    progress.setAttribute('stroke-dashoffset', String(CIRCUMFERENCE * (1 - ms / total)));
    value.textContent = ms > 0 ? String(secs) : 'Čas!';
    status.textContent = ms <= 0 ? 'klepni pro nový start' : running ? 'klepni pro pauzu' : 'pauza';
    root.classList.toggle('is-warning', ms > 0 && secs <= WARN_FROM);
    root.classList.toggle('is-done', ms <= 0);
    root.classList.toggle('is-paused', !running && ms > 0);
    face.setAttribute('aria-label', ms > 0 ? `Zbývá ${secs} s, ${running ? 'běží' : 'pozastaveno'}` : 'Čas vypršel');
  }

  function loop() {
    if (root.isConnected) mounted = true;
    else if (mounted) return stop(); // obrazovka zmizela
    const ms = current();
    const secs = Math.ceil(ms / 1000);
    if (secs !== lastSecond) {
      lastSecond = secs;
      if (secs > 0 && secs <= WARN_FROM) {
        sound.timerTick();
        vibrate(PATTERNS.tap);
      }
    }
    if (running && ms <= 0) {
      running = false;
      remaining = 0;
      endsAt = null;
      sound.timeUp();
      vibrate(PATTERNS.timeUp);
      emit();
    }
    paint();
    if (running) raf = requestAnimationFrame(loop);
    else raf = 0;
  }

  function stop() {
    cancelAnimationFrame(raf);
    raf = 0;
  }

  function emit() {
    onChange?.({ remainingMs: Math.round(current()), running });
  }

  function start() {
    endsAt = performance.now() + remaining;
    running = true;
    lastSecond = Math.ceil(remaining / 1000);
    emit();
    stop();
    raf = requestAnimationFrame(loop);
  }

  function toggle() {
    if (current() <= 0) return restart();
    if (running) {
      remaining = current();
      running = false;
      endsAt = null;
      stop();
      emit();
      paint();
    } else {
      start();
    }
  }

  function restart() {
    remaining = total;
    start();
  }

  paint();
  if (running) {
    raf = requestAnimationFrame(loop);
    emit(); // i automatický start je změna stavu – bez toho by reload začal odznova
  }
  root.snapshot = () => ({ remainingMs: Math.round(current()), running });
  return root;
}
