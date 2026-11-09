# AI handoff — SpaceStarfield98

**Stav k:** 2026-11-06 14:32 CEST  
**Projekt:** `C:\Users\obert\Desktop\SpaceStarfield98`  
**Repozitár:** adresár nemá Git (`.git` neexistuje). Neupravovať `backup-original/` ani `backup-before-gases/`.

## Posledné zadanie používateľa

V režime **Farebne plyny**:

1. oblaky majú mať veľmi rozdielne rozmery — od malých po skutočne veľké/gigantické,
2. majú mať rozmanité tvary — od guľatých po nepravidelné, rozvetvené a oblakové,
3. majú byť skutočne náhodne rozmiestnené v celom priestore,
4. nesmie existovať pravidlo, ktoré vždy vynúti oblak pred kamerou alebo v osi letu,
5. majú zostať viacfarebné varianty aj prevažne jednofarebné varianty,
6. treba zachovať výkonové opravy, maximálnu rýchlosť 200, okamžite viditeľnú zmenu hustoty hviezd a pohyb nezávislý od FPS.

Používateľ následne napísal **„pause“**. Práca bola prerušená. Nepokračovať automaticky bez nového pokynu používateľa.

## Aktuálny stav zdrojov

V `gases.js` už je prítomná väčšina požadovanej implementácie:

- 48 oblakov v náhodnom priestore: `x/y` približne `−22..22`, `z` približne `−48..192`.
- Už tam nie je pôvodný vynútený prvý oblak `x=0.4, y=-0.2, z=3` ani pravidlo „každý tretí pri trase“.
- Rozdelenie polomerov:
  - malé `0.35..1.8`,
  - stredné `1.8..5`,
  - veľké `5..9`,
  - zriedkavé gigantické `10..16` (približne 2 %).
- Päť analytických siluet: guľatý uzol, laločnatý oblak, zahnutý prúd, rozvetvené filamenty a nepravidelný pretiahnutý komplex.
- Siluety sú deformované šumom a vopred upečené do atlasu 25 textúr (5 farieb × 5 tvarov); textúry sa nevytvárajú počas letu.
- Tienenie hviezd zostáva bez alokácií v horúcej slučke.
- Vykresľovanie používa nízkorozlišovaciu kompozitnú vrstvu a obmedzuje veľkosť gigantických spriteov.

Dôležité: túto implementáciu treba považovať za **rozpracovanú, nie uzavretú**, pretože posledná doplnená sada hraničných testov nebola po prerušení spustená.

## Čo bolo overené pred prerušením

Posledný kompletný beh pred doplnením hraničného testu hlásil úspech:

- `test-cloud-variety.cjs`
  - náhodné rozmiestnenie aj prázdne koridory,
  - široké veľkosti a zriedkavé gigantické oblaky,
  - päť odlišných siluet,
  - transparentné okraje atlasu,
  - žiadne generovanie textúr pri recyklácii,
  - tvarovo závislé vnorenie a plynulé hranice.
- `test-controls.cjs` — 3 testy.
- `test-depth.cjs` — 12 testov.
- `test-gas-performance.cjs` — 5 testov.
- `test-nebula.cjs` — 2 testy.

Štatistický artefakt `verification-cloud-statistics.json` obsahuje:

- 48 000 vzoriek,
- 477 prázdnych trás a 523 trás so zásahom oblaku,
- podiel gigantických oblakov `0.0204167`,
- polomery približne `0.35 / 1.67 / 16` (min/medián/max).

Existujú aj predchádzajúce vizuálne artefakty:

- `preview-cloud-natural.png`
- `preview-cloud-round-irregular.png`
- `preview-cloud-giant.png`
- `preview-cloud-atlas.png`
- `verification-cloud-browser.json`
- `verification-cloud-tests.json`

Ich existenciu nepovažovať automaticky za dôkaz finálneho stavu; pri pokračovaní ich porovnať s aktuálnym `gases.js` a spraviť nový browser test.

## Presný bod prerušenia

Tesne pred „pause“ vznikol nový súbor:

- `test-cloud-bounds.cjs`

Má overovať:

1. gigantický oblak ostáva viditeľný pri vzdialenej hranici podľa svojho polomeru,
2. kompozitná vrstva je obmedzená na max. 960 px v oboch osiach aj v portréte,
3. oblak úplne mimo obrazovky sa nevykreslí,
4. gigantický oblak sa nerecykluje, kým kamera ešte leží v jeho objeme,
5. aj oblak so stredom za kamerou stále tlmí obraz, ak kamera leží v jeho polomere,
6. recyklovaný oblak začne za celou oblasťou vzdialeného nábehu.

Jeho prvé spustenie bolo **prerušené (exit 130)**. Nie je známe, či aktuálny kód týmto testom prejde. Toto je prvý krok pri pokračovaní.

## Odporúčaný postup pokračovania

1. Najprv spusti iba `test-cloud-bounds.cjs` bez úpravy zdrojov.
2. Ak zlyhá, oprav koreň problému v `gases.js`; neupravuj test len preto, aby prešiel.
3. Skontroluj najmä životný cyklus gigantických oblakov. Aktuálne `advance()` recykluje podľa pevného `c.z < -48`; treba potvrdiť, že to nenaruší oblak s polomerom 16 a že náhradný oblak začína celý za vzdialeným fade pásmom.
4. Skontroluj vykresľovanie oblakov mimo viewportu a rozmery kompozitnej vrstvy pre extrémny portrét.
5. Potom spusti všetky testy a `node --check`.
6. Urob čerstvé Chromium overenie cez `file:///C:/Users/obert/Desktop/SpaceStarfield98/index.html`:
   - skutočne prázdny priestor pred kamerou v niektorých náhodných vesmíroch,
   - malý, stredný a gigantický oblak,
   - guľatý aj výrazne nepravidelný tvar,
   - plynulý prelet cez/okolo gigantického oblaku bez náhleho zmiznutia,
   - rozumné FPS pri bežnej hustote; kvôli nedávnemu resetu PC nerobiť dlhý maximálny záťažový test bez súhlasu používateľa.
