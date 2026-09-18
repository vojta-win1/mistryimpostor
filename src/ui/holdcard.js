// Karta, která ukáže líc jen při držení prstu (nebo mezerníku/Enteru).
import { el } from './dom.js';

/**
 * @param {object} opts
 * @param {Node} opts.front  rub karty (zakrytá strana)
 * @param {Node} opts.back   líc karty (role)
 * @param {string} opts.label  popis pro čtečky
 * @param {() => void} [opts.onOpen]
 * @param {() => void} [opts.onClose]
 */
export function holdCard({ front, back, label, onOpen, onClose }) {
  const inner = el('div', { class: 'flip-inner' },
    el('div', { class: 'flip-face flip-front' }, front),
    el('div', { class: 'flip-face flip-back', 'aria-hidden': 'true' }, back),
  );
  const card = el('div', {
    class: 'flip',
    tabindex: '0',
    role: 'button',
    'aria-label': label,
    'aria-pressed': 'false',
  }, inner);

  let open = false;

  function setOpen(value) {
    if (open === value) return;
    open = value;
    card.classList.toggle('is-open', open);
    card.setAttribute('aria-pressed', String(open));
    inner.lastChild.setAttribute('aria-hidden', String(!open));
    (open ? onOpen : onClose)?.();
  }

  card.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    try {
      card.setPointerCapture(e.pointerId);
    } catch {
      // Syntetické události (testy) nemají aktivní pointer.
    }
    setOpen(true);
  });
  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture', 'pointerleave']) {
    card.addEventListener(type, () => setOpen(false));
  }
  card.addEventListener('contextmenu', (e) => e.preventDefault());

  card.addEventListener('keydown', (e) => {
    if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) {
      e.preventDefault();
      setOpen(true);
    }
  });
  card.addEventListener('keyup', (e) => {
    if (e.key === ' ' || e.key === 'Enter') setOpen(false);
  });
  card.addEventListener('blur', () => setOpen(false));

  // Při přepnutí aplikace kartu zakryj; po odebrání karty z DOM se posluchači sami odhlásí.
  const listeners = new AbortController();
  const hide = () => {
    if (!card.isConnected) return listeners.abort();
    setOpen(false);
  };
  document.addEventListener('visibilitychange', hide, { signal: listeners.signal });
  window.addEventListener('blur', hide, { signal: listeners.signal });

  card.close = hide;
  return card;
}
