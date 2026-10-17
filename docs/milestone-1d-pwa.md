# Milník 1d – verze 1.0 jako instalovatelná PWA (jen lokální režim)

Cíl: hru jde nainstalovat na plochu a zahrát bez internetu. Online multiplayer je odložený na milník 2.

## Hotovo
- [x] Vstup do online režimu je skrytý (tlačítka „Založit místnost" a „Připojit se" zůstávají v HTML s atributem `hidden`, `?room=` se ignoruje). Kód v `src/online/` se nemaže, jen ho nic neimportuje.
- [x] Lokální hra nepotřebuje síť ani Supabase – ověřeno, že žádný načtený modul `src/online/*` ani klíče z `config.js` nepoužívá.
- [x] `manifest.webmanifest`: name/short_name, `display: standalone`, `orientation: portrait`, relativní `start_url` i `scope` (`./`), barvy podle designu, `lang: cs`.
- [x] Ikony v `icons/`: zdrojové SVG + PNG 192, 512, maskable 512 (motiv v bezpečném kruhu), apple-touch 180, favicon (SVG + 32px PNG).
- [x] iOS meta tagy, `viewport-fit=cover` a výřez ošetřený přes `env(safe-area-inset-*)` nahoře, dole i po stranách.
- [x] `sw.js`: precache všech 31 souborů appky (HTML, JS, CSS, písma, `content/*.json`, ikony), cache-first, verzovaná cache (`mistryimpostor-v1.0.0`) a mazání starých verzí při aktivaci.
- [x] Při nové verzi se ukáže toast „Nová verze je připravená – Obnovit"; po klepnutí převezme řízení nový worker a stránka se obnoví.
- [x] Relativní cesty všude – ověřeno spuštěním z podsložky (`/mistryimpostor/`), kde se service worker registruje se scope `/mistryimpostor/` a precache ukládá soubory pod touto cestou.

## Ověřeno
- Vitest: 35 testů prochází.
- Manifest i všechny ikony se načtou (200) a mají správné typy; splněná kritéria instalovatelnosti (name, ikony 192 + 512, standalone, scope, service worker s fetch handlerem).
- S vypnutým serverem se všech 31 souborů (včetně `content/*.json`) servíruje z cache a projde celé kolo ve Slovech i v Otázkách.

## Neověřeno v tomhle prostředí
- **Studený start bez sítě** (zavřít a znovu otevřít appku offline) a **instalace na plochu**. Náhledový prohlížeč v Claude app neumí načíst stránku, kterou řídí service worker – navigaci řeší mimo SW, takže reload bez serveru skončí chybovou stránkou, i když podsoubory z cache jdou. V běžném Chrome ani na telefonu tohle omezení není.
- Doporučený postup na telefonu: otevřít Pages adresu, přidat na plochu, zapnout režim letadlo a spustit appku z ikony.