7. Aktualizuj `README.md`: jeho sekcia o oblakoch stále opisuje staršiu verziu s 24 oblakmi a rozsahom `−12..60`; aktuálny zdroj používa 48 oblakov a širší priestor.
8. Zapíš nové výsledky do samostatného JSON a vytvor nový PNG náhľad. Neprepisuj staršie dôkazy, ak zachytávajú inú verziu.

## Príkaz na testy vo Windows prostredí Hermes

Priamy `node` cez Git Bash niekedy skončí chybou `stdin is not a tty`. Použi absolútny natívny interpreter cez Python:

```bash
python -c "import subprocess,pathlib; p=pathlib.Path('C:/Users/obert/Desktop/SpaceStarfield98'); n='C:/Users/obert/AppData/Local/hermes/tools/node-26.12.1-win32-x64/node.exe'; files=['test-cloud-bounds.cjs','test-cloud-variety.cjs','test-nebula.cjs','test-controls.cjs','test-depth.cjs','test-gas-performance.cjs']; [subprocess.run([n,str(p/f)],check=True) for f in files]"
```

Kontrola syntaxe:

```bash
python -c "import subprocess,pathlib; p=pathlib.Path('C:/Users/obert/Desktop/SpaceStarfield98'); n='C:/Users/obert/AppData/Local/hermes/tools/node-26.12.1-win32-x64/node.exe'; [subprocess.run([n,'--check',str(p/f)],check=True) for f in ['gases.js','space.js','depth.js']]"
```

## Známé limity a bezpečnostné hranice

- Canvas 2D iba aproximuje objem; nejde o 3D raymarching.
- Projekt nemá Git, takže pred väčšou opravou vytvor pracovnú kópiu aktuálnych root súborov, ale neupravuj existujúce historické zálohy.
- Nedávno došlo k resetu PC. Vyhnúť sa dlhým maximálnym benchmarkom bez výslovného pokynu používateľa.
- Zachovať súbory `space.js`, `depth.js`, `index.html` a existujúce regresie, pokiaľ konkrétna chyba nevyžaduje ich zmenu.
- Finálny stav sa smie označiť za hotový až po čerstvých Node testoch aj reálnom browser/Canvas overení.

---

## Rýchlostná optimalizácia (2026-11-09, adresár „SpaceStarfield98 flash“)

Pred zásahom vytvorená kópia: `backup-pre-speed-2026-11-09/` (space.js, depth.js, gases.js, index.html, space.css, .bat). Historické backupy `backup-original/` a `backup-before-gases/` nedotknuté.

Zmeny (vizuál zachovaný 1:1, len výkon):

1. `space.js` — mŕtvy kód v `drawStars` odstránený: pola `bgPass`/`mainPass` sa len plnili a nikdy nepoužili; sken `si`/`starColors` hľadajúci najbližší sprite sa zahadzoval (`strokeStyle` sa prepísal hneď potom). Jedna slučka, `trailLength` hoisted pred slučkou.
2. `space.js` — per-frame template stringy pre `fillStyle` odstránené: `decorate()` pri vzniku hviezdy predpečie `s.css`, `s.glowCss`, `s.flareCss`; far Stars mają `css` a `w` predpočítané pri vytvorení. Všetky render cesty používaju predpečené reťazce.
3. `space.js` — `buildBackground` je teraz generátor `backgroundChunks` (yield na riadok); front `heavyTasks` + `pumpHeavy()` v rAF slučke s 6 ms budgetom. Nebula sa pečie synchronne (prvý frame), galaxy asynchronousne. `GasClouds(..., deferAtlas=true)` + bakeGas pump — atlas 5 textúr sa pečie po riadkoch, no `render()` guard `if (this.bake) this.bakeAll()` ensured atlas complete before first cloud draw (žiadny pop-in).
4. `space.js` — `render(Math.min(elapsed, 0.25))` (žiadne teleporty hviezd po GC pauze), auto-quality sa nedeградuje kým bežia heavy tasks, `fastWindows` recoveria kvality po 3 window≥57 FPS.
5. `gases.js` — constructor: eager cesta ide naďalej cez `this.texture()` (zachovaný seam, ktorý stubuje `test-depth`); defer cesta pečie cez `bakeStep()`/`bakeAll()`. `textureRows()` generátor; wrapper `texture()` ho vypumpí synchronne — identical pixel output.

Merania (Chromium, tento PC, 144 Hz monitor):
- FPS pred: ~90–95; po: 135–144 (narazí na vsync), stabilné aj 14 s po spustení.
- Blokovanie pri spustení (nav→DLC, synchronné pečenie): ~5.4 s → ~3.5 s.
- 6 Node testov má IDENTICKÚ signature s baseline (3 existujúce zlyhania ponechané zámerne: atlas 50 vs 25, paleta 10 farieb, východisková hustota — ich fix by zmenil vizuál).
- Vizuál: screenshoty pred/po obsahujú rovnaké prvky (hviezdy s halou, farebné stoply, hmloviny z atlasu, HUD).

`Spustit Space Starfield 98.bat` je triviálny 2-riadkový launcher — optimalizácia bola v JS, nie v .bat.
