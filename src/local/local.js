// Lokální režim – jeden telefon koluje mezi hráči.
import { createGame, dealRound, nextRoundState, roleFor, LIMITS } from '../game/engine.js';
import { show, render, onEnter } from '../ui/router.js';
import { el } from '../ui/dom.js';

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
  renderPass();
}

function playerId() {
  return game.settings.playerIds[seat];
}

function renderPass() {
  render('local-pass',
    el('p', { class: 'muted' }, `Kolo ${game.round.number}`),
    el('h2', { class: 'pass-title' }, `Telefon dej hráči ${playerId()}`),
    el('p', { class: 'muted' }, 'Ostatní se nedívají.'),
    el('button', { class: 'btn btn-primary', onclick: renderRole }, 'Ukázat'),
  );
  show('local-pass');
}

function renderRole() {
  const role = roleFor(game, playerId());
  const last = seat === game.settings.playerIds.length - 1;

  render('local-role',
    el('p', { class: 'muted' }, `Hráč ${playerId()}`),
    roleCard(role, game.round.mode),
    el('button', {
      class: 'btn btn-primary',
      onclick: () => {
        if (last) return renderRound();
        seat += 1;
        renderPass();
      },
    }, last ? 'Skrýt a začít kolo' : 'Skrýt a předat dál'),
  );
  show('local-role');
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

function renderRound() {
  const { round } = game;
  render('local-round',
    el('p', {}, round.mode === 'words'
      ? 'Každý řekne jedno slovo, které souvisí s tajným slovem.'
      : 'Každý nahlas odpoví na svou otázku.'),
    el('p', { class: 'field-label' }, 'Pořadí'),
    el('ol', { class: 'list list-numbered' }, round.order.map((id) => el('li', {}, `Hráč ${id}`))),
    el('p', { class: 'muted' }, 'Pak se dohodněte, kdo je impostor.'),
    el('button', { class: 'btn btn-primary', onclick: renderResult }, 'Odhalit'),
  );
  show('local-round');
}

function renderResult() {
  const { round } = game;
  game = { ...game, round: { ...round, revealed: true } };
  const ids = round.impostorIds.slice().sort((a, b) => a - b);
  const who = ids.length === 1
    ? `Impostor byl hráč ${ids[0]}`
    : `Impostoři byli hráči ${ids.slice(0, -1).join(', ')} a ${ids.at(-1)}`;

  render('local-result',
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
    el('button', { class: 'btn', onclick: () => show('local-setup') }, 'Nastavení'),
  );
  show('local-result');
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
