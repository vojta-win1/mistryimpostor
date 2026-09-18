// Uložení rozehrané lokální hry, aby přežila reload.

const STORAGE_KEY = 'mistryimpostor.local.game';
const MAX_AGE_MS = 12 * 60 * 60 * 1000;
export const SCREENS = Object.freeze(['role', 'round', 'countdown', 'result']);

/**
 * @param {object} snapshot
 * @param {object} snapshot.game  stav enginu
 * @param {number} snapshot.seat
 * @param {string|null} snapshot.screen  jedna ze SCREENS, nebo null (nastavení/úvod – drží se jen historie)
 * @param {object|null} snapshot.timer  { remainingMs, running, at }
 */
export function saveGame(snapshot) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...snapshot, savedAt: Date.now() }));
  } catch {
    // Plné nebo nedostupné úložiště – hra jede dál, jen nepřežije reload.
  }
}

export function clearGame() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // nic
  }
}

/** Vrací uložený snapshot, nebo null (neexistuje, je starý nebo poškozený). */
export function loadGame(now = Date.now()) {
  let raw;
  try {
    raw = localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
  if (raw === null) return null;

  let data = null;
  try {
    data = JSON.parse(raw);
  } catch {
    // poškozená data se níže smažou
  }
  if (!data || typeof data !== 'object' || !isValid(data) || now - data.savedAt > MAX_AGE_MS) {
    clearGame();
    return null;
  }
  return data;
}

function isValid(data) {
  const { game, seat, screen, savedAt } = data;
  if (typeof savedAt !== 'number') return false;
  if (screen !== null && !SCREENS.includes(screen)) return false;

  const ids = game?.settings?.playerIds;
  if (!Array.isArray(ids) || ids.length < 3) return false;
  if (!game.history || !Array.isArray(game.history.impostors) || !Array.isArray(game.history.content)) return false;
  if (screen === null) return true;

  const round = game.round;
  if (!round || !Array.isArray(round.impostorIds) || !Array.isArray(round.order)) return false;
  if (!round.impostorIds.every((id) => ids.includes(id))) return false;
  if (!Number.isInteger(seat) || seat < 0 || seat >= ids.length) return false;
  return true;
}
