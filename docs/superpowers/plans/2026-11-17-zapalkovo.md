# Zápalkovo – Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** PWA hra zápalkových hlavolamov (WEBTE1) – drag & drop myšou aj prstom, 18 úloh v 3 kategóriách z JSON, perzistentné nerepetujúce sa poradie, nápoveda/riešenie/reset, senzory, video záznam, tlačiteľný návod, SK/EN.

**Architecture:** Statická stránka bez build kroku. Čistá herná logika v `js/core/*` (bez DOM, plne unit-testovaná), tenká UI vrstva v `js/ui/*` (SVG board s Pointer Events, canvas mirror pre video). Úlohy v `data/puzzles.json`; rovnice zapísané ako text („9+4=5“), ktorý sa kompiluje na sloty; logické úlohy nad mriežkou (štvorce) alebo trojuholníkovou mriežkou s počítaním útvarov.

**Tech Stack:** HTML5, CSS3, vanilla ES2022 moduly; dev: Vitest 3 + jsdom, @playwright/test (chromium, firefox, mobile-chrome), html-validate, stylelint + stylelint-config-standard. Node 26.

**Spec:** `docs/superpowers/specs/2026-11-17-zapalkovo-design.md`

## Global Constraints

- Žiadny build krok, žiadne runtime závislosti; všetko v `index.html` + `css/` + `js/` + `data/` funguje po nahratí na server do ľubovoľného podpriečinka → **iba relatívne cesty** (`./…`), SW scope `./`.
- Názov hry: **Zápalkovo**. UI SK (predvolené) + EN prepínač, uložený v `localStorage` kľúči `zapalkovo.lang`.
- Všetky `localStorage` kľúče majú prefix `zapalkovo.`.
- Dĺžka zápalky = **100** jednotiek SVG; snap polomer **45**; uhlová tolerancia snapu **≤ 23°** (mod 180); rotácia: `rotateStep(a) = (floor(a/45)+1)*45 mod 180`.
- Min. 5 úloh/kategória (plán: 6+6+6), ≥ 1 úloha s viacerými riešeniami, ≥ 1 vyžaduje rotáciu a ≥ 1 skladanie 2 zápaliek cez seba (+).
- Senzory: náklon doľava (roll < −35° držaný 300 ms, re-arm pri > −15°) = zobraz riešenie; 2 otrasy (|a| > 15 m/s², odstup ≥ 150 ms, v okne 1000 ms, cooldown 1500 ms) = reset.
- HTML validné (html-validate `html-validate:recommended`), CSS stylelint bez chýb; Chrome + Firefox.
- Dotykové ciele ≥ 44 px; `prefers-color-scheme` (dark), `prefers-reduced-motion`.
- Každý task: TDD (red → green → refactor) a commit; commit message končí `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Kód si študent musí vedieť obhájiť → krátke funkcie, žiadne „chytré“ triky, slovenské JSDoc komentáre pri verejných funkciách.

## Review Focus

1. **Prerušený ťah** (`pointercancel`, pustenie mimo boardu, prepnutie tabu počas ťahu) → zápalka sa vráti na pôvodné miesto, žiadny „prilepený“ drag. Test v Task 14.
2. **Pokazený/nedostupný localStorage** (nevalidný JSON, výnimka pri prístupe, privátny režim) → hra beží s pamäťou v RAM. Test v Task 10.
3. **Zmena `puzzles.json` po nasadení** (pribudne úloha, uložené ID už neexistuje) → fronta ignoruje neznáme ID a nové úlohy zaradí. Test v Task 10.
4. **Mobil na šírku** – `gamma` už neznamená náklon doľava → `effectiveRoll(beta, gamma, screenAngle)`. Test v Task 12.
5. **Nepodporovaný MediaRecorder / senzory bez povolenia (iOS)** → tlačidlo zakázané s vysvetlením / tlačidlo „Povoliť senzory“, žiadna výnimka. Test v Task 16 a 17.

---

## Data model (záväzné pre všetky tasky)

```ts
Slot  = { id: string, x: number, y: number, angle: number /*0–179*/ }
Match = { id: string /*'m0'…*/, slot: string|null, x: number, y: number, angle: number }
Board = { slots: Slot[], slotById: Map<string,Slot>, bounds:{x,y,w,h}, tray:{x,y,w,h} }
Puzzle (normalizovaná) = {
  id, category, kind: 'equation'|'shapes', mode: 'move'|'remove', moves: number,
  task:{sk,en}, hint:{sk,en},
  board: Board, start: Set<string>, solutions: Set<string>[],   // slot sety
  solutionTexts?: string[], goal?: {shape:'square'|'triangle', count:number, noLoose:boolean}
}
```

Slot ID: rovnicové bunky `c{index}.{slot}`; mriežka `h{r}-{c}`, `v{r}-{c}`; trojuholníky `a{r}-{i}`, `l{r}-{i}`, `r{r}-{i}`.

### `data/puzzles.json` formát
```json
{
  "version": 1,
  "categories": [
    {"id":"numbers","kind":"equation","name":{"sk":"Rovnice","en":"Equations"},"description":{"sk":"…","en":"…"}},
    {"id":"roman","kind":"equation","name":{"sk":"Rímske čísla","en":"Roman numerals"},"description":{…}},
    {"id":"logic","kind":"shapes","name":{"sk":"Logické útvary","en":"Shapes"},"description":{…}}
  ],
  "puzzles": [
    {"id":"num-01","category":"numbers","mode":"move","moves":1,
     "start":"9+4=5","solutions":["5+4=9"],"task":{…},"hint":{…}},
    {"id":"log-01","category":"logic","mode":"remove","moves":2,
     "board":{"type":"grid","rows":2,"cols":2},"start":"all",
     "goal":{"shape":"square","count":2,"noLoose":true},
     "solutions":[["h0-0", "…"]],"task":{…},"hint":{…}}
  ]
}
```
Rovnicové texty: znaky `0-9 + - × = < > I V X` a medzera (prázdna bunka). Štart a všetky riešenia majú rovnakú dĺžku; typ bunky na pozícii = typ prvého nemedzerového znaku na tej pozícii (medzera všade = chyba).

### Úlohy (finálny obsah; `solutions` doplniť presne podľa výstupu solvera v Task 9)
| id | štart | známe riešenie | pozn. |
|---|---|---|---|
| num-01 | `9+4=5` | `5+4=9` | |
| num-02 | `0+3=5` | `8-3=5`, `0+3=3` | + → −, rotácia (v → g) |
| num-03 | `6+4=4` | `0+4=4`, `8-4=4` | viac riešení |
| num-04 | `2×9=5` | `2×3=6` | × |
| num-05 | `2+5<3` | `2-5<9` | nerovnica |
| num-06 | `6+7=12` | `6+7=13` | dvojciferné |
| rom-01 | `VIII+I=VII ` | `VII +I=VIII` | |
| rom-02 | `XI=VIII-II` | `X =VIII+II` | skladanie + |
| rom-03 | `II >III` | `III>II ` | nerovnica |
| rom-04 | `II×II =VII` | `II×III=VI ` | × |
| rom-05 | `IV-I=VI` | `IV+I=V ` | |
| rom-06 | `IX-V= VI` | `IX-V=IV ` | |
| log-01 | grid 2×2 all, remove 2 | square=2 noLoose | riešenie: bez `h1-0`,`v0-1` |
| log-02 | grid 2×2 all, remove 2 | square=3 noLoose | bez `h0-1`,`v0-2` |
| log-03 | grid 3×3 all, remove 4 | square=5 noLoose | bez `h1-1`,`h2-1`,`v1-1`,`v1-2` |
| log-04 | grid 3×3 all, remove 8 | square=2 noLoose | bez `h1-0`,`h1-2`,`h2-0`,`h2-2`,`v0-1`,`v0-2`,`v2-1`,`v2-2` |
| log-05 | trigrid n=2 all, remove 1 | triangle=3 noLoose | bez `a1-0` |
| log-06 | trigrid n=2 all, remove 3 | triangle=1 noLoose | bez `a1-0`,`r1-0`,`l1-1` (obrázok zo zadania) |

SK/EN texty `task` a `hint` napíše implementátor (hint nesmie prezradiť riešenie priamo, iba smer, napr. „Skús zmeniť znamienko.“).

---

### Task 1: Scaffold a tooling

**Files:** Create `package.json`, `.gitignore`, `vitest.config.js`, `playwright.config.js`, `scripts/serve.mjs`, `.htmlvalidate.json`, `.stylelintrc.json`, `tests/unit/smoke.test.js`, `.gitattributes` (`* text=auto eol=lf`)

**Produces:** npm skripty `test` (vitest run), `test:watch`, `test:e2e` (playwright test), `lint` (html-validate index.html && stylelint "css/**/*.css"), `serve` (node scripts/serve.mjs, port 5173), `icons`, `zip`.

- [ ] Step 1: `npm init -y`, nastav `"type":"module"`, `npm i -D vitest jsdom @playwright/test html-validate stylelint stylelint-config-standard`, `npx playwright install chromium firefox`.
- [ ] Step 2: `scripts/serve.mjs` – `node:http` statický server z koreňa projektu, MIME mapa (html, js→text/javascript, css, json, svg, png, webmanifest→application/manifest+json, webm), 404 pre neexistujúce, zákaz `..` v ceste, `PORT` env (default 5173).
- [ ] Step 3: `playwright.config.js` – `webServer: {command:'node scripts/serve.mjs', port:5173, reuseExistingServer:true}`, `baseURL http://localhost:5173/`, projekty `chromium` (Desktop Chrome), `firefox` (Desktop Firefox), `mobile-chrome` (Pixel 7, `hasTouch`). `vitest.config.js`: `include: ['tests/unit/**/*.test.js']`, default env `node`.
- [ ] Step 4: Smoke test `expect(1+1).toBe(2)`; `npm test` → PASS.
- [ ] Step 5: Commit `chore: scaffold project tooling`.

