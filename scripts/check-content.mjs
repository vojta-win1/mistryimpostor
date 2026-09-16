// Ověří content/*.json: npm run check:content
import { readFile } from 'node:fs/promises';
import { validateContent } from '../src/game/content.js';

async function read(name) {
  const url = new URL(`../content/${name}`, import.meta.url);
  const raw = await readFile(url, 'utf8');
  try {
    return JSON.parse(raw.replace(/^﻿/, ''));
  } catch (e) {
    console.error(`${name}: neplatný JSON (${raw.trim().length} znaků) – ${e.message}`);
    process.exitCode = 1;
    return undefined;
  }
}

const words = await read('words.json');
const questions = await read('questions.json');
if (process.exitCode) process.exit();

const errors = validateContent({ words, questions });
if (errors.length) {
  console.error(errors.join('\n'));
  process.exit(1);
}
const wordCount = words.reduce((n, t) => n + t.words.length, 0);
console.log(`OK: ${words.length} témat, ${wordCount} slov, ${questions.length} dvojic otázek`);
