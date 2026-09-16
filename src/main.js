// Router obrazovek a bootstrap.

const screens = new Map(
  [...document.querySelectorAll('[data-screen]')].map((el) => [el.dataset.screen, el]),
);

export function show(name) {
  if (!screens.has(name)) throw new Error(`Neznámá obrazovka: ${name}`);
  for (const [key, el] of screens) el.hidden = key !== name;
  window.scrollTo(0, 0);
  return screens.get(name);
}

document.addEventListener('click', (e) => {
  const target = e.target.closest('[data-go]');
  if (target) show(target.dataset.go);
});

const params = new URLSearchParams(location.search);
show(params.has('room') ? 'online-join' : 'home');
