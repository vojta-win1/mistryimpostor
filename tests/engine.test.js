import { describe, it, expect } from 'vitest';
import {
  createGame, dealRound, nextRoundState, roleFor, cryptoRandomInt, normalizeSettings, wordKey, LIMITS,
} from '../src/game/engine.js';
import { validateContent } from '../src/game/content.js';

const themes = ['Příroda', 'Jídlo', 'Sport'];
const content = {
  words: themes.map((theme) => ({ theme, words: Array.from({ length: 10 }, (_, i) => `${theme}-${i}`) })),
  questions: Array.from({ length: 20 }, (_, i) => ({ a: `A${i}?`, b: `B${i}?`, tags: ['test'] })),
};

/** Deterministický generátor pro testy (mulberry32). */
function seeded(seed) {
  let s = seed >>> 0;
  return (max) => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return (((t ^ (t >>> 14)) >>> 0) % max);
  };
}

function playRounds(state, rounds, randomInt, c = content) {
  const played = [];
  for (let i = 0; i < rounds; i++) {
    state = dealRound(nextRoundState(state), c, { randomInt });
    played.push(state.round);
  }
  return { state, played };
}

describe('nastavení a limity', () => {
  it('přijme 3–12 hráčů a odmítne mimo rozsah', () => {
    expect(() => createGame({ players: 3 })).not.toThrow();
    expect(() => createGame({ players: 12, impostors: 4 })).not.toThrow();
    expect(() => createGame({ players: 2 })).toThrow();
    expect(() => createGame({ players: 13 })).toThrow();
  });

  it('impostorů 1–4 a vždy nejvýš hráči - 2', () => {
    expect(() => createGame({ players: 5, impostors: 0 })).toThrow();
    expect(() => createGame({ players: 12, impostors: 5 })).toThrow();
    expect(() => createGame({ players: 4, impostors: 3 })).toThrow();
    expect(() => createGame({ players: 4, impostors: 2 })).not.toThrow();
    expect(() => createGame({ players: 3, impostors: 2 })).toThrow();
  });

  it('počet hráčů vytvoří čísla 1..N, pole ID zůstane', () => {
    expect(createGame({ players: 4 }).settings.playerIds).toEqual([1, 2, 3, 4]);
    expect(createGame({ players: ['x', 'y', 'z'] }).settings.playerIds).toEqual(['x', 'y', 'z']);
    expect(() => createGame({ players: ['x', 'x', 'z'] })).toThrow();
  });

  it('odmítne neznámý režim', () => {
    expect(() => normalizeSettings({ players: 4, mode: 'foo' })).toThrow();
  });

  it('nextRoundState umí změnit nastavení a ověří ho', () => {
    const s = createGame({ players: 4 });
    expect(nextRoundState(s, { players: 6, impostors: 2 }).settings.playerIds).toHaveLength(6);
    expect(() => nextRoundState(s, { impostors: 3 })).toThrow();
  });
});

describe('dealRound', () => {
  it('nemění vstupní stav a vrací kolo se správnou strukturou', () => {
    const s = createGame({ players: 5, impostors: 2 });
    const snapshot = structuredClone(s);
    const next = dealRound(s, content, { randomInt: seeded(1) });
    expect(s).toEqual(snapshot);

    const r = next.round;
    expect(r.number).toBe(1);
    expect(r.impostorIds).toHaveLength(2);
    expect(new Set(r.impostorIds).size).toBe(2);
    r.impostorIds.forEach((id) => expect(s.settings.playerIds).toContain(id));
    expect([...r.order].sort()).toEqual([1, 2, 3, 4, 5]);
    expect(r.votes).toEqual({});
    expect(r.revealed).toBe(false);
  });

  it('pořadí odpovědí je rotace seznamu hráčů', () => {
    const s = createGame({ players: 6 });
    for (let seed = 0; seed < 20; seed++) {
      const { order } = dealRound(s, content, { randomInt: seeded(seed) }).round;
      const start = order[0] - 1;
      expect(order).toEqual([1, 2, 3, 4, 5, 6].map((_, i) => ((start + i) % 6) + 1));
    }
  });

  it('dealRound s aktivním kolem ho sám uloží do historie', () => {
    let s = createGame({ players: 4 });
    s = dealRound(s, content, { randomInt: seeded(3) });
    s = dealRound(s, content, { randomInt: seeded(4) });
    expect(s.round.number).toBe(2);
    expect(s.history.impostors).toHaveLength(1);
    expect(s.history.content).toHaveLength(1);
  });

  it('výchozí náhoda používá crypto.getRandomValues', () => {
    const s = dealRound(createGame({ players: 4 }), content);
    expect(s.round.impostorIds).toHaveLength(1);
    for (let i = 0; i < 1000; i++) {
      const n = cryptoRandomInt(7);
      expect(n).toBeGreaterThanOrEqual(0);
      expect(n).toBeLessThan(7);
    }
  });
});