### Task 2: Geometria (`js/core/geometry.js`)

**Produces:** `normAngle(a): number` (0–179.999, mod 180), `angleDiff(a,b): number` (0–90), `rotateStep(a): number`, `distance(p,q)`, `findSnapSlot(pos:{x,y,angle}, slots:Slot[], occupied:Set<string>, opts={radius:45, maxAngle:23}): Slot|null` (najbližší voľný slot v polomere so zhodnou orientáciou; rovnaká vzdialenosť → prvý v poradí).

- [ ] Step 1: Testy `tests/unit/geometry.test.js`:
  - `normAngle(180)===0`, `normAngle(-45)===135`, `normAngle(270)===90`
  - `angleDiff(0,170)===10`, `angleDiff(45,135)===90`
  - `rotateStep(0)===45`, `rotateStep(70)===90`, `rotateStep(135)===0`
  - snap: slot `{x:0,y:0,angle:90}`, pos `{x:30,y:10,angle:90}` → slot; pos angle 0 → `null`; vzdialenosť 50 → `null`; obsadený slot → `null`; dva sloty v polomere → bližší; angle 70 vs slot 90 → snap (diff 20), angle 45 vs slot 70 → `null` (diff 25).
- [ ] Step 2: Run `npx vitest run tests/unit/geometry.test.js` → FAIL.
- [ ] Step 3: Implementuj.
- [ ] Step 4: Run → PASS. Step 5: Commit `feat(core): geometry and snapping`.

