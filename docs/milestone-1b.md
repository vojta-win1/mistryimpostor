# Milník 1b – vizuál a UX lokálního režimu

Cíl: lokální hra na jednom telefonu působí jako hotová appka – barvy podle režimu, animace, zvuky, haptika, časomíra a odolnost proti reloadu.

Omezení: jen CSS/SVG (žádné rastrové obrázky), žádné nové knihovny, všechno vlastní kód. Mobil first (~380 px), světlé i tmavé téma, `prefers-reduced-motion` respektovat všude, kde se něco hýbe. Commit po každém bodu.

## 1. Barevný systém
- [x] Tokeny v `:root`: slova fialová, otázky oranžová, impostor červená (plná barva, jemné pozadí, text na barvě), zvlášť pro světlé a tmavé téma.
- [x] `--accent` se přepíná podle režimu (`body[data-mode]`), impostor má vždy červenou.
- [x] Nastavení, karty rolí i výsledek používají tokeny, žádné natvrdo zadané barvy mimo `:root`.

## 2. Animované pozadí
- [x] Rozmazané barevné skvrny (CSS radiální gradienty – vypadají jako `filter: blur`, ale jsou na mobilu levnější) za obsahem, barvy z tokenů aktuálního režimu.
- [x] Pomalý pohyb přes `@keyframes`; při `prefers-reduced-motion: reduce` stojí.
- [x] Text zůstává čitelný (dostatečný kontrast v obou tématech).

## 3. Karta s rolí – 3D flip a držení
- [x] Obrazovka „předání" a role sloučené: karta s rubem „Hráč N – podrž pro zobrazení".
- [x] Přidržení (`pointerdown`) kartu otočí 3D flipem, puštění (`pointerup`/`pointercancel`/`pointerleave`) ji hned zakryje.
- [x] Ovladatelné i klávesnicí (mezerník/Enter drží kartu), bez kontextového menu a označování textu při long-pressu.
- [x] „Předat dál" je aktivní až poté, co hráč roli aspoň jednou viděl.

## 4. Swipe doleva = předat dál
- [x] Tažení karty doleva ji posouvá za prstem; po překročení prahu odletí a jde se na dalšího hráče, jinak se vrátí.
- [x] Během tažení je karta zakrytá (další hráč nic nezahlédne).
- [x] Funguje jen po zobrazení role; tlačítko zůstává jako alternativa.

## 5. Přechody mezi obrazovkami
- [x] Vpřed slide zprava, zpět slide zleva, jinak fade (View Transitions API, fallback CSS animace).
- [x] Pozadí a hlavička se při přechodu nehýbou; `prefers-reduced-motion` = bez animace.

## 6. Odhalení
- [x] „Odhalit" → odpočet 3‑2‑1 přes celou obrazovku.
- [x] Výsledek s impostorem v červené a konfetami (vlastní `<canvas>` částice).
- [x] Vibrace přes `navigator.vibrate` (kde je podporované).
- [x] Reduced motion: odpočet bez animací, bez konfet.

## 7. Zvukové efekty
- [x] Web Audio API, zvuky syntetizované v kódu (klik, otočení karty, swipe, tik odpočtu, fanfára odhalení, konec časomíry).
- [x] Tlačítko ztlumit v hlavičce (SVG ikona), stav v `localStorage`.
- [x] `AudioContext` se vytváří až po prvním gestu uživatele.

## 8. Wake lock
- [x] `navigator.wakeLock` drží displej zapnutý od rozdání do návratu do nastavení.
- [x] Po návratu do aplikace (`visibilitychange`) se zámek obnoví; bez podpory tiše nic.
- _Ověřeno se stubem `navigator.wakeLock` (náhled v Claude app oprávnění zamítá) – na skutečném telefonu ještě vyzkoušet._

## 9. Časomíra
- [x] Nastavení „Časomíra na kolo": vypnuto / 30 / 60 / 90 s.
- [x] Kruhová SVG časomíra na obrazovce kola, klepnutím pauza/pokračování, tlačítko znovu.
- [x] Posledních 5 s tiká, na konci zvuk + vibrace + červená.

## 10. Obnovení rozehrané hry
- [ ] Stav hry (engine, aktuální hráč, obrazovka, časomíra) se ukládá do `localStorage`.
- [ ] Po reloadu se hra obnoví na stejné obrazovce; karta je vždy zakrytá.
- [ ] Uložená hra starší než 12 h se zahodí; poškozená data nerozbijí start.

## Ověření
- Mobilní viewport 375×812, světlé i tmavé téma, celé kolo ve Slovech i Otázkách.
- Reduced motion: nic se nehýbe, hra jde dohrát.
- Reload uprostřed předávání, během kola a na výsledku.