describe('historie losu impostora', () => {
  it('4 hráči: impostor se neopakuje v posledních min(3, 2)=2 kolech', () => {
    for (let seed = 0; seed < 50; seed++) {
      const { played } = playRounds(createGame({ players: 4 }), 12, seeded(seed));
      played.forEach((r, i) => {
        const recent = played.slice(Math.max(0, i - 2), i).flatMap((p) => p.impostorIds);
        r.impostorIds.forEach((id) => expect(recent).not.toContain(id));
      });
    }
  });

  it('6 hráčů: impostor se neopakuje v posledních 3 kolech', () => {
    for (let seed = 0; seed < 50; seed++) {
      const { played } = playRounds(createGame({ players: 6 }), 15, seeded(seed));
      played.forEach((r, i) => {
        const recent = played.slice(Math.max(0, i - 3), i).flatMap((p) => p.impostorIds);
        r.impostorIds.forEach((id) => expect(recent).not.toContain(id));
      });
    }
  });

  it('3 hráči: okno je min(3, 1)=1 kolo', () => {
    for (let seed = 0; seed < 50; seed++) {
      const { played } = playRounds(createGame({ players: 3 }), 10, seeded(seed));
      played.slice(1).forEach((r, i) => {
        expect(r.impostorIds[0]).not.toBe(played[i].impostorIds[0]);
      });
    }
  });

  it('když kandidátů nestačí, uvolní vyloučení od nejstaršího kola', () => {
    // 6 hráčů, 2 impostoři, okno 3 kola = 6 vyloučených → musí uvolnit nejstarší kolo.
    for (let seed = 0; seed < 50; seed++) {
      const { played } = playRounds(createGame({ players: 6, impostors: 2 }), 10, seeded(seed));
      played.forEach((r, i) => {
        expect(new Set(r.impostorIds).size).toBe(2);
        // Nikdy se neopakuje nikdo z předchozích 2 kol (ty jsou dohromady jen 4 hráči).
        const recent = played.slice(Math.max(0, i - 2), i).flatMap((p) => p.impostorIds);
        r.impostorIds.forEach((id) => expect(recent).not.toContain(id));
      });
    }
  });

  it('funguje i s maximem impostorů (12 hráčů, 4 impostoři)', () => {
    const { played } = playRounds(createGame({ players: 12, impostors: 4 }), 10, seeded(9));
    played.forEach((r) => expect(new Set(r.impostorIds).size).toBe(4));
  });

  it('historie impostorů drží nejvýš 3 kola', () => {
    const { state } = playRounds(createGame({ players: 8 }), 10, seeded(2));
    expect(nextRoundState(state).history.impostors).toHaveLength(LIMITS.impostorHistoryRounds);
  });
});

describe('neopakování obsahu', () => {
  it('slovo se neopakuje v posledních 15 kolech', () => {
    for (let seed = 0; seed < 20; seed++) {
      const { played } = playRounds(createGame({ players: 5 }), 30, seeded(seed));
      played.forEach((r, i) => {
        const recent = played.slice(Math.max(0, i - 15), i).map((p) => p.contentKey);
        expect(recent).not.toContain(r.contentKey);
      });
    }
  });

  it('otázka se neopakuje v posledních 15 kolech', () => {
    for (let seed = 0; seed < 20; seed++) {
      const { played } = playRounds(createGame({ players: 5, mode: 'questions' }), 30, seeded(seed));
      played.forEach((r, i) => {
        const recent = played.slice(Math.max(0, i - 15), i).map((p) => p.contentKey);
        expect(recent).not.toContain(r.contentKey);
      });
    }
  });

  it('při malém obsahu uvolní nejstarší použité a hra pokračuje', () => {
    const tiny = { words: [{ theme: 'T', words: ['a', 'b', 'c'] }], questions: [] };
    const { played } = playRounds(createGame({ players: 4 }), 10, seeded(1), tiny);
    expect(played).toHaveLength(10);
    played.slice(1).forEach((r, i) => expect(r.secret).not.toBe(played[i].secret));
    // Se 3 slovy se každé kolo musí použít to nejdéle nepoužité.
    played.slice(3).forEach((r, i) => expect(r.secret).toBe(played[i].secret));
  });

  it('respektuje výběr témat', () => {
    const { played } = playRounds(createGame({ players: 4, themes: ['Sport'] }), 10, seeded(5));
    played.forEach((r) => {
      expect(r.theme).toBe('Sport');
      expect(r.contentKey).toBe(wordKey('Sport', r.secret));
    });
  });

  it('chyba, když pro vybraná témata nejsou slova', () => {
    const s = createGame({ players: 4, themes: ['Neexistuje'] });
    expect(() => dealRound(s, content, { randomInt: seeded(1) })).toThrow();
    const q = createGame({ players: 4, mode: 'questions' });
    expect(() => dealRound(q, { words: [], questions: [] })).toThrow();
  });

  it('historie obsahu drží nejvýš 15 kol', () => {
    const { state } = playRounds(createGame({ players: 4 }), 25, seeded(8));
    expect(nextRoundState(state).history.content).toHaveLength(LIMITS.contentHistoryRounds);
  });
});