### Task 3: Glyfy a layout rovníc (`js/core/glyphs.js`)

**Produces:**
- `CELL = { digit:{advance:160}, op:{advance:140}, rel:{advance:140}, roman:{advance:80} }`
- `cellTypeOf(ch): 'digit'|'op'|'rel'|'roman'|null` (medzera → null)
- `cellSlots(type, index, ox): Slot[]` – lokálne súradnice (+ox):
  - digit: `a(50,0,0) b(100,50,90) c(100,150,90) d(50,200,0) e(0,150,90) f(0,50,90) g(50,100,0)`
  - op: `h(50,100,0) v(50,100,90) x1(50,100,45) x2(50,100,135)`
  - rel: `e1(50,80,0) e2(50,120,0) u1(50,75,150) u2(50,75,30) l1(50,125,30) l2(50,125,150)` (`<` = u1+l1, `>` = u2+l2)
  - roman: `i(34,100,90) vl(17,100,75) vr(51,100,105) xa(34,100,75) xb(34,100,105)`
- `ENCODE` (kanonické sady): digit `0:abcdef 1:bc 2:abdeg 3:abcdg 4:bcfg 5:acdfg 6:acdefg 7:abc 8:abcdefg 9:abcdfg`; op `+:h,v -:h ×:x1,x2`; rel `=:e1,e2 <:u1,l1 >:u2,l2`; roman `I:i V:vl,vr X:xa,xb`
- `layoutEquation(texts:string[]): {types:string[], slots:Slot[], width:number}` – typy buniek z textov (pravidlo z Data model), bunky zľava doprava s `advance`, slot id `c{index}.{name}`; hádže `Error` pri nezhode dĺžok, medzere všade alebo kolízii typov.
- `encodeText(text, types): Set<string>` – slot ID obsadené pre text.

- [ ] Step 1: Testy: `cellTypeOf('7')==='digit'`, `('×')==='op'`, `('<')==='rel'`, `('V')==='roman'`, `(' ')===null`; `layoutEquation(['9+4=5'])` → types `['digit','op','digit','rel','digit']`, slot `c1.v` má `x === 160+50`; `encodeText('1', ['digit'])` = `{c0.b,c0.c}`; `layoutEquation(['VII ','VI I'])` → 4× roman; `layoutEquation(['1+','12'])` hádže (op vs digit); rôzne dĺžky hádže; každý slot má dĺžkovú zápalku – pre V ramená over, že koncové body `vl` a `vr` sa stretnú dole (|Δ| < 3).
- [ ] Step 2–4: FAIL → implementácia → PASS. Step 5: Commit `feat(core): glyph templates and equation layout`.

### Task 4: Rímske čísla a výrazy (`js/core/roman.js`, `js/core/expression.js`)

**Produces:** `romanToInt(s): number|null` (strict regex `^(XC|XL|L?X{0,3})(IX|IV|V?I{0,3})$`, prázdne → null); `evaluate(tokens: (number|string)[]): boolean` – tokeny čísla a `+ - × = < >`; gramatika `expr (rel expr)+`, `×` má prednosť, vzťahy reťazené (všetky musia platiť); nevalidná postupnosť → `false`. `tokenize(chars: {type, ch}[]): tokens|null` – súvislé `digit` bunky tvoria číslo (úvodná nula pri viacciferných → null), súvislé `roman` bunky rímske číslo (cez `romanToInt`), prázdne bunky sa preskakujú.

- [ ] Step 1: Testy: `romanToInt('VIII')===8`, `('IX')===9`, `('IIII')===null`, `('VV')===null`, `('XIX')===19`; `evaluate([5,'+',4,'=',9])===true`, `([2,'-',5,'<',9])===true`, `([2,'+',3,'×',2,'=',8])===true`, `([3,'>',2])===true`, `([3,'+',4])===false` (bez vzťahu), `(['+',3,'=',3])===false`, `([1,'=',1,'=',2])===false`; tokenize: digit bunky `'0','6'` → null (úvodná nula), `'1','3'` → `[13]`, roman `'X',' ','I'` → `[11]`.
- [ ] Step 2–4. Step 5: Commit `feat(core): roman numerals and expression evaluation`.

### Task 5: Dekódovanie a kompilácia rovníc (`js/core/decode.js`)

**Consumes:** Task 3, 4. **Produces:** `decodeCell(type, names:Set<string>): string|null` (prázdna sada → `''`; digit akceptuje aj alternatívy `1:ef`, `7:abcf`, `9:abcfg`, `6:cdefg`); `decodeBoard(types, occupied:Set<slotId>): string|null` (text, napr. `'5+4=9'`, prázdne bunky ako medzera; neplatná bunka → null); `isTrueEquation(types, occupied): boolean`.

