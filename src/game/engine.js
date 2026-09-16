// Čistá herní logika – bez DOM a bez Supabase.
// Funkce berou stav a vracejí nový stav (vstupní stav nemění).

export const LIMITS = Object.freeze({
  minPlayers: 3,
  maxPlayers: 12,
  minImpostors: 1,
  maxImpostors: 4,
  impostorHistoryRounds: 3,
  contentHistoryRounds: 15,
});

export const MODES = Object.freeze(['words', 'questions']);

// ---------- náhoda ----------

/** Vrací celé číslo 0 <= n < max přes crypto.getRandomValues (bez modulo biasu). */
export function cryptoRandomInt(max) {
  if (!Number.isInteger(max) || max <= 0) throw new RangeError('max musí být kladné celé číslo');
  const range = 2 ** 32;
  const limit = range - (range % max);
  const buf = new Uint32Array(1);
  do {
    globalThis.crypto.getRandomValues(buf);
  } while (buf[0] >= limit);
  return buf[0] % max;
}

function pickOne(items, randomInt) {
  return items[randomInt(items.length)];
}

function pickMany(items, count, randomInt) {
  const pool = [...items];
  const out = [];
  while (out.length < count && pool.length) {
    out.push(pool.splice(randomInt(pool.length), 1)[0]);
  }
  return out;
}

// ---------- nastavení ----------

/**
 * Normalizuje a ověří nastavení.
 * `players` je buď počet (lokálně – hráči 1..N), nebo pole ID (online).
 */
export function normalizeSettings(settings = {}) {
  const playerIds = Array.isArray(settings.players)
    ? [...settings.players]
    : Array.from({ length: settings.players ?? 0 }, (_, i) => i + 1);

  if (new Set(playerIds).size !== playerIds.length) {
    throw new Error('ID hráčů musí být unikátní');
  }
  const n = playerIds.length;
  if (n < LIMITS.minPlayers || n > LIMITS.maxPlayers) {
    throw new Error(`Počet hráčů musí být ${LIMITS.minPlayers}–${LIMITS.maxPlayers}`);
  }

  const impostors = settings.impostors ?? 1;
  if (!Number.isInteger(impostors) || impostors < LIMITS.minImpostors || impostors > LIMITS.maxImpostors) {
    throw new Error(`Počet impostorů musí být ${LIMITS.minImpostors}–${LIMITS.maxImpostors}`);
  }
  if (impostors > n - 2) {
    throw new Error('Impostorů může být nejvýš o 2 méně než hráčů');
  }

  const mode = settings.mode ?? 'words';
  if (!MODES.includes(mode)) throw new Error(`Neznámý režim: ${mode}`);

  return {
    playerIds,
    impostors,
    mode,
    impostorKnows: settings.impostorKnows ?? true,
    themes: settings.themes?.length ? [...settings.themes] : null,
  };
}

// ---------- stav hry ----------

export function createGame(settings) {
  return {
    settings: normalizeSettings(settings),
    roundNumber: 0,
    round: null,
    history: { impostors: [], content: [] },
  };
}

/** Uzavře aktuální kolo do historie a připraví stav na další los. Volitelně změní nastavení. */
export function nextRoundState(state, newSettings) {
  const history = archiveRound(state.history, state.round);
  const settings = newSettings ? normalizeSettings({ ...denormalize(state.settings), ...newSettings }) : state.settings;
  return { ...state, settings, round: null, history };
}

function denormalize(s) {
  return { players: s.playerIds, impostors: s.impostors, mode: s.mode, impostorKnows: s.impostorKnows, themes: s.themes };
}

function archiveRound(history, round) {
  if (!round) return history;
  return {
    impostors: [...history.impostors, [...round.impostorIds]].slice(-LIMITS.impostorHistoryRounds),
    content: [...history.content, round.contentKey].slice(-LIMITS.contentHistoryRounds),
  };
}

/**
 * Vylosuje nové kolo.
 * content: { words: [{ theme, words: [] }], questions: [{ a, b, tags }] }
 * options.randomInt(max) – jen pro testy, výchozí je cryptoRandomInt.
 */
