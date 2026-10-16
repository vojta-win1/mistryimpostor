// Lokální režim – jeden telefon koluje mezi hráči.
import { createGame, dealRound, nextRoundState, roleFor, LIMITS } from '../game/engine.js';
import { show, render, onEnter } from '../ui/router.js';
import { el } from '../ui/dom.js';
import { holdCard } from '../ui/holdcard.js';
import { confetti } from '../ui/confetti.js';
import { vibrate, PATTERNS } from '../ui/haptics.js';
import { sound } from '../ui/sound.js';
import { keepAwake } from '../ui/wakelock.js';
import { ringTimer } from '../ui/timer.js';
import { saveGame, loadGame } from './persist.js';

const STORAGE_KEY = 'mistryimpostor.local.settings';

const DEFAULT_SETTINGS = { players: 4, impostors: 1, mode: 'words', impostorKnows: true, themes: null, timer: 0 };
const TIMER_OPTIONS = [[0, 'Vypnuto'], [30, '30 s'], [60, '60 s'], [90, '90 s']];

let getContent;
let settings = loadSettings();
let game = null;
let seat = 0; // index hráče, který si právě prohlíží roli
let timerState = null; // { remainingMs, running, at } časomíry aktuálního kola; at = Date.now() při změně

export function initLocal(deps) {
  getContent = deps.getContent;
  onEnter('local-setup', () => {
    leaveGame();
    renderSetup();
  });
  onEnter('home', leaveGame);
}

/**
 * Obnoví rozehranou hru po reloadu.
 * @param {object} [opts]
 * @param {boolean} [opts.navigate]  false = jen načíst historii, obrazovku neměnit
 * @returns {boolean} true, pokud se zobrazila obrazovka hry
 */
export function restoreLocal({ navigate = true } = {}) {
  const saved = loadGame();
  if (!saved) return false;
  game = saved.game;
  seat = saved.seat ?? 0;
  timerState = saved.timer ?? null;
  if (!navigate || !saved.screen) return false;

  document.body.dataset.mode = game.round.mode;
  keepAwake(true);
  // Karta s rolí je po obnovení vždy zakrytá – vzniká nová.
  if (saved.screen === 'role') renderRole('fade');
  else if (saved.screen === 'round') renderRound('fade');
  else if (saved.screen === 'countdown') renderCountdown();
  else renderResult();
  return true;
}

function leaveGame() {
  keepAwake(false);
  if (game) persist(null); // historie losu zůstává, obrazovka se neobnovuje
}

function persist(screen) {
  saveGame({ game, seat, screen, timer: timerState });
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
    el('div', { class: 'table-group' },
      countRow('Hráči', stepper(settings.players, LIMITS.minPlayers, LIMITS.maxPlayers, (players) => update({ players }))),
      countRow('Impostoři', stepper(settings.impostors, LIMITS.minImpostors, maxImpostors(settings.players), (impostors) => update({ impostors }))),
      playerStrip(settings.players, settings.impostors),
    ),
    field('Režim', modeTiles(settings.mode, (mode) => update({ mode }))),
    settings.mode === 'questions' && toggle(
      'Impostor ví, že jím je',
      settings.impostorKnows,
      (impostorKnows) => update({ impostorKnows }),
      'Když je vypnuto, impostor odpovídá poctivě a neví, že má jinou otázku.',
    ),
    settings.mode === 'words' && themePicker(allThemes, selected),
    field('Časomíra na kolo', segmented(TIMER_OPTIONS, settings.timer, (timer) => update({ timer }))),
    el('div', { class: 'sticky-cta' },
      noThemes && el('p', { class: 'warning' }, 'Vyber aspoň jedno téma.'),
      el('button', {
        class: 'btn btn-primary btn-lg',
        disabled: noThemes,
        onclick: startGame,
      }, 'Rozdat role'),
    ),
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
  keepAwake(true);
  timerState = null;
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
  persist('role');
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
    back: roleCard(roleFor(game, id), game.round.mode, id),
    canSwipe: () => viewed,
    onSwipeLeft: () => passOn('fade'), // karta už odletěla, obrazovka jen prolne
    onSwipeStart: sound.swipe,
    onOpen: () => {
      sound.flip();
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
      el('div', { class: 'round-meta' },
        el('span', { class: 'round-badge' }, `Kolo ${game.round.number}`),
        pips(seat, game.settings.playerIds.length),
      ),
      el('h2', { class: 'pass-title' }, `Telefon má hráč ${id}`),
      el('p', { class: 'muted' }, 'Ostatní se nedívají.'),
    ),
    card,
    hint,
    passBtn,
  ] });
}

