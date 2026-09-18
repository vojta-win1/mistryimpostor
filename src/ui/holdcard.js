// Karta, která ukáže líc jen při držení prstu (nebo mezerníku/Enteru).
import { el } from './dom.js';

const SWIPE_START = 12; // px, od kdy je pohyb swipe a ne držení

/**
 * @param {object} opts
 * @param {Node} opts.front  rub karty (zakrytá strana)
 * @param {Node} opts.back   líc karty (role)
 * @param {string} opts.label  popis pro čtečky
 * @param {() => void} [opts.onOpen]
 * @param {() => void} [opts.onClose]
 * @param {() => boolean} [opts.canSwipe]  smí se kartou teď švihnout doleva?
 * @param {() => void} [opts.onSwipeLeft]  karta odletěla doleva
 */
export function holdCard({ front, back, label, onOpen, onClose, canSwipe, onSwipeLeft }) {
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

  // ---- držení + swipe doleva ----
  let drag = null; // { id, x, y, dx, swiping, allowed }
  let flying = false;

  card.addEventListener('pointerdown', (e) => {
    if (e.button !== 0 || drag || flying) return;
    try {
      card.setPointerCapture(e.pointerId);
    } catch {
      // Syntetické události (testy) nemají aktivní pointer.
    }
    // Povolení se zjišťuje před otočením – první dotyk tak nemůže roli rovnou přeskočit.
    drag = { id: e.pointerId, x: e.clientX, y: e.clientY, dx: 0, swiping: false, allowed: Boolean(canSwipe?.()) };
    card.classList.add('is-dragging');
    setOpen(true);
  });

  card.addEventListener('pointermove', (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    const dx = Math.min(0, e.clientX - drag.x);
    const dy = e.clientY - drag.y;
    if (!drag.swiping && dx < -SWIPE_START && Math.abs(dx) > Math.abs(dy)) {
      drag.swiping = true;
      setOpen(false); // během tažení je karta vždy zakrytá
    }
    if (!drag.swiping) return;
    // Bez povolení (role ještě neviděna) karta jen neochotně pruží.
    drag.dx = drag.allowed ? dx : dx * 0.2;
    card.style.transform = `translateX(${drag.dx}px) rotate(${drag.dx / 25}deg)`;
  });

  function endDrag(e) {
    if (!drag || (e.pointerId !== undefined && e.pointerId !== drag.id)) return;
    const { dx, swiping, allowed } = drag;
    drag = null;
    card.classList.remove('is-dragging');
    setOpen(false);
    if (swiping && allowed && dx < -Math.min(120, card.offsetWidth * 0.3)) flyOut();
    else card.style.transform = '';
  }

  function flyOut() {
    flying = true;
    let called = false;
    const done = () => {
      if (called) return;
      called = true;
      onSwipeLeft?.();
    };
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return done();
    card.classList.add('is-flying');
    card.style.transform = `translateX(-120vw) rotate(-18deg)`;
    // Pozor: transitionend probublává i z otáčení vnitřku karty.
    card.addEventListener('transitionend', (e) => e.target === card && done());
    setTimeout(done, 500); // pojistka, kdyby transitionend nepřišel
  }

  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) {
    card.addEventListener(type, endDrag);
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
