# Milník 1c – vizuální identita „karetní stůl"

Cíl: appka nevypadá jako šablona. Hlavní motiv je hrací karta – role se rozdávají jako karty u stolu.

## Hotovo
- [x] Písma uložená lokálně ve `fonts/` (OFL, funguje offline): **Unbounded** na logo, nadpisy, čísla a tajné slovo; **Onest** na běžný text. Jen latin + latin-ext (čeština).
- [x] Pozadí = stůl: tmavě modrá (světlé téma šedomodrá), jemné zrno plsti (SVG šum) a jedno pomalé světlo v barvě režimu. Barevné skvrny zrušeny.
- [x] Úvod: vějíř tří karet (rub Slova, rub Otázky, červená karta s maskou), jednorázová animace rozevření, logo na dva řádky.
- [x] Rub karty role: papírový okraj, kosočtverečný vzor v barvě režimu, medailon s číslem hráče.
- [x] Líc karty: papír v obou tématech, rohové indexy s číslem hráče (jako na skutečné kartě). Impostor = červená karta s maskou.
- [x] Nastavení: hráči + impostoři v jednom panelu s náhledem stolu (malé karty, impostoři červeně), režim jako dvě dlaždice s popisem, přepínač místo zaškrtávátka, „Rozdat role" přilepené dole.
- [x] Předávání: odznak kola + tečky průběhu místo textu „hráč 1 z 4".
- [x] Kolo: pořadí jako řada malých karet s čísly, „Odhalit" červeně.
- [x] Výsledek: impostorova karta lícem nahoru, tajné slovo / otázky na papírové kartě.
- [x] Hlavní tlačítka jako „žeton" se spodní hranou, při stisku se zamáčknou.

## Ověřeno
- Viewport 390×844 a 375×667, tmavé i světlé téma, celé kolo ve Slovech i Otázkách, bez chyb v konzoli.
- Herní logika (`engine.js`) a ukládání se neměnily.

### Kontrola 2026-10-16 (viewport 375×812 a 375×667)
- [x] `git diff` projitý: engine ani ukládání se nezměnily, všechny třídy z JS mají pravidlo v CSS.
- [x] Vitest: 35 testů prochází.
- [x] Celé kolo ve Slovech i Otázkách, tmavé i světlé téma: rozdání → držení karty → swipe → kolo → odpočet → výsledek → další kolo.
- [x] Swipe doleva i obnovení rozehrané hry po reloadu fungují s novými kartami.
- [x] Dlouhý obsah: všech 110 slov a 210 otázek se vejde na kartu role i na výsledek (okraj ≥ 14 px, nic nepřetéká ani se neláme uprostřed). Nejdelší: „rytířské brnění" / „zvonek ve škole", téma „Vesmír a přírodní jevy", otázka „Která filmová série by si zasloužila pokračování?".
  - Opraveno: slovo jako „krasobruslení" se lámalo na „krasobrusle-ní", teď se podle délky zmenší písmo.
- [x] `prefers-reduced-motion`: vějíř má klidový stav totožný s koncem animace, takže se po vypnutí animace nikam neposune. (Náhled v Claude app režim neumí emulovat, ověřeno porovnáním transformací.)

## Ještě vyzkoušet na telefonu
- Jak působí písmo Unbounded u dlouhých slov a otázek.
- `prefers-reduced-motion` ve skutečném systémovém nastavení (vějíř se nemá hýbat).

## Drobnosti k rozhodnutí
- Náhled stolu v nastavení kreslí impostory vždy jako poslední kartičky. Je to jen ozdoba (`aria-hidden`), ale může svádět k dojmu, že impostor je poslední hráč.
- Chrome na každé načtení hlásí `preload … not used within a few seconds` u obou latin woff2. Písma se načtou a preload se využije (jeden request), takže jde o planý warning – dá se umlčet zrušením `<link rel="preload">` za cenu o něco pomalejšího prvního vykreslení.
