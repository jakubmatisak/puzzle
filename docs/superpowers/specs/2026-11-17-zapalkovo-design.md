# Zápalkovo – plán implementácie (WEBTE1 záverečné zadanie)

## Kontext
Záverečné zadanie WEBTE1 (ZS 2026/27, deadline 30.12.2026 20:00): PWA hra **zápalkové hlavolamy** s drag & drop (myš aj prst), responzívna vektorová grafika, ≥15 úloh v 3 kategóriách (čísla, rímske čísla, logické) v JSON, náhodné poradie bez opakovania s perzistenciou, nápoveda/riešenie/reset, senzory na mobile (náklon doľava = riešenie, 2× zatrasenie = reset), video záznam, návod optimalizovaný pre tlač, favicon, názov, W3C validita, Chrome + Firefox. ZIP `ZZ_priezvisko.zip` s `index.html`, `README.md`, `PROMPTS.md` v koreni. Kód musí byť obhájiteľný → jednoduchý stack bez buildu.

Používateľ chce: pekný dizajn, responzivitu, prísne TDD (žiadna práca s opravami), použitie superpowers.

## Rozhodnutia (od používateľa)
| Oblasť | Voľba |
|---|---|
| Stack | Vanilla HTML/CSS/ES moduly, **bez build kroku**; Vitest (unit, jsdom) + Playwright (E2E) iba ako dev závislosti |
| Dáta | `data/puzzles.json` |
| Jazyk | SK + EN prepínač (i18n slovníky, uložené v localStorage) |
| Dizajn | „Teplá škatuľka zápaliek“ – drevo/papier/červené hlavičky, retro etiketa, + dark mode |
| Umiestnenie | Voľný ťah + **snap do slotov** (pri pustení sa prichytí k najbližšiemu slotu so zhodnou orientáciou, inak späť / do odkladacej plochy) |
| Kontrola | Zoznam riešení v JSON **+** vyhodnotenie výrazu pre rovnice (arabské aj rímske) pri dodržaní počtu ťahov |
| Video | Board renderovaný aj do `<canvas>` → `captureStream()` + `MediaRecorder` (WebM), stiahnutie; ten istý renderer prehrá animáciu riešenia |
| Rotácia | Dvojklik/dvojťuk (45°), klávesa R, tlačidlo „Otočiť“ pri vybranej zápalke |
| Názov | **Zápalkovo** |
| Git | áno, commit po každom TDD kroku; ZIP skript s placeholderom `ZZ_priezvisko` |
| Hosting | HTTPS školský server; všetky cesty relatívne (funguje v podpriečinku), SW scope `./` |

Prostredie: Node 26.13, npm 11.17, git 2.51 (Windows).

## Architektúra

```
index.html                 – jediná stránka: hlavička, výber kategórie, hra, návod (sekcie/hash routing)
manifest.webmanifest, sw.js
favicon.svg, icons/ (192, 512, maskable PNG – generované skriptom z SVG cez Playwright)
css/  tokens.css (farby, light/dark), base.css, layout.css, board.css, print.css
data/puzzles.json
js/core/   (čisté funkcie, 100 % unit testované, bez DOM)
  geometry.js     – slot = {id,x,y,angle}; vzdialenosť, normalizácia uhla mod 180, findSnapSlot()
  glyphs.js       – šablóny slotov: 7-seg číslica, operátory (+ − = × < >), rímske znaky (I V X), layout bunky → sloty
  decode.js       – obsadené sloty → znaky (7-seg tabuľka, rímske vzory) → reťazec výrazu
  roman.js        – romanToInt s validáciou (IIII, VV… neplatné)
  expression.js   – tokenizer + vyhodnotenie (+ − ×, priorita; =, <, >, ≠ ako porovnanie; reťazenie X=VIII-II)
  puzzle-state.js – stav úlohy (match → slot / tray pozícia, rotácia), apply move, movesUsed, reset
  validator.js    – isSolved(state, puzzle): zhoda so zoznamom riešení ALEBO (kategória rovnica && ťahy == povolené && výraz pravdivý)
  queue.js        – nextPuzzle(category): náhodný výber z neodohraných, perzistencia „played“ per kategória, reset po vyčerpaní; RNG injektovateľný
  storage.js      – localStorage wrapper s try/catch a in-memory fallbackom
  i18n.js         – t(key), prepínanie SK/EN
  sensors-logic.js– detekcia náklonu doľava (gamma < −35°, hysteréza, debounce) a dvojitého zatrasenia (2 špičky akcelerácie v okne ~1 s) nad vzorkami
  puzzles-schema.js – validácia štruktúry JSON
js/ui/
  board.js        – SVG render (zápalka: zaoblené drievko + oválna hlavička s gradientom), Pointer Events (mouse+touch+pen, setPointerCapture, touch-action:none), drag ghost, zvýraznenie cieľového slotu
  canvas-renderer.js – kreslenie toho istého stavu do canvasu (pre video)
  recorder.js     – start/stop/download, detekcia podpory (mimeType fallback vp9→vp8→webm)
  sensors.js      – DeviceOrientation/DeviceMotion listenery, iOS requestPermission tlačidlo
  controls.js, router.js, app.js, sw-register.js
tests/unit/*.test.js, tests/e2e/*.spec.js
scripts/make-icons.mjs, scripts/make-zip.mjs
README.md, PROMPTS.md, docs/superpowers/specs/…-design.md, docs/superpowers/plans/…
```