- [ ] Step 1: Testy: `decodeBoard` z `encodeText('9+4=5')` vráti `'9+4=5'`; z `encodeText('VII +I=VIII')` vráti `'VII +I=VIII'`; op iba `v` → null; `isTrueEquation` pre `'5+4=9'` true, `'9+4=5'` false, `'X =VIII+II'` true, `'II×III=VI '` true; digit `{e,f}` dekóduje `'1'`.
- [ ] Step 2–4. Step 5: Commit `feat(core): equation decoding`.

### Task 6: Mriežky a útvary (`js/core/lattice.js`)

**Produces:** `gridSlots(rows, cols): Slot[]` (`h{r}-{c}` stred `(c*100+50, r*100)` angle 0; `v{r}-{c}` stred `(c*100, r*100+50)` angle 90); `triSlots(n): Slot[]` (vrchol `P(r,i) = ((n-r)*50 + i*100, r*86.6)`; `a{r}-{i}` r∈1..n,i<r medzi P(r,i),P(r,i+1) angle 0; `l{r}-{i}` P(r,i)→P(r+1,i) angle 120; `r{r}-{i}` P(r,i)→P(r+1,i+1) angle 60; r∈0..n-1, i≤r); `findSquares(occ, rows, cols): string[][]` (všetky veľkosti, každý = zoznam hrán); `findTriangles(occ, n): string[][]` (up: hrany `l(r+j,i)`, `r(r+j,i+j)`, `a(r+k,i+j)`; down: `a(r,i+j)`, `r(r+j,i+j)`, `l(r+j,i+k)`, podmienka `i+k ≤ r`); `checkShapes(occ, boardDef, goal): boolean` (počet == count a pri `noLoose` každá obsadená hrana patrí aspoň jednému útvaru).

- [ ] Step 1: Testy: `gridSlots(2,2).length===12`, `triSlots(2).length===9`, `triSlots(3).length===18`; plná 2×2 → 5 štvorcov; plná 3×3 → 14; plná tri n=2 → 5 trojuholníkov, n=3 → 13; tri n=2 bez `a1-0` → 3; každé riešenie log-01…log-06 z tabuľky splní goal, plný štart nesplní; 2×2 bez `h0-0` a `h1-0`… s voľnou hranou a `noLoose` → false.
- [ ] Step 2–4. Step 5: Commit `feat(core): grid and triangle lattices with shape counting`.

### Task 7: Stav úlohy (`js/core/puzzle-state.js`)

**Produces:** `createState(puzzle): State` (zápalky `m0…` v poradí slotov štartu, pozícia = slot, angle = slot.angle); `occupied(state): Set<string>`; `trayMatches(state): Match[]`; `moveToSlot(state, matchId, slotId): State` (immutabilne; uhol = slot.angle); `moveToTray(state, matchId, {x,y}): State`; `rotateMatch(state, matchId): State` (rotateStep, iba pozícia/uhol, match ostáva v slote ak ešte `angleDiff ≤ 23`, inak sa uvoľní na rovnakých súradniciach – slot `null`); `movesUsed(state, puzzle): number` = |start \ occupied|; `resetState(puzzle)`; `solutionPlan(puzzle, solutionIndex): {from:string, to:string|'tray'}[]` (zoradené páry start\sol → sol\start; pri `remove` cieľ `'tray'`); `trayPosition(board, k): {x,y}` (k-ta voľná pozícia v odkladacej ploche, mriežka po 30 jednotkách, uhol 90).

- [ ] Step 1: Testy na puzzli `num-01` (zostav cez Task 3): 9=6 + plus=2 + 4=4 + rovná sa=2 + 5=5 → `createState().matches.length===19`; po `moveToSlot` z `c0.b` na `c4.b` `movesUsed===1` a `occupied` obsahuje `c4.b`; pôvodný stav nezmenený; `rotateMatch` horizontálnej zápalky v slote → uhol 45, `slot===null`; `solutionPlan(num-01,0)` = `[{from:'c0.b',to:'c4.b'}]`; remove-plan log-01 má 2 kroky do `'tray'`.
- [ ] Step 2–4. Step 5: Commit `feat(core): puzzle state`.

### Task 8: Validátor a solver (`js/core/validator.js`, `js/core/solver.js`)

**Produces:** `isSolved(state, puzzle): boolean` – move: žiadna zápalka v tray && `movesUsed === puzzle.moves` && (occupied ∈ solutions || (kind equation && isTrueEquation) || (kind shapes && checkShapes)); remove: occupied ⊆ start && |start|−|occ| === moves && (∈ solutions || checkShapes/isTrueEquation). `solveEquation(puzzle): string[]` – brute force všetkých k=moves presunov (vyber k obsadených na uvoľnenie, k voľných na obsadenie, k ≤ 2), vráti zoradené unikátne dekódované pravdivé texty.

- [ ] Step 1: Testy: štart num-01 → false; po presune `c0.b→c4.b` → true; po presune na iný slot → false; po 2 presunoch → false aj keby rovnica platila; zápalka v tray v move móde → false; log-01 po odobratí `h1-0`,`v0-1` → true, po odobratí 3 → false; `solveEquation(num-03)` obsahuje `'0+4=4'` a `'8-4=4'`; `solveEquation(num-01)` obsahuje `'5+4=9'`.
- [ ] Step 2–4. Step 5: Commit `feat(core): validator and equation solver`.