function pips(current, total) {
  return el('ol', { class: 'pips', 'aria-label': `Hráč ${current + 1} z ${total}` },
    Array.from({ length: total }, (_, i) => el('li', {
      class: i < current ? 'is-done' : i === current ? 'is-current' : null,
    })));
}

/** Rub hrací karty – vzor v barvě režimu, uprostřed číslo hráče. */
function cardCover(id) {
  return el('div', { class: 'pcard pcard-back' },
    el('div', { class: 'pcard-frame' },
      el('div', { class: 'pcard-medal' },
        el('span', { class: 'pcard-num' }, String(id)),
      ),
      el('p', { class: 'pcard-hint' }, 'Podrž pro zobrazení'),
    ),
  );
}

const MASK_SVG = `<path fill="currentColor" fill-rule="evenodd" d="M4 9C14 2 50 2 60 9c0 15-6 25-17 25-6 0-8-6-11-6s-5 6-11 6C10 34 4 24 4 9zm11 9.5c0 3 3 5 6.5 5s6.5-2 6.5-5-3-4.5-6.5-4.5S15 15.5 15 18.5zm21 0c0 3 3 5 6.5 5s6.5-2 6.5-5-3-4.5-6.5-4.5S36 15.5 36 18.5z"/>`;

/** Maska impostora ze statického SVG markupu (jen vlastní konstanta, nikdy data od uživatele). */
function maskIcon(cls = 'role-mask') {
  const wrap = document.createElement('div');
  wrap.innerHTML = `<svg class="${cls}" viewBox="0 0 64 38" aria-hidden="true">${MASK_SVG}</svg>`;
  return wrap.firstChild;
}

/**
 * Odstavec s tajným slovem. Dlouhá slova se zmenší, aby se vešla na jeden řádek
 * a nelámala se uprostřed („krasobrusle-ní“).
 */
function wordText(cls, text) {
  const longest = Math.max(...text.split(/s+/).map((w) => w.length));
  return el('p', { class: cls, 'data-size': longest > 12 ? 'xs' : longest > 9 ? 's' : null }, text);
}

/** Líc hrací karty s rohovými indexy (číslo hráče). */
function cardFace(kind, id, ...body) {
  return el('div', { class: `pcard pcard-face pcard--${kind}` },
    el('span', { class: 'pcard-corner pcard-corner--tl', 'aria-hidden': 'true' }, String(id)),
    el('div', { class: 'pcard-body' }, ...body),
    el('span', { class: 'pcard-corner pcard-corner--br', 'aria-hidden': 'true' }, String(id)),
  );
}

function roleCard(role, mode, id) {
  if (role.kind === 'impostor' && mode === 'words') {
    return cardFace('impostor', id,
      maskIcon(),
      el('p', { class: 'role-title' }, 'Jsi impostor'),
      el('p', { class: 'role-label' }, 'Téma'),
      el('p', { class: 'role-theme' }, role.theme),
      el('p', { class: 'role-note' }, 'Slovo neznáš. Poslouchej ostatní a nenech se odhalit.'),
    );
  }
  if (role.kind === 'impostor') {
    return cardFace('impostor', id,
      maskIcon(),
      el('p', { class: 'role-title' }, 'Jsi impostor'),
      el('p', { class: 'role-note' }, 'Ostatní mají jinou otázku.'),
      el('p', { class: 'role-question' }, role.text),
    );
  }
  if (mode === 'words') {
    return cardFace('crew', id,
      el('p', { class: 'role-label' }, role.theme),
      wordText('role-word', role.text),
    );
  }
  // Posádka i impostor, který o tom neví, vidí stejně vypadající kartu.
  return cardFace('crew', id,
    el('p', { class: 'role-label' }, 'Tvoje otázka'),
    el('p', { class: 'role-question' }, role.text),
  );
}

function renderRound(dir = 'forward') {
  persist('round');
  const { round } = game;
  const timer = settings.timer > 0 && ringTimer({
    duration: settings.timer,
    state: timerNow(),
    onChange: (state) => {
      timerState = { ...state, at: Date.now() };
      persist('round');
    },
  });
  show('local-round', { dir, content: [
    timer,
    el('p', { class: 'round-intro' }, round.mode === 'words'
      ? 'Každý řekne jedno slovo, které souvisí s tajným slovem.'
      : 'Každý nahlas odpoví na svou otázku.'),
    el('div', { class: 'field' },
      el('span', { class: 'field-label' }, 'Pořadí'),
      el('ol', { class: 'order' }, round.order.map((id) => el('li', { class: 'mini-card' },
        el('span', { class: 'sr-only' }, 'Hráč '), String(id)))),
    ),
    el('p', { class: 'muted' }, 'Pak se dohodněte, kdo je impostor.'),
    el('button', { class: 'btn btn-primary btn-lg btn-reveal', onclick: renderCountdown }, 'Odhalit'),
  ] });
}

