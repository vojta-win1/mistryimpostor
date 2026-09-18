import { describe, it, expect, beforeEach } from 'vitest';
import { saveGame, loadGame, clearGame } from '../src/local/persist.js';
import { createGame, dealRound } from '../src/game/engine.js';

const KEY = 'mistryimpostor.local.game';
const content = { words: [{ theme: 'T', words: ['a', 'b', 'c'] }], questions: [] };

// Minimální localStorage pro Node.
const store = new Map();
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
};

function dealt() {
  return dealRound(createGame({ players: 4 }), content);
}

describe('uložení rozehrané hry', () => {
  beforeEach(() => store.clear());

  it('uloží a načte hru se stejným stavem', () => {
    const game = dealt();
    saveGame({ game, seat: 2, screen: 'role', timer: null });
    const loaded = loadGame();
    expect(loaded.game).toEqual(game);
    expect(loaded.seat).toBe(2);
    expect(loaded.screen).toBe('role');
  });

  it('bez uložené hry vrací null', () => {
    expect(loadGame()).toBeNull();
  });

  it('hru starší než 12 h zahodí', () => {
    saveGame({ game: dealt(), seat: 0, screen: 'round', timer: null });
    expect(loadGame(Date.now() + 13 * 60 * 60 * 1000)).toBeNull();
    expect(store.has(KEY)).toBe(false);
  });

  it('poškozená data nerozbijí start a smažou se', () => {
    for (const raw of ['{nejde to', '"text"', '42', JSON.stringify({ savedAt: Date.now(), screen: 'role', seat: 0, game: {} })]) {
      store.set(KEY, raw);
      expect(loadGame()).toBeNull();
      expect(store.has(KEY)).toBe(false);
    }
  });

  it('odmítne neplatnou obrazovku nebo hráče mimo rozsah', () => {
    const game = dealt();
    saveGame({ game, seat: 0, screen: 'lobby', timer: null });
    expect(loadGame()).toBeNull();
    saveGame({ game, seat: 9, screen: 'role', timer: null });
    expect(loadGame()).toBeNull();
    saveGame({ game: { ...game, round: { ...game.round, impostorIds: [99] } }, seat: 0, screen: 'role', timer: null });
    expect(loadGame()).toBeNull();
  });

  it('screen null drží jen historii (hra bez kola je platná)', () => {
    const game = { ...dealt(), round: null };
    saveGame({ game, seat: 0, screen: null, timer: null });
    expect(loadGame().game.history).toEqual(game.history);
  });

  it('clearGame smaže uložení', () => {
    saveGame({ game: dealt(), seat: 0, screen: 'result', timer: null });
    clearGame();
    expect(loadGame()).toBeNull();
  });
});