### Task 9: Úlohy + schéma + dátové testy (`data/puzzles.json`, `js/core/puzzles.js`)

**Produces:** `normalizePuzzles(json): {categories, puzzles: Puzzle[]}` (validácia schémy – chýbajúce pole, neznáma kategória, duplicitné ID, neplatný slot → `Error` so správou s ID úlohy; `start:"all"` = všetky sloty mriežky; board pre rovnice = `layoutEquation([start,...solutions])`, tray pod boardom výšky 160); `loadPuzzles(url='./data/puzzles.json'): Promise<…>` (fetch + normalize).

- [ ] Step 1: Napíš `tests/unit/puzzles-data.test.js` (číta súbor cez `fs`):
  - ≥ 5 úloh pre každú kategóriu; ≥ 1 úloha s `solutions.length ≥ 2`; každá úloha má neprázdne `task.sk/en`, `hint.sk/en`
  - každé riešenie: `isSolved` po aplikovaní `solutionPlan` = true; štart `isSolved` = false
  - rovnice: `solveEquation(p)` **sa rovná** zoradenému `p.solutions` (texty, trim pravá strana nie – porovnávaj presne)
  - ≥ 1 úloha, ktorej plán vyžaduje rotáciu (`angleDiff(from.angle,to.angle) > 23`), ≥ 1 úloha, kde riešenie obsahuje `+` (stacked `h`+`v`)
  - schéma: duplicitné ID / neznáma kategória / zlý slot vyhodí chybu (inline fixtures)
- [ ] Step 2: Run → FAIL (súbor neexistuje).
- [ ] Step 3: Vytvor `data/puzzles.json` podľa tabuľky úloh a `js/core/puzzles.js`. Pri nezhode solvera: ak solver nájde viac riešení, over ich čitateľnosť a doplň do `solutions`; ak žiadne, oprav štart podľa tabuľky (je overená ručne).
- [ ] Step 4: Run → PASS. Step 5: Commit `feat(data): 18 puzzles with data integrity tests`.

### Task 10: Úložisko a fronta (`js/core/storage.js`, `js/core/queue.js`)

**Produces:** `createStorage(backend = globalThis.localStorage): {get(key, fallback), set(key, value)}` (JSON, try/catch, pri chybe RAM mapa); `createQueue(storage, rng = Math.random)` s metódami `current(categoryId): string|null`, `next(categoryId, allIds:string[]): string` (vyber náhodne z neodohraných, pridá do `played.<cat>`, uloží `current.<cat>`; keď sú všetky odohrané → vyčisti `played` a vyber z ostatných okrem posledného, ak je ich > 1), `markSolved(id)`, `solvedCount(categoryId, allIds)`. Kľúče: `zapalkovo.played.<cat>`, `zapalkovo.current.<cat>`, `zapalkovo.solved`.

- [ ] Step 1: Testy (fake storage objekt): 5 ID, 5× `next` → permutácia bez opakovania; s rng `() => 0` deterministické poradie; „prerušenie“: 3× next, nový `createQueue` nad tým istým backendom → `current` vráti 3. ID a ďalšie 2 `next` sú presne zvyšné 2; 6. `next` ≠ 5. (posledné); uložené neznáme ID sa ignoruje a nové ID sa ponúkne (Review Focus 3); backend hádže pri `getItem`/`setItem` → bez výnimky, hodnoty držané v RAM; nevalidný JSON v úložisku → fallback (Review Focus 2).
- [ ] Step 2–4. Step 5: Commit `feat(core): persistent non-repeating puzzle queue`.

### Task 11: i18n (`js/core/i18n.js`, `js/core/strings.js`)

**Produces:** `STRINGS = {sk:{…}, en:{…}}` (rovnaké kľúče); `createI18n(storage, defaultLang='sk')`: `lang`, `setLang(l)`, `t(key, params?)` (`{n}` interpolácia, chýbajúci kľúč → kľúč samotný), `pick(obj:{sk,en})`. Kľúče min.: `app.title, nav.home, nav.help, home.choose, home.solved, game.moves, game.hint, game.solution, game.nextSolution, game.reset, game.rotate, game.record, game.stopRecord, game.download, game.next, game.solved, game.revealed, game.needRotate, sensors.enable, sensors.denied, record.unsupported, lang.switch`.

- [ ] Step 1: Testy: `t('game.moves',{n:1,max:2})` → `'Ťahy: 1 / 2'`; EN `'Moves: 1 / 2'`; sk a en majú identickú množinu kľúčov; `setLang('en')` uloží `zapalkovo.lang`; neznámy jazyk ignoruje.
- [ ] Step 2–4. Step 5: Commit `feat(core): i18n`.

### Task 12: Logika senzorov (`js/core/sensors-logic.js`)

**Produces:** `effectiveRoll(beta, gamma, screenAngle): number` (0 → gamma, 90 → −beta, 270 → beta, 180 → −gamma; záporné = doľava); `createTiltDetector({threshold=-35, release=-15, holdMs=300})` → `update(roll, t): boolean` (true raz pri splnení, potom až po re-arm); `createShakeDetector({threshold=15, minGap=150, window=1000, cooldown=1500})` → `update(magnitude, t): boolean` (vrchol = prechod nad threshold z pod; true pri 2. vrchole v okne; potom cooldown); `motionMagnitude({x,y,z}, hasGravity): number` (s gravitáciou odpočíta 9.81 z normy, výsledok ≥ 0).

