# Prompty a spolupráca s AI

Hra **Zápalkovo** vznikla v spolupráci s nástrojom **Claude Code** (Anthropic). Nižšie sú naše prompty v poradí, v akom sme ich zadali (doslovne, vrátane preklepov), a potom opis toho, ako AI postupovala.

## Prompty (chronologicky)

### 1. Zadanie a požiadavka na plán

K promptu bolo priložené PDF so zadaním záverečného projektu.

> Na zaklade zadania Priprav plan na implementaciu, opytaj sa ma na otazky o tehcnologiach a o vsetkom co ti nie je jasne. Dbaj na pekny dizajn a responzivne spravanie, aiplikaciu prejdi cez test driven deveopment, tak aby som nemal zaidnu robotu s jej opravovanim. pouzi superpowers.

### 2. Odpovede na doplňujúce otázky

AI položila doplňujúce otázky; naše odpovede:

| Otázka | Odpoveď |
|---|---|
| Technológie | Vanilla JS (ES moduly, bez build kroku) + Vitest (unit testy) + Playwright (E2E testy) |
| Ukladanie úloh | JSON (`data/puzzles.json`) |
| Jazyk rozhrania | slovenčina + angličtina (prepínač) |
| Dizajn | „teplá škatuľka zápaliek“ (drevo, papier, červené hlavičky) |
| Umiestňovanie zápaliek | voľné ťahanie + prichytenie k slotom (snap) |
| Kontrola riešenia | zoznam riešení + vyhodnotenie rovnice |
| Video | nahrávanie canvasu (`MediaRecorder`) |
| Otáčanie zápalky | dvojklik/dvojťuk + kláves R + tlačidlo |
| Názov hry | Zápalkovo |
| Git | áno (priezvisko do názvu ZIP-u doplníme neskôr) |
| Server | HTTPS školský server |

### 3. Schválenie plánu

Plán sme schválili v režime plánovania (plan mode).

### 4. Spôsob vykonania

> Subagent-driven

(Zvolili sme vykonanie plánu pomocou subagentov.)

## Ako AI pracovala

1. **Brainstorming a otázky.** Podľa postupu *superpowers* AI najprv prečítala zadanie, vypísala nejasnosti a položila otázky (pozri bod 2). Až po odpovediach navrhla riešenie.
2. **Návrh a plán.** Návrh (architektúra, dátový model, formát JSON, UX, spôsob overenia) je v `docs/superpowers/specs/2026-11-17-zapalkovo-design.md`. Podrobný implementačný plán s 19 úlohami (každá s testami, súbormi a krokmi) je v `docs/superpowers/plans/2026-11-17-zapalkovo.md`. Oba dokumenty sú v git repozitári (nie v ZIP-e).
3. **19 úloh cez TDD.** Hlavný agent („controller“) zadával úlohy jednu po druhej. Každú úlohu implementoval samostatný subagent podľa test-driven development: najprv napísal test, spustil ho a overil, že padá, potom napísal minimálny kód, kým test neprešiel, a zmenu commitol. Postup: geometria a glyfy → rímske čísla a vyhodnotenie výrazov → dekódovanie rovníc → mriežky útvarov → stav úlohy → validátor a solver → 18 úloh s dátovými testami (pri záverečnej kontrole pribudla 19.) → fronta úloh a úložisko → preklady → senzory → stránka a dizajn → SVG doska s ťahaním → herný tok → senzory v UI → video → PWA → finálne doladenie a dokumentácia.
4. **Kontrola recenzentom.** Po každej úlohe ďalší subagent (reviewer) skontroloval kód oproti zadaniu úlohy a kvalite. Nálezy sa opravili v samostatných commitoch (napr. `fix(core): rotation always releases slot`, `fix(pwa): resilient caching and timeout`).
5. **Rozhodnutia controllera.** Keď sa počas práce ukázala nejasnosť alebo chyba v pláne (napr. presná geometria rímskeho V, porovnávanie textov rovníc bez medzier, parametre detekcie zatrasenia, správanie otáčania), controller vydal záväzné rozhodnutie („ruling“), ktoré platilo pre ďalšie úlohy.
6. **Overenie.** Na konci prebehli všetky unit testy, E2E testy v Chromiu, Firefoxe a emulovanom mobile, html-validate a stylelint, a vizuálna kontrola screenshotov (telefón na výšku aj na šírku, tablet, desktop; svetlý aj tmavý režim).

AI vygenerovala kód, štýly, úlohy, testy a dokumentáciu; my sme zadávali požiadavky, rozhodovali o otázkach a výsledok sme prešli a zaň zodpovedáme. Reálne senzory, inštaláciu PWA na telefóne a W3C validáciu nasadenej stránky overujeme ručne.
