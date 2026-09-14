# mistryimpostor

Party hra „Impostor" pro partu kamarádů. Webová PWA, později obal přes Capacitor na Google Play / App Store. Uživatelské rozhraní je celé **česky**, kód a identifikátory anglicky.

## Dva režimy hraní (stejná herní logika)

1. **Lokální** – jeden telefon koluje. Každý hráč má číslo, zobrazí si roli, skryje ji a předá dál. Bez serveru.
2. **Online** – host založí místnost, ostatní se připojí kódem/QR ze svých zařízení. Stav místnosti žije v Supabase, klienti ho odebírají přes Realtime.

## Dva herní režimy (přepínatelné v lobby)

- **Slova** – všichni dostanou stejné tajné slovo, impostor vidí jen jeho téma (kategorii).
- **Otázky** – všichni dostanou stejnou otázku, impostor dostane jinou, ale podobnou (stejný prostor odpovědí, jiný úhel). Přepínač „impostor ví, že jím je" (když ne, odpovídá poctivě a neví, že má jinou otázku).

Kolo: hráči postupně nahlas odpoví, hlasují, kdo je impostor, odhalení, skóre, další kolo se stejnou partou.

## Stack – neměnit bez domluvy

- Čistý HTML + CSS + JS (ES modules), **bez frameworku a bez build kroku**. Deploy = GitHub Pages z větve `main`, složka `/` (nebo `/docs`).
- Supabase: anonymní auth (`signInAnonymously`), Postgres tabulky, Realtime (postgres_changes). Klíče v `src/config.js` (anon key je veřejný, to je v pořádku; RLS chrání data).
- PWA: `manifest.webmanifest` + minimální service worker (cache statiky, network-first pro Supabase).
- Žádné externí UI knihovny. QR kód generovat malou knihovnou přes CDN (např. `qrcode` z jsDelivr) nebo vlastní implementací.

## Struktura repa

```
index.html            jediná stránka, obrazovky se přepínají v JS
src/
  main.js             router obrazovek, bootstrap
  game/
    engine.js         čistá herní logika (los rolí, historie, skóre) – bez DOM, bez Supabase
    content.js        načtení balíčků z /content
  local/              lokální režim (kolující telefon)
  online/
    supabase.js       klient
    room.js           založení/připojení, host logika
    sync.js           Realtime odběr stavu
  ui/                 renderování obrazovek, komponenty
  config.js           SUPABASE_URL, SUPABASE_ANON_KEY
content/
  words.json          [{ "theme": "Příroda", "words": ["…"] }, …]
  questions.json      [{ "a": "…", "b": "…", "tags": ["…"] }, …]
supabase/
  schema.sql          tabulky + RLS + realtime publikace
styles/
  main.css
manifest.webmanifest
sw.js
```

## Herní logika – pevná pravidla

- Hráčů 3–12, impostorů 1–4, vždy `impostors <= players - 2`.
- Los impostora používá `crypto.getRandomValues`, ne `Math.random`.
- Historie: čísla/ID impostorů z posledních `min(3, players-2)` kol jsou z losu vyloučena, dokud to jde. Slova a otázky použité v posledních 15 kolech se neopakují.
- U otázek se náhodně losuje, která z dvojice (`a`/`b`) jde skupině a která impostorovi.
- `engine.js` musí být testovatelný samostatně: funkce berou stav a vracejí nový stav.

## Datový model (Supabase)

- `rooms(id uuid pk, code text unique 4 velká písmena bez O/0/I/1, host_id uuid, mode text 'words'|'questions', settings jsonb, phase text, round jsonb, created_at)`
- `players(id uuid pk, room_id fk, user_id uuid, name text, seat int, score int, connected bool, joined_at)`
- `round jsonb` na místnosti drží aktuální kolo: `{ number, impostorIds, secret, impostorSecret, theme, answers order, votes: {playerId: targetId}, revealed }`. Role se **nikdy** neposílají všem v čitelné podobě – tajemství pro daného hráče se čtou přes RLS view / RPC, aby klient neimpostora nedostal impostorovu otázku a naopak.
- Host je jediný, kdo mění `phase` a `round`; ostatní hráči zapisují jen svůj řádek v `players` a svůj hlas (RPC `cast_vote`).
- Místnosti starší než 24 h se dají smazat (cron nebo ručně), nic víc neperzistujeme.

## Fáze místnosti

`lobby → dealing → reveal → answering → voting → result → (lobby | dealing)`

## Konvence

- Commity malé, česky nebo anglicky, klidně česky.
- Každý milník má vlastní soubor `docs/milestone-N.md` se zadáním; hotové položky odškrtávat.
- Mobil first: cílový viewport ~380 px, velké dotykové plochy (min 44 px), tmavé i světlé téma přes `prefers-color-scheme`.
- Neinstalovat nic přes npm, pokud to není nutné pro testy (`vitest` pro `engine.js` je OK).