- [ ] Step 1: Testy: tilt −40 v t=0..299 → false, t=300 → true, ďalej −40 → false, −10 potom −40 držané 300 ms → true; krátky náklon 200 ms → false; landscape `effectiveRoll(-40, 0, 90)` → 40 (doprava), `(40,0,90)` → −40; shake: vrcholy t=0 a t=400 → true; vrcholy t=0 a t=1200 → false; vrcholy t=0 a t=100 (minGap) → false; trvalé vysoké hodnoty bez poklesu = 1 vrchol; po triggeri ďalšie vrcholy do 1500 ms ignorované.
- [ ] Step 2–4. Step 5: Commit `feat(core): tilt and shake detection`.

### Task 13: Shell stránky, dizajn, router, návod, tlač

**Files:** Create `index.html`, `favicon.svg`, `css/tokens.css`, `css/base.css`, `css/layout.css`, `css/board.css`, `css/print.css`, `js/ui/router.js`, `js/app.js`, `tests/e2e/shell.spec.js`

**Produces:** `index.html` so sekciami `#view-home`, `#view-play`, `#view-help` (iba jedna bez `hidden`); hlavička s logom (SVG zápalka + „Zápalkovo“), nav (Domov, Návod), prepínač SK/EN (`button#lang-toggle`); `router.js`: `parseRoute(hash): {view:'home'|'play'|'help', category?:string}` (`#/`, `#/play/<id>`, `#/help`, neznámy → home) + `startRouter(onChange)`; všetky texty cez `data-i18n="key"`; návod ako `<article lang="sk">` a `<article lang="en">` (CSS skryje nezvolený jazyk podľa `html[lang]`).

Dizajn „škatuľka zápaliek“: tokeny `--paper #f6ecd9`, `--surface #fffaf0`, `--ink #2b1d14`, `--wood #c8894a`, `--stick-1 #f0c27b`, `--stick-2 #d59a4f`, `--head-1 #d6452b`, `--head-2 #7a1712`, `--accent #c2410c`, `--ok #2f7d32`; dark: `--paper #1b1410`, `--surface #271d17`, `--ink #f3e6d3`. Kategórie ako karty-etikety (retro rámik, počet vyriešených). Typografia: systémový serif pre nadpisy (`ui-serif, Georgia`), sans pre text, `clamp()`. Layout mobile-first; od 900 px board vľavo, panel ovládania vpravo. Návod obsahuje: cieľ hry, kategórie, ovládanie myš/klávesnica, **sekciu „Iba na mobile“** (prst, dvojťuk = otočenie, náklon doľava = riešenie, 2× zatrasenie = reset, povolenie senzorov), nahrávanie videa, pravidlá opakovania úloh, zopakované požiadavky zadania. `print.css` (`@media print`): skryje `header nav`, `#view-home`, `#view-play`, tlačidlá, zobrazí `#view-help` aj keď je `hidden`, čierny text na bielom, `a[href]::after` URL.

- [ ] Step 1: E2E `shell.spec.js`: title obsahuje „Zápalkovo“; `#/help` zobrazí návod, `#/` domov s 3 kartami kategórií; klik na prepínač jazyka zmení `html[lang]` na `en` a text navigácie, po reloade ostane `en`; `page.emulateMedia({media:'print'})` na `#/help` → `nav` a `#view-play` neviditeľné, návod viditeľný; na 375×812 nie je horizontálny scroll (`scrollWidth <= clientWidth`); `link[rel=icon]` ukazuje na `favicon.svg`. Unit test `parseRoute`.
- [ ] Step 2: FAIL. Step 3: Implementuj. Step 4: `npm test`, `npm run test:e2e -- shell`, `npm run lint` → PASS.
- [ ] Step 5: Commit `feat(ui): page shell, design system, help and print styles`.

### Task 14: SVG board a interakcia (`js/ui/board.js`)

**Consumes:** Task 2, 7. **Produces:** `createBoard(svgEl, {onChange(state), onHint(key)})` → `{load(puzzle, state), setState(state), getState(), animatePlan(plan, ms=600): Promise<void>, getDragInfo(): {matchId,x,y,angle}|null}`.
Render: `viewBox` z `board.bounds` + tray; `<defs>` gradienty `stick`, `head`; sloty ako `<line class="slot" data-slot="…">` (jemné prerušované, zvýraznené `.slot--target` počas ťahu); tray ako `<rect class="tray">` s popisom; zápalka `<g class="match" data-match="m0" data-slot="…" tabindex="0" role="button" aria-label="…" transform="translate(x y) rotate(a)">` s `<rect x="-50" y="-5" width="88" height="10" rx="4">` a `<ellipse cx="40" cy="0" rx="11" ry="8">` (zaoblená hlavička). Preklenuté zápalky (rovnaký stred) sa kreslia v poradí → vizuálne „na sebe“.
Interakcia: Pointer Events (`pointerdown` + `setPointerCapture`, `pointermove`, `pointerup`, `pointercancel`, `lostpointercapture`), súradnice cez `getScreenCTM().inverse()`, `touch-action:none` iba na `svg`. Pustenie: `findSnapSlot` → `moveToSlot`; inak ak bod v tray → `moveToTray`; inak návrat. Ak v polomere existuje slot iba s inou orientáciou → `onHint('game.needRotate')`. Dvojklik/dvojťuk (2× `pointerup` do 300 ms bez pohybu > 5) a klávesa `R` na fokusovanej/vybranej zápalke → `rotateMatch`; šípky posúvajú fokusovanú zápalku o 10, `Enter` = pokus o snap. `dblclick` default zoom zablokovaný (`touch-action`).