describe('otázky: los a/b', () => {
  it('skupina a impostor dostanou různé otázky ze stejné dvojice', () => {
    const { played } = playRounds(createGame({ players: 4, mode: 'questions' }), 20, seeded(11));
    played.forEach((r) => {
      const pair = content.questions.find((q) => [q.a, q.b].includes(r.secret));
      expect([pair.a, pair.b].sort()).toEqual([r.secret, r.impostorSecret].sort());
      expect(r.theme).toBeNull();
    });
  });

  it('obě varianty (a pro skupinu i b pro skupinu) nastávají', () => {
    const q = { words: [], questions: [{ a: 'A?', b: 'B?' }] };
    const s = createGame({ players: 4, mode: 'questions' });
    const groupGets = new Set();
    for (let seed = 0; seed < 40; seed++) {
      groupGets.add(dealRound(s, q, { randomInt: seeded(seed) }).round.secret);
    }
    expect(groupGets).toEqual(new Set(['A?', 'B?']));
  });
});

describe('roleFor', () => {
  it('slova: posádka vidí slovo, impostor jen téma', () => {
    const s = dealRound(createGame({ players: 4 }), content, { randomInt: seeded(1) });
    const imp = s.round.impostorIds[0];
    const crew = s.settings.playerIds.find((id) => id !== imp);
    expect(roleFor(s, crew)).toEqual({ kind: 'crew', text: s.round.secret, theme: s.round.theme });
    expect(roleFor(s, imp)).toEqual({ kind: 'impostor', text: null, theme: s.round.theme });
  });

  it('otázky: impostor dostane svou otázku, podle přepínače ví/neví', () => {
    for (const impostorKnows of [true, false]) {
      const s = dealRound(createGame({ players: 4, mode: 'questions', impostorKnows }), content, { randomInt: seeded(2) });
      const imp = s.round.impostorIds[0];
      const crew = s.settings.playerIds.find((id) => id !== imp);
      expect(roleFor(s, crew).text).toBe(s.round.secret);
      expect(roleFor(s, imp)).toEqual({
        kind: impostorKnows ? 'impostor' : 'unknowing',
        text: s.round.impostorSecret,
        theme: null,
      });
    }
  });
});

describe('validateContent', () => {
  it('testovací obsah projde s nižšími minimy', () => {
    expect(validateContent(content, { minThemes: 3, minWordsPerTheme: 10 })).toEqual([]);
  });

  it('najde chyby', () => {
    const errors = validateContent({
      words: [{ theme: 'X', words: ['a', 'a', ''] }, { words: [] }],
      questions: [{ a: 'Q', b: 'Q' }, { a: 'Q' }],
    });
    expect(errors.join('\n')).toMatch(/minimum je 8/);
    expect(errors.join('\n')).toMatch(/duplicitní slovo/);
    expect(errors.join('\n')).toMatch(/prázdné/);
    expect(errors.join('\n')).toMatch(/chybí "theme"/);
    expect(errors.join('\n')).toMatch(/stejné/);
    expect(errors.join('\n')).toMatch(/chybí "a" nebo "b"/);
  });

  it('odmítne ne-pole', () => {
    expect(validateContent({ words: {}, questions: null })).toHaveLength(2);
  });
});
