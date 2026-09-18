// Přepínání obrazovek (<section data-screen="…">).

const screens = new Map(
  [...document.querySelectorAll('[data-screen]')].map((el) => [el.dataset.screen, el]),
);
const enterHandlers = new Map();

/** Zaregistruje funkci, která se zavolá při každém zobrazení obrazovky. */
export function onEnter(name, handler) {
  enterHandlers.set(name, handler);
}

export function show(name) {
  const screen = screens.get(name);
  if (!screen) throw new Error(`Neznámá obrazovka: ${name}`);
  for (const [key, el] of screens) el.hidden = key !== name;
  window.scrollTo(0, 0);
  enterHandlers.get(name)?.(screen);
  return screen;
}

/** Vymění obsah slotu `data-slot="content"` na obrazovce. */
export function render(name, ...children) {
  const slot = screens.get(name).querySelector('[data-slot="content"]');
  slot.replaceChildren(...children.flat().filter(Boolean));
  return slot;
}

document.addEventListener('click', (e) => {
  const target = e.target.closest('[data-go]');
  if (target) show(target.dataset.go);
});
