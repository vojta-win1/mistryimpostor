// Přepínání obrazovek (<section data-screen="…">) s přechody.

const screens = new Map(
  [...document.querySelectorAll('[data-screen]')].map((el) => [el.dataset.screen, el]),
);
const enterHandlers = new Map();
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
let current = null;

/** Zaregistruje funkci, která se zavolá při každém zobrazení obrazovky. */
export function onEnter(name, handler) {
  enterHandlers.set(name, handler);
}

export function currentScreen() {
  return current;
}

/**
 * Zobrazí obrazovku.
 * @param {string} name
 * @param {object} [opts]
 * @param {'forward'|'back'|'fade'} [opts.dir]  směr přechodu
 * @param {Node[]} [opts.content]  nový obsah slotu – vloží se až uvnitř přechodu,
 *   takže funguje i přechod obrazovky samé na sebe (další hráč)
 */
export function show(name, { dir = 'forward', content } = {}) {
  const screen = screens.get(name);
  if (!screen) throw new Error(`Neznámá obrazovka: ${name}`);

  const swap = () => {
    if (content) render(name, ...content);
    for (const [key, el] of screens) el.hidden = key !== name;
    current = name;
    window.scrollTo(0, 0);
    enterHandlers.get(name)?.(screen);
  };

  const first = current === null;
  if (first || reducedMotion.matches) {
    swap();
  } else if (document.startViewTransition) {
    document.documentElement.dataset.nav = dir;
    const vt = document.startViewTransition(swap);
    // Přerušený přechod (reload, skrytá karta prohlížeče) není chyba – obsah se prohodí tak jako tak.
    vt.ready.catch(() => {});
    vt.finished.catch(() => {});
  } else {
    swap();
    screen.classList.remove('enter-forward', 'enter-back', 'enter-fade');
    void screen.offsetWidth; // restart animace
    screen.classList.add(`enter-${dir}`);
  }
  return screen;
}

/** Vymění obsah slotu `data-slot="content"` na obrazovce (bez přechodu). */
export function render(name, ...children) {
  const slot = screens.get(name).querySelector('[data-slot="content"]');
  slot.replaceChildren(...children.flat().filter(Boolean));
  return slot;
}

document.addEventListener('click', (e) => {
  const target = e.target.closest('[data-go]');
  if (target) show(target.dataset.go, { dir: target.dataset.dir });
});
