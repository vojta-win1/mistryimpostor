// Lokální režim – jeden telefon koluje mezi hráči.
import { createGame, dealRound, nextRoundState, roleFor, LIMITS } from '../game/engine.js';
import { show, render, onEnter } from '../ui/router.js';
import { el } from '../ui/dom.js';
import { holdCard } from '../ui/holdcard.js';

const STORAGE_KEY = 'mistryimpostor.local.settings';

const DEFAULT_SETTINGS = { players: 4, impostors: 1, mode: 'words', impostorKnows: true, themes: null };

let getContent;
let settings = loadSettings();
let game = null;
let seat = 0; // index hráče, který si právě prohlíží roli

export function initLocal(deps) {
  getContent = deps.getContent;
  onEnter('local-setup', renderSetup);
}

// ---------- nastavení ----------

function loadSettings() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return { ...DEFAULT_SETTINGS, ...saved };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

function saveSettings() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Úložiště nemusí být dostupné (anonymní okno) – nevadí.
  }
}

function maxImpostors(players) {
  return Math.min(LIMITS.maxImpostors, players - 2);
}

function update(patch) {
  settings = { ...settings, ...patch };
  settings.impostors = Math.min(settings.impostors, maxImpostors(settings.players));
  saveSettings();
  renderSetup();
}

async function renderSetup() {
  let content;
  try {
    content = await getContent();
  } catch {
    render('local-setup', el('p', { class: 'warning' }, 'Nepodařilo se načíst slova a otázky. Zkontroluj připojení a obnov stránku.'));
    return;
  }

  document.body.dataset.mode = settings.mode;
  const allThemes = content.words.map((t) => t.theme);
  const selected = new Set((settings.themes ?? allThemes).filter((t) => allThemes.includes(t)));
  const noThemes = settings.mode === 'words' && selected.size === 0;

  render(
    'local-setup',
    field('Počet hráčů', stepper(settings.players, LIMITS.minPlayers, LIMITS.maxPlayers, (players) => update({ players }))),
    field('Počet impostorů', stepper(settings.impostors, LIMITS.minImpostors, maxImpostors(settings.players), (impostors) => update({ impostors }))),
    field('Režim', segmented(
      [['words', 'Slova'], ['questions', 'Otázky']],
      settings.mode,
      (mode) => update({ mode }),
    )),
    settings.mode === 'questions' && toggle(
      'Impostor ví, že jím je',
      settings.impostorKnows,
      (impostorKnows) => update({ impostorKnows }),
      'Když je vypnuto, impostor odpovídá poctivě a neví, že má jinou otázku.',
    ),
    settings.mode === 'words' && themePicker(allThemes, selected),
    el('button', {
      class: 'btn btn-primary',
      disabled: noThemes,
      onclick: startGame,
    }, 'Rozdat role'),
    noThemes && el('p', { class: 'warning' }, 'Vyber aspoň jedno téma.'),
  );
}

function themePicker(allThemes, selected) {
  const setThemes = (set) => update({ themes: set.size === allThemes.length ? null : allThemes.filter((t) => set.has(t)) });
  const allOn = selected.size === allThemes.length;

  return el('div', { class: 'field' },
    el('div', { class: 'field-row' },
      el('span', { class: 'field-label' }, 'Témata'),
      el('button', {
        class: 'btn-link',
        onclick: () => setThemes(allOn ? new Set() : new Set(allThemes)),
      }, allOn ? 'Zrušit vše' : 'Vybrat vše'),
    ),
    el('div', { class: 'chips' }, allThemes.map((theme) => el('button', {
      class: 'chip',
      'aria-pressed': String(selected.has(theme)),
      onclick: () => {
        const next = new Set(selected);
        next.has(theme) ? next.delete(theme) : next.add(theme);
        setThemes(next);
      },
    }, theme))),
  );
}

// ---------- průběh kola ----------

async function startGame() {
  const content = await getContent();
  const engineSettings = { ...settings };
  game = game ? nextRoundState(game, engineSettings) : createGame(engineSettings);
  deal(content);
}

async function nextRound() {
  deal(await getContent());
}

function deal(content) {
  game = dealRound(game, content);
  document.body.dataset.mode = game.round.mode;
  seat = 0;
  renderRole();
}

function playerId() {
  return game.settings.playerIds[seat];
}

function isLastSeat() {
  return seat === game.settings.playerIds.length - 1;
}

function passOn(dir = 'forward') {
  if (isLastSeat()) return renderRound(dir);
  seat += 1;
  renderRole(dir);
}

function renderRole(dir = 'forward') {
  const id = playerId();
  const last = isLastSeat();
  let viewed = false;

  const passBtn = el('button', { class: 'btn btn-primary', disabled: true, onclick: () => passOn() },
    last ? 'Začít kolo' : 'Předat dál');
  const hint = el('p', { class: 'muted small', 'aria-live': 'polite' },
    'Podrž kartu a uvidíš svou roli. Po puštění se zase zakryje.');

  const card = holdCard({
    label: `Role hráče ${id}. Podrž pro zobrazení.`,
    front: cardCover(id),
    back: roleCard(roleFor(game, id), game.round.mode),
    canSwipe: () => viewed,
    onSwipeLeft: () => passOn('fade'), // karta už odletěla, obrazovka jen prolne
    onOpen: () => {
      if (viewed) return;
      viewed = true;
      passBtn.disabled = false;
      hint.textContent = last
        ? 'Všichni znají svou roli. Švihni kartou doleva a začněte kolo.'
        : `Pusť kartu, švihni jí doleva a předej telefon hráči ${game.settings.playerIds[seat + 1]}.`;
    },
  });

  show('local-role', { dir, content: [
    el('div', { class: 'role-head' },
      el('p', { class: 'muted' }, `Kolo ${game.round.number} · hráč ${seat + 1} z ${game.settings.playerIds.length}`),
      el('h2', { class: 'pass-title' }, `Telefon má hráč ${id}`),
      el('p', { class: 'muted' }, 'Ostatní se nedívají.'),
    ),
    card,
    hint,
    passBtn,
  ] });
}