- [ ] Step 1: E2E `tests/e2e/board.spec.js` (stránka `#/play/numbers?puzzle=num-01` – app podporuje query `puzzle` na priame otvorenie úlohy, iba ak ID existuje): myšou ťahaj zápalku zo `c0.b` na pozíciu slotu `c4.b` → `data-slot="c4.b"`, počítadlo ťahov „1 / 1“; pustenie mimo slotu → zápalka späť; `pointercancel` počas ťahu → späť (Review Focus 1); ťah horizontálnej zápalky na vertikálny slot → nezapadne a zobrazí hlášku o otočení; dvojklik → `transform` obsahuje `rotate(45`; klávesa R funguje; projekt `mobile-chrome`: ťah dotykom cez CDP `Input.dispatchTouchEvent` funguje; `svg` má `touch-action: none` a stránka mimo boardu sa dá scrollovať; SVG sa škáluje (šírka boardu ≤ viewport na 375 px).
- [ ] Step 2–4 (`npm run test:e2e -- board`). Step 5: Commit `feat(ui): svg board with drag, snap and rotation`.

### Task 15: Herný tok (`js/ui/game.js`, `js/ui/home.js`, úprava `js/app.js`)

**Consumes:** Task 8–11, 13, 14. **Produces:** `createGame({root, board, queue, i18n, puzzles})` → `{open(categoryId, puzzleId?), showHint(), showSolution(), nextSolution(), reset(), next(), getCurrent(): Puzzle}` + udalosť `solved`.
Správanie: domov zobrazí karty kategórií z JSON (názov, popis, „vyriešené x / n“); `open` použije `queue.current` (pokračovanie) alebo `queue.next`; panel: zadanie, `Ťahy: n / max` (prekročenie → `.is-over`), tlačidlá Nápoveda (zobrazí hint v `aria-live` boxe), Riešenie (reset + `animatePlan(solutionPlan)`, stav „odhalené“ – nezapočíta sa do vyriešených), Ďalšie riešenie (viditeľné iba ak `solutions.length > 1`), Reset, Otočiť (aktívne pri vybranej zápalke), Nahrávať, Ďalšia úloha. Po vyriešení: `queue.markSolved`, banner s animáciou (vypnutá pri reduced motion) a tlačidlom Ďalšia úloha.

- [ ] Step 1: E2E `tests/e2e/game.spec.js`:
  - **vyrieš každú z 18 úloh cez UI**: test načíta `data/puzzles.json` a `js/core/*` v Node, pre každú úlohu otvorí `?puzzle=<id>`, vykoná `solutionPlan` myšou (pred ťahom dvojklikom otáča, kým `angleDiff ≤ 23`; pri `'tray'` pustí do stredu tray) → zobrazí sa banner vyriešenia (projekt chromium; firefox iba 3 vzorky)
  - Nápoveda zobrazí text hintu; Riešenie dostane board do stavu riešenia a zobrazí „odhalené“; num-03 má tlačidlo Ďalšie riešenie a prepne na 2. riešenie; Reset po ťahu vráti `data-slot` všetkých zápaliek na štart
  - perzistencia: v kategórii otvor 3 úlohy (Ďalšia), zapamätaj ID, `page.reload()`, otvor kategóriu → rovnaká 3. úloha, ďalšie 3 ID sú zvyšné a disjunktné s prvými tromi
  - domov ukazuje „vyriešené 1 / 6“ po vyriešení jednej úlohy
- [ ] Step 2–4. Step 5: Commit `feat(ui): game flow, hints, solutions and persistence`.

### Task 16: Senzory v UI (`js/ui/sensors.js`)

**Consumes:** Task 12, 15. **Produces:** `initSensors({onTiltLeft, onDoubleShake, i18n, buttonEl})` – pri existencii `DeviceOrientationEvent.requestPermission` zobrazí `buttonEl` („Povoliť senzory“) a listenery pridá až po `granted`; inak hneď. Používa `screen.orientation?.angle ?? window.orientation ?? 0`, `event.acceleration` ak je k dispozícii, inak `accelerationIncludingGravity` (hasGravity). Aktívne iba vo view `play`.

- [ ] Step 1: E2E `tests/e2e/sensors.spec.js` (mobile-chrome): v otvorenej úlohe dispatch `new DeviceOrientationEvent('deviceorientation',{gamma:-45,beta:0})` opakovane 400 ms (cez `page.clock` alebo reálny čas) → board je v stave riešenia; po ťahu dispatch dvoch `DeviceMotionEvent` vrcholov (acceleration x=20, medzi nimi x=0) 300 ms od seba → reset; stub `DeviceOrientationEvent.requestPermission` (`addInitScript`) vracajúci `'denied'` → tlačidlo zobrazí hlášku `sensors.denied`, žiadna výnimka v konzole.
- [ ] Step 2–4. Step 5: Commit `feat(ui): tilt to reveal, double shake to reset`.

### Task 17: Video záznam (`js/ui/canvas-renderer.js`, `js/ui/recorder.js`)

