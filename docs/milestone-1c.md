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

## Ještě vyzkoušet na telefonu
- Jak působí písmo Unbounded u dlouhých slov a otázek.
- `prefers-reduced-motion` (vějíř se nemá hýbat).