function cardCover(id) {
  return el('div', { class: 'card card-cover' },
    svgIcon(`<circle cx="32" cy="32" r="30" fill="none" stroke="currentColor" stroke-width="3" opacity=".35"/>
      <path d="M20 40c0-10 5-18 12-18s12 8 12 18M25 44c0-9 3-15 7-15s7 6 7 15M32 36v12" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>`),
    el('p', { class: 'cover-number' }, String(id)),
    el('p', { class: 'cover-label' }, 'Podrž pro zobrazení'),
  );
}

/** Ikona ze statického SVG markupu (jen vlastní konstanty, nikdy data od uživatele). */
function svgIcon(markup) {
  const wrap = document.createElement('div');
  wrap.innerHTML = `<svg class="icon-lg" viewBox="0 0 64 64" aria-hidden="true">${markup}</svg>`;
  return wrap.firstChild;
}

function roleCard(role, mode) {
  if (role.kind === 'impostor' && mode === 'words') {
    return el('div', { class: 'card role-impostor' },
      el('p', { class: 'warning' }, 'Jsi impostor!'),
      el('p', { class: 'muted' }, 'Téma'),
      el('p', { class: 'role-word' }, role.theme),
      el('p', { class: 'muted' }, 'Slovo neznáš. Poslouchej ostatní a nenech se odhalit.'),
    );
  }
  if (role.kind === 'impostor') {
    return el('div', { class: 'card role-impostor' },
      el('p', { class: 'warning' }, 'Jsi impostor! Ostatní mají jinou otázku.'),
      el('p', { class: 'role-question' }, role.text),
    );
  }
  if (mode === 'words') {
    return el('div', { class: 'card role-crew' },
      el('p', { class: 'muted' }, `Téma: ${role.theme}`),
      el('p', { class: 'role-word' }, role.text),
    );
  }
  // Posádka i impostor, který o tom neví, vidí stejně vypadající kartu.
  return el('div', { class: 'card role-crew' },
    el('p', { class: 'muted' }, 'Tvoje otázka'),
    el('p', { class: 'role-question' }, role.text),
  );
}

function renderRound(dir = 'forward') {
  const { round } = game;
  show('local-round', { dir, content: [
    el('p', {}, round.mode === 'words'
      ? 'Každý řekne jedno slovo, které souvisí s tajným slovem.'
      : 'Každý nahlas odpoví na svou otázku.'),
    el('p', { class: 'field-label' }, 'Pořadí'),
    el('ol', { class: 'list list-numbered' }, round.order.map((id) => el('li', {}, `Hráč ${id}`))),
    el('p', { class: 'muted' }, 'Pak se dohodněte, kdo je impostor.'),
    el('button', { class: 'btn btn-primary', onclick: renderResult }, 'Odhalit'),
  ] });
}

function renderResult() {
  const { round } = game;
  game = { ...game, round: { ...round, revealed: true } };
  const ids = round.impostorIds.slice().sort((a, b) => a - b);
  const who = ids.length === 1
    ? `Impostor byl hráč ${ids[0]}`
    : `Impostoři byli hráči ${ids.slice(0, -1).join(', ')} a ${ids.at(-1)}`;

  show('local-result', { dir: 'fade', content: [
    el('div', { class: 'card role-impostor' }, el('p', { class: 'result-who' }, who)),
    round.mode === 'words'
      ? el('div', { class: 'card role-crew' },
        el('p', { class: 'muted' }, `Téma: ${round.theme}`),
        el('p', { class: 'role-word' }, round.secret))
      : el('div', { class: 'card role-crew' },
        el('p', { class: 'muted' }, 'Otázka skupiny'),
        el('p', { class: 'role-question' }, round.secret),
        el('p', { class: 'muted' }, 'Otázka impostora'),
        el('p', { class: 'role-question' }, round.impostorSecret)),
    el('button', { class: 'btn btn-primary', onclick: nextRound }, 'Další kolo'),
    el('button', { class: 'btn', onclick: () => show('local-setup', { dir: 'back' }) }, 'Nastavení'),
  ] });
}

// ---------- komponenty ----------

function field(label, control) {
  return el('div', { class: 'field' }, el('span', { class: 'field-label' }, label), control);
}

function stepper(value, min, max, onChange) {
  return el('div', { class: 'stepper' },
    el('button', { class: 'btn', 'aria-label': 'Méně', disabled: value <= min, onclick: () => onChange(value - 1) }, '−'),
    el('output', { 'aria-live': 'polite' }, String(value)),
    el('button', { class: 'btn', 'aria-label': 'Více', disabled: value >= max, onclick: () => onChange(value + 1) }, '+'),
  );
}

function segmented(options, current, onChange) {
  return el('div', { class: 'segmented', role: 'group' }, options.map(([value, label]) => el('button', {
    'aria-pressed': String(value === current),
    onclick: () => value !== current && onChange(value),
  }, label)));
}

function toggle(label, checked, onChange, hint) {
  const input = el('input', { type: 'checkbox', checked, onchange: (e) => onChange(e.target.checked) });
  return el('div', { class: 'field' },
    el('label', { class: 'toggle' }, el('span', { class: 'field-label' }, label), input),
    hint && el('p', { class: 'muted small' }, hint),
  );
}