**Produces:** `drawScene(ctx, {board, matches, drag, scale, theme})` – pozadie, sloty (tlmené), zápalky rovnakým tvarom ako SVG (zaoblený obdĺžnik + elipsa, gradienty), ťahaná zápalka podľa `drag`; `createRecorder({canvas, board, fps=30})` → `{isSupported(): boolean, start(), stop(): Promise<Blob>, state}`; mimeType prvý podporovaný z `video/webm;codecs=vp9`, `video/webm;codecs=vp8`, `video/webm`. Počas nahrávania `requestAnimationFrame` loop kreslí `board.getState()` + `getDragInfo()`; indikátor „● REC 00:12“; po stop tlačidlo Stiahnuť (`<a download="zapalkovo-<puzzleId>.webm">`) a náhľad `<video controls>`.

- [ ] Step 1: Unit `tests/unit/canvas-renderer.test.js` s mock ctx (zaznamenáva volania): pre stav s 19 zápalkami je 19× `ellipse`; ťahaná zápalka sa kreslí na `drag.x/y` a ako posledná; `scale` sa aplikuje cez `setTransform`. Unit recorder: bez `MediaRecorder` → `isSupported()===false` (Review Focus 5). E2E (chromium): Nahrávať → ťah → Zastaviť → odkaz na stiahnutie má `href` `blob:` a `download` končí `.webm`, veľkosť blobu > 0 (`page.evaluate` fetch blob URL); pri odstránenom `MediaRecorder` (`addInitScript`) je tlačidlo disabled s textom `record.unsupported`.
- [ ] Step 2–4. Step 5: Commit `feat(ui): solution video recording`.

### Task 18: PWA (`manifest.webmanifest`, `sw.js`, `js/ui/sw-register.js`, `scripts/make-icons.mjs`, `icons/*`)

**Produces:** manifest (`name` „Zápalkovo – zápalkové hlavolamy“, `short_name` „Zápalkovo“, `start_url` `./`, `scope` `./`, `display` `standalone`, `background_color` `#f6ecd9`, `theme_color` `#c2410c`, ikony 192, 512, 512 maskable PNG + SVG); `sw.js`: `CACHE = 'zapalkovo-v1'`, `APP_SHELL` zoznam všetkých statických súborov (relatívne), install → `addAll` + `skipWaiting`, activate → zmaž staré cache + `clients.claim`, fetch: `puzzles.json` network-first s fallbackom na cache, ostatné GET cache-first; `make-icons.mjs` cez Playwright vyrenderuje `favicon.svg` do PNG.

- [ ] Step 1: Unit test: každý súbor v `APP_SHELL` existuje na disku (načítaj `sw.js` ako text, vyparsuj pole) a každý `js/**/*.js`, `css/*.css` je v `APP_SHELL` (aby sa nič nezabudlo). E2E (chromium): manifest sa načíta a má ikony 192 a 512 (fetch + `existsSync`); po registrácii SW `context.setOffline(true)` → reload `#/play/numbers` funguje a board sa vykreslí.
- [ ] Step 2–4 (`npm run icons` pred testom). Step 5: Commit `feat(pwa): manifest, service worker and icons`.

### Task 19: Polish, dokumentácia, odovzdanie

**Files:** `README.md`, `PROMPTS.md`, `scripts/make-zip.mjs`, úpravy CSS/HTML podľa review.

- [ ] Step 1: Vizuálna kontrola v prehliadači 375/768/1440 px, light/dark, cez `ui-design-review:review`; oprav nálezy (každá oprava s testom ak ide o správanie).
- [ ] Step 2: `README.md` (SK): popis hry, štruktúra projektu, formát `puzzles.json` (ako pridať úlohu), spustenie (`npm run serve`), testy, nasadenie (nahraj obsah koreňa na HTTPS server), **použitie AI** (Claude Code – čo generoval, odkaz na `PROMPTS.md`), kontrola W3C. `PROMPTS.md`: chronologický zoznam promptov tejto spolupráce.
- [ ] Step 3: `scripts/make-zip.mjs` – `tar -a -c -f dist/ZZ_priezvisko.zip` (Windows bsdtar) so súbormi koreňa bez `node_modules`, `.git`, `dist`, `test-results`, `playwright-report`; názov z env `ZZ_NAME` (default `ZZ_priezvisko`). Test: unit overí zoznam súborov (funkcia `collectFiles()` exportovaná) obsahuje `index.html`, `README.md`, `PROMPTS.md` a neobsahuje `node_modules`.
- [ ] Step 4: Celkové overenie: `npm test`, `npm run test:e2e`, `npm run lint` – všetko zelené (výstup priložiť).
- [ ] Step 5: Commit `docs: readme, prompts and packaging`; potom `superpowers:requesting-code-review` na celú vetvu.

---

## Self-review poznámky
- Pokrytie zadania: (1) responzivita – T13/T14; (2) zaoblená hlavička, ťahanie, rotácia, skladanie – T14, T9; (3)(4) 18 úloh/3 kategórie – T9; (5) JSON + riešenia + nápoveda + viac riešení – T9; (6) náhodne – T10; (7) prerušenie – T10/T15; (8) koniec/nápoveda/riešenie/reset/senzory – T15/T16; (9) video – T17; (10) návod + mobil + tlač – T13; (11) favicon + názov – T13/T18; PWA – T18; W3C – T13/T19; odovzdanie – T19.
- Mimo automatického overenia: reálne senzory a inštalácia PWA na fyzickom mobile, W3C Nu validátor na nasadenej URL – overí používateľ.