/** Stav časomíry přepočtený na teď (běžící čas mezitím ubíhal, i během reloadu). */
function timerNow() {
  if (!timerState) return null;
  const { remainingMs, running, at } = timerState;
  return { remainingMs: running ? remainingMs - (Date.now() - at) : remainingMs, running };
}

const COUNTDOWN_FROM = 3;

function renderCountdown() {
  persist('countdown');
  let n = COUNTDOWN_FROM;
  const slot = el('div', { class: 'countdown', 'aria-live': 'assertive' });
  const tick = () => {
    slot.replaceChildren(el('span', { class: 'countdown-num' }, String(n)));
    vibrate(PATTERNS.tick);
    sound.tick();
  };

  show('local-countdown', { dir: 'fade', content: [
    el('p', { class: 'countdown-label' }, game.round.impostorIds.length === 1 ? 'Kdo je impostor?' : 'Kdo jsou impostoři?'),
    slot,
  ] });
  tick();

  const timer = setInterval(() => {
    n -= 1;
    if (n > 0) return tick();
    clearInterval(timer);
    renderResult({ celebrate: true });
  }, 1000);
}

function renderResult({ celebrate = false } = {}) {
  const { round } = game;
  game = { ...game, round: { ...round, revealed: true } };
  persist('result');
  const ids = round.impostorIds.slice().sort((a, b) => a - b);
  const single = ids.length === 1;
  const names = single ? `Hráč ${ids[0]}` : `Hráči ${ids.slice(0, -1).join(', ')} a ${ids.at(-1)}`;

  show('local-result', { dir: 'fade', content: [
    el('div', { class: 'result-hero' },
      maskIcon('result-mask'),
      el('p', { class: 'result-kicker' }, single ? 'Impostorem byl' : 'Impostory byli'),
      el('p', { class: 'result-who' }, names),
    ),
    round.mode === 'words'
      ? el('div', { class: 'secret-card' },
        el('p', { class: 'role-label' }, `Tajné slovo · ${round.theme}`),
        wordText('secret-word', round.secret))
      : el('div', { class: 'secret-card' },
        el('p', { class: 'role-label' }, 'Otázka skupiny'),
        el('p', { class: 'secret-question' }, round.secret),
        el('p', { class: 'role-label result-impostor-label' }, 'Otázka impostora'),
        el('p', { class: 'secret-question result-impostor-question' }, round.impostorSecret)),
    el('button', { class: 'btn btn-primary btn-lg', onclick: nextRound }, 'Další kolo'),
    el('button', { class: 'btn', onclick: () => show('local-setup', { dir: 'back' }) }, 'Nastavení'),
  ] });

  if (celebrate) {
    vibrate(PATTERNS.reveal);
    sound.reveal();
    setTimeout(() => confetti(), 150); // až po přechodu obrazovky
  }
}

// ---------- komponenty ----------

function countRow(label, control) {
  return el('div', { class: 'count-row' }, el('span', { class: 'field-label' }, label), control);
}

/** Náhled stolu: jedna malá karta za hráče, impostoři červeně. */
function playerStrip(players, impostors) {
  return el('div', { class: 'player-strip', 'aria-hidden': 'true' },
    Array.from({ length: players }, (_, i) => el('span', {
      class: i >= players - impostors ? 'mini-card mini-card--impostor' : 'mini-card',
    }, i >= players - impostors ? '?' : '')));
}

const MODES = [
  ['words', 'Slova', 'Impostor zná jen téma'],
  ['questions', 'Otázky', 'Impostor má jinou otázku'],
];

function modeTiles(current, onChange) {
  return el('div', { class: 'mode-tiles', role: 'group' }, MODES.map(([value, name, desc]) => el('button', {
    class: `mode-tile mode-tile--${value}`,
    'aria-pressed': String(value === current),
    onclick: () => value !== current && onChange(value),
  }, el('span', { class: 'mode-name' }, name), el('span', { class: 'mode-desc' }, desc))));
}

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
