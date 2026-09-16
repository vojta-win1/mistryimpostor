# Milník 1 – hratelný lokální režim + online rozdání rolí

Cíl: parta si může zahrát na jednom telefonu (kompletně) a v online režimu se všichni připojí, host odstartuje kolo a každý vidí na svém zařízení svoji roli. Hlasování a skóre online jsou až milník 2.

Postupuj v tomto pořadí a po každém kroku commitni.

## 1. Kostra a obsah
- [ ] Založ strukturu podle `CLAUDE.md`, `index.html` s prázdnými obrazovkami, `styles/main.css` (mobil first, světlé + tmavé téma).
- [ ] `content/words.json` – přenes témata a slova ze souboru `legacy/impostor-slova.html` (dodám do repa). Minimálně 8 témat po 15 slovech.
- [ ] `content/questions.json` – přenes dvojice z `legacy/impostor-otazky.html`. Zatím beze změn, přepisujeme později.
- [ ] `src/game/engine.js` + testy (vitest): `createGame(settings)`, `dealRound(state, content)`, `nextRoundState`. Pokryj: limit impostorů, historie losu, neopakování obsahu, losování a/b u otázek.

## 2. Lokální režim
- [ ] Úvodní obrazovka: tlačítka „Hrát na jednom telefonu", „Založit místnost", „Připojit se".
- [ ] Nastavení: počet hráčů (3–12), impostorů (1–4), režim Slova/Otázky, přepínač „Impostor ví, že jím je", výběr témat (u slov).
- [ ] Sekvence: „Telefon dej hráči N" → „Ukázat" → role → „Skrýt a předat dál" → po posledním hráči obrazovka kola (pořadí odpovědí od náhodného hráče) → „Odhalit" → výsledek → „Další kolo" (nový los, stejné nastavení) / „Nastavení".
- [ ] Obrazovka role: slovo velkým písmem, u impostora jen téma (u slov) nebo jeho otázka (u otázek) s varováním, pokud je přepínač zapnutý.

## 3. Supabase
- [ ] `supabase/schema.sql`: tabulky `rooms`, `players`, RLS (hráč vidí jen svou místnost, píše jen svůj řádek; host mění místnost), Realtime publikace pro obě tabulky.
- [ ] RPC `create_room(mode)`, `join_room(code, name)`, `my_role(room_id)` – vrací jen tajemství pro volajícího hráče.
- [ ] `src/online/supabase.js`: klient + `signInAnonymously` při načtení.
- [ ] Do `README.md` napiš, jak vytvořit Supabase projekt, spustit `schema.sql` v SQL editoru a doplnit klíče do `src/config.js`.

## 4. Online lobby a rozdání
- [ ] Založit místnost → zobrazí kód, QR (odkaz `?room=KÓD`) a živý seznam hráčů.
- [ ] Připojit se → jméno + kód (nebo předvyplněný z URL) → čeká v lobby, vidí ostatní.
- [ ] Host: stejné nastavení jako lokálně (počet hráčů se bere z počtu připojených), tlačítko Start aktivní od 3 hráčů.
- [ ] Start → host zavolá `dealRound` z enginu a uloží kolo do `rooms.round`; klienti přes Realtime přejdou do fáze `reveal` a načtou `my_role`.
- [ ] Obrazovka role online: zakrytá karta, „podrž pro zobrazení" (role vidět jen při držení prstu), pořadí odpovědí, tlačítko „Odhalit řešení" jen u hosta → všem se ukáže, kdo byl impostor.
- [ ] Host „Další kolo" / „Zpět do lobby". Odpojení hráče označit `connected=false`, host ho může odebrat.

## 5. PWA a deploy
- [ ] `manifest.webmanifest` (název „Mistr Impostor", ikona, standalone), `sw.js`.
- [ ] GitHub Pages z `main`. Ověř, že `?room=KÓD` funguje i po instalaci na plochu.

## Ověření na konci
- Lokální hra na 4 hráče projde 3 kola bez opakování impostora a slova.
- Online: 3 zařízení (nebo 3 okna prohlížeče v anonymním režimu), host odstartuje, každý vidí jinou roli, impostor nevidí slovo skupiny (zkontroluj v Network tabu, že tajemství druhé strany vůbec nedorazí).