### Formát JSON (návrh)
```json
{ "version": 1,
  "categories": [{ "id": "numbers", "name": {"sk":"Rovnice","en":"Equations"}, "type": "equation" }, …],
  "puzzles": [{
    "id": "num-01", "category": "numbers", "moves": 1,
    "task":  {"sk":"Presuň 1 zápalku, aby platila rovnosť.","en":"…"},
    "hint":  {"sk":"…","en":"…"},
    "layout": [ {"glyph":"digit"}, {"glyph":"op"}, {"glyph":"digit"}, {"glyph":"op"}, {"glyph":"digit"} ],
    "start":  ["c0.a","c0.b", …],              // obsadené sloty
    "solutions": [ ["…"], ["…"] ],             // ≥1, aspoň jedna úloha má viac
    "solutionSteps": [ {"from":"c0.g","to":"c1.v"} ]  // pre animáciu riešenia
  }]
}
```
Logické úlohy používajú `"layout": [{"glyph":"free","slots":[{id,x,y,angle},…]}]`. Odkladacia plocha (tray) pre úlohy typu „odober N zápaliek“.

### Obsah úloh (min. 15, cieľ 18)
- **Rovnice/nerovnice (6)** – napr. 3×3=5 → 3×3=9 ap.; aspoň jedna nerovnica; aspoň jedna s **2 riešeniami**; aspoň jedna vyžaduje **otočenie** a **prekríženie (−→+)**.
- **Rímske (6)** – napr. X=VIII−II, nerovnice s < >, diagonály vo V/X (rotácia o 45°).
- **Logické (6)** – trojuholníky, štvorce (presuň/odober N zápaliek), rybka/pohár.
Každá úloha musí prejsť dátovým testom (nižšie) – žiadna nerozriešiteľná úloha sa nedostane do hry.

### UX / dizajn
- Mobile-first, CSS Grid/flex, `clamp()` typografia, SVG `viewBox` škálovanie, safe-area insets, min. 44 px dotykové ciele.
- Obrazovky: Úvod (3 karty kategórií s počtom vyriešených) → Hra (zadanie, počítadlo ťahov, board, panel: Nápoveda, Riešenie, Reset, Otočiť, Nahrávať, Ďalšia) → Úspech (konfety z hlavičiek, „Ďalšia úloha“) → Návod.
- Návod: pravidlá, ovládanie desktop vs **sekcia iba pre mobil** (náklon, zatrasenie, povolenie senzorov), zopakované požiadavky zadania. `print.css` skryje hlavičku/menu/board/ovládanie.
- `prefers-reduced-motion`, `prefers-color-scheme`, klávesnicové ovládanie (Tab na zápalku, šípky posun, R otočenie), aria-live hlásenia.
- Overenie dizajnu: `ui-design-review:review` + screenshoty 375/768/1440 px v oboch témach.

## Postup (TDD, superpowers)
Po schválení: uložiť dizajn do `docs/superpowers/specs/2026-11-17-zapalkovo-design.md`, `superpowers:writing-plans` → detailný plán, vykonanie cez `superpowers:subagent-driven-development` s `superpowers:test-driven-development` (red → green → refactor, commit po každom kroku), na konci `superpowers:requesting-code-review` a `superpowers:verification-before-completion`.

Fázy:
1. **Scaffold** – `git init`, `package.json` (vitest, jsdom, @playwright/test, html-validate, stylelint), `.gitignore`, `npm run serve` (malý statický server v `scripts/serve.mjs`), Playwright config (Chromium + Firefox + mobile Chrome/Pixel emulácia).
2. **Core logika (unit TDD)** – geometry → glyphs → roman → expression → decode → puzzle-state → validator → queue/storage → i18n → sensors-logic → puzzles-schema.
3. **Dátové testy** – pre každú úlohu: schéma platná; všetky sloty v `start`/`solutions` existujú; počet zápaliek v štarte = v riešení (resp. − odobraté); každé riešenie dosiahnuteľné presne `moves` ťahmi; validator(riešenie)=true, validator(štart)=false; `solutionSteps` aplikované na štart dajú riešenie; ≥5 úloh/kategória; ≥1 úloha s viac riešeniami; ≥1 vyžaduje rotáciu a prekríženie.
4. **UI board** – SVG render, pointer drag & snap, rotácia, výber; jsdom testy + Playwright (myš aj `page.touchscreen`/touch emulácia).
5. **Herný tok** – router, výber kategórie, queue s perzistenciou (E2E: zahraj 3 z 6, reload, zvyšné 3 sa neopakujú), nápoveda, riešenie (animácia), reset, úspech.
6. **Senzory** – E2E dispatch `DeviceOrientationEvent`/`DeviceMotionEvent` → riešenie / reset.
7. **Video** – canvas renderer (unit: snapshot kreslenia cez mock ctx), recorder (E2E v Chromium: vznikne Blob > 0 B, ponúkne stiahnutie).
8. **PWA** – manifest, ikony, SW (cache-first pre app shell + JSON, versioned cache), E2E: offline reload funguje.
9. **Návod + print + i18n** – E2E `emulateMedia({media:'print'})` → board/menu skryté.
10. **Polish** – dizajn review, prístupnosť, `html-validate` + stylelint v CI skripte, manuálna kontrola W3C validátorom, README (popis, AI použitie), PROMPTS.md, `npm run zip`.

## Overenie
- `npm test` – všetky unit + dátové testy zelené.
- `npm run test:e2e` – Chromium + Firefox + mobilná emulácia (drag myšou aj dotykom, rotácia, prekríženie, perzistencia poradia, senzory, nahrávanie, offline PWA, print).
- `npm run lint` – html-validate, stylelint bez chýb; ručne validator.w3.org/nu na nasadenej URL.
- Ručne v prehliadači (Claude Browser pane / Playwright): screenshoty 375/768/1440, light/dark; Lighthouse PWA inštalovateľnosť.
- Na reálnom mobile po nasadení (HTTPS): náklon, dvojité zatrasenie, inštalácia PWA – to musí overiť používateľ (emulácia senzorov ≠ reálny hardvér).