export function dealRound(state, content, { randomInt = cryptoRandomInt } = {}) {
  // Nedokončené kolo se automaticky přesune do historie.
  const base = state.round ? nextRoundState(state) : state;
  const { settings, history } = base;
  const { playerIds } = settings;

  const impostorIds = drawImpostors(playerIds, settings.impostors, history.impostors, randomInt);
  const pick = settings.mode === 'words'
    ? drawWord(content, settings.themes, history.content, randomInt)
    : drawQuestion(content, history.content, randomInt);

  const start = randomInt(playerIds.length);
  const order = [...playerIds.slice(start), ...playerIds.slice(0, start)];

  const number = base.roundNumber + 1;
  return {
    ...base,
    roundNumber: number,
    round: {
      number,
      mode: settings.mode,
      impostorIds,
      ...pick,
      order,
      votes: {},
      revealed: false,
    },
  };
}

/**
 * Impostoři z posledních min(3, hráči-2) kol jsou vyloučeni, dokud to jde.
 * Když kandidátů nestačí, uvolňuje se vyloučení od nejstaršího kola.
 */
function drawImpostors(playerIds, count, impostorHistory, randomInt) {
  const window = Math.min(LIMITS.impostorHistoryRounds, playerIds.length - 2);
  let recent = window > 0 ? impostorHistory.slice(-window) : [];

  for (;;) {
    const excluded = new Set(recent.flat());
    const candidates = playerIds.filter((id) => !excluded.has(id));
    if (candidates.length >= count) return pickMany(candidates, count, randomInt);
    recent = recent.slice(1);
  }
}

/** Z poolu položek s klíči vybere takovou, jejíž klíč nebyl v posledních kolech; jinak uvolní nejstarší. */
function availableByHistory(items, contentHistory) {
  let recent = [...contentHistory];
  for (;;) {
    const used = new Set(recent);
    const available = items.filter((item) => !used.has(item.key));
    if (available.length) return available;
    recent = recent.slice(1);
  }
}

function drawWord(content, themes, contentHistory, randomInt) {
  const selected = (content?.words ?? []).filter((t) => !themes || themes.includes(t.theme));
  const items = selected.flatMap((t) => t.words.map((word) => ({ key: wordKey(t.theme, word), theme: t.theme, word })));
  if (!items.length) throw new Error('Pro vybraná témata nejsou žádná slova');

  // Nejdřív téma (rovnoměrně mezi tématy s volným slovem), pak slovo.
  const available = availableByHistory(items, contentHistory);
  const theme = pickOne([...new Set(available.map((i) => i.theme))], randomInt);
  const item = pickOne(available.filter((i) => i.theme === theme), randomInt);

  return { contentKey: item.key, theme: item.theme, secret: item.word, impostorSecret: null };
}

function drawQuestion(content, contentHistory, randomInt) {
  const items = (content?.questions ?? []).map((q) => ({ key: questionKey(q), q }));
  if (!items.length) throw new Error('Nejsou k dispozici žádné otázky');

  const { key, q } = pickOne(availableByHistory(items, contentHistory), randomInt);
  const flip = randomInt(2) === 1;
  return {
    contentKey: key,
    theme: null,
    secret: flip ? q.b : q.a,
    impostorSecret: flip ? q.a : q.b,
  };
}

export function wordKey(theme, word) {
  return `w:${theme}:${word}`;
}

export function questionKey(q) {
  return `q:${q.a}|${q.b}`;
}

// ---------- role ----------

/**
 * Co uvidí daný hráč na obrazovce role.
 * kind: 'crew' | 'impostor' | 'unknowing' (impostor v otázkách, který o tom neví)
 */
export function roleFor(state, playerId) {
  const { round, settings } = state;
  if (!round) throw new Error('Žádné aktivní kolo');
  const isImpostor = round.impostorIds.includes(playerId);

  if (!isImpostor) {
    return { kind: 'crew', text: round.secret, theme: round.theme };
  }
  if (round.mode === 'words') {
    return { kind: 'impostor', text: null, theme: round.theme };
  }
  return settings.impostorKnows
    ? { kind: 'impostor', text: round.impostorSecret, theme: null }
    : { kind: 'unknowing', text: round.impostorSecret, theme: null };
}
