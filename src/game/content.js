// Načtení a ověření balíčků z /content.

export async function loadContent(baseUrl = new URL('../../content/', import.meta.url)) {
  const [words, questions] = await Promise.all([
    fetchJson(new URL('words.json', baseUrl)),
    fetchJson(new URL('questions.json', baseUrl)),
  ]);
  const content = { words, questions };
  const errors = validateContent(content);
  if (errors.length) throw new Error(`Neplatný obsah:\n${errors.join('\n')}`);
  return content;
}

async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Nepodařilo se načíst ${url} (${res.status})`);
  return res.json();
}

const isText = (v) => typeof v === 'string' && v.trim().length > 0;

/** Vrací seznam chyb (prázdné pole = obsah je v pořádku). */
export function validateContent({ words, questions }, { minThemes = 8, minWordsPerTheme = 15 } = {}) {
  const errors = [];

  if (!Array.isArray(words)) {
    errors.push('words.json: očekávám pole témat');
  } else {
    if (words.length < minThemes) errors.push(`words.json: ${words.length} témat, minimum je ${minThemes}`);
    const themes = new Set();
    words.forEach((t, i) => {
      const at = `words.json[${i}]`;
      if (!isText(t?.theme)) return errors.push(`${at}: chybí "theme"`);
      if (themes.has(t.theme)) errors.push(`${at}: duplicitní téma "${t.theme}"`);
      themes.add(t.theme);
      if (!Array.isArray(t.words)) return errors.push(`${at} (${t.theme}): "words" musí být pole`);
      if (t.words.length < minWordsPerTheme) {
        errors.push(`${at} (${t.theme}): ${t.words.length} slov, minimum je ${minWordsPerTheme}`);
      }
      const seen = new Set();
      t.words.forEach((w, j) => {
        if (!isText(w)) errors.push(`${at} (${t.theme}).words[${j}]: prázdné nebo ne-textové slovo`);
        else if (seen.has(w)) errors.push(`${at} (${t.theme}): duplicitní slovo "${w}"`);
        seen.add(w);
      });
    });
  }

  if (!Array.isArray(questions)) {
    errors.push('questions.json: očekávám pole dvojic');
  } else {
    if (!questions.length) errors.push('questions.json: žádné otázky');
    const seen = new Set();
    questions.forEach((q, i) => {
      const at = `questions.json[${i}]`;
      if (!isText(q?.a) || !isText(q?.b)) return errors.push(`${at}: chybí "a" nebo "b"`);
      if (q.a === q.b) errors.push(`${at}: "a" a "b" jsou stejné`);
      if (q.tags !== undefined && !(Array.isArray(q.tags) && q.tags.every(isText))) {
        errors.push(`${at}: "tags" musí být pole textů`);
      }
      const key = `${q.a}|${q.b}`;
      if (seen.has(key)) errors.push(`${at}: duplicitní dvojice`);
      seen.add(key);
    });
  }

  return errors;
}
