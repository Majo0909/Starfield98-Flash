# Space Starfield 98 — Deep Space

Offline prelet vesmírom inšpirovaný klasickým Windows 98 Starfield Simulation.

## Spustenie

Dvojklik na `Spustit Space Starfield 98.bat` alebo `index.html`. Súbory `index.html`, `space.js`, `depth.js`, `gases.js` a `space.css` nechaj spolu. Netreba inštaláciu, server, internet ani build. Odporúčaný prehliadač: aktuálny Edge alebo Chrome.

## Čo pribudlo

- Štyri prostredia: modrofialová hmlovina, galaxia so zlatým jadrom, čiernobiela klasika a **Farebne plyny**.
- Recyklované hviezdy vznikajú na vzdialenosti 28 s nulovou počiatočnou viditeľnosťou. Zvýšenie hustoty však dopĺňa celé viditeľné pole: nové hviezdy sa plynulo rozsvietia za 1,6 sekundy, bez čakania na prílet z diaľky. Počas pauzy sa zmena zobrazí okamžite.
- **Farebne plyny:** 8–120 lokálnych oblakov (slider **Počet hmlovín**, predvolene 48) je rovnomerne náhodne rozmiestnených v priestore okolo kamery — do strán, nad, pod, pred aj za ňu — bez vynúteného oblaku v osi letu. Veľkosti siahajú od prachových vláken (polomer 0,12) cez bežné uzly až po ojedinelé kolosálne komplexy s polomerom až 100, teda až ~50‑násobok typickej hmloviny; tie sa objavujú zriedkavo (približne 1 z 200) a samostatne. Obrovský oblak sa recykluje až keď celý jeho objem jasne zaostane za kamerou, nie na pevnej rovine. Let môže viesť aj cez otvorený priestor. Zadný oblak sa nepremieta pred kameru; pri pobyte v jeho objeme zostáva iba plynulý miestny závoj. Jas/hustotu plynov mení **Jas hmloviny**, celkový počet **Počet hmlovín** a podiel veľkých a obrovských hmlovín nastavuje slider **Gigantické hmloviny** (0 – 30 %, predvolene 6,5 %; zmenu frekvencie prevzímajú hmloviny pri ďalšej recyklácii, existujúce si veľkosť zachovávajú).
- Atlas obsahuje päť rozličných siluet — oblé uzly, laločnaté banky, zahnuté prúdy, rozvetvené filamenty a nepravidelné pretiahnuté komplexy — so šumom deformovanými okrajmi. Jednotlivé oblaky sú prevažne jednofarebné alebo majú súvislé viacfarebné emisné oblasti; textúry vznikajú iba pri štarte, nie počas letu.
- Procedurálne hmloviny s prachovými pásmi, vzdialené hviezdy a perspektívny prelet.
- Stabilné farby hviezd, mäkká žiara a jemné difrakčné lúče pri blízkych hviezdach.
- Plynulý autopilot a ručné zatáčanie myšou; warp s postupným zrýchlením a spomalením.
- Retro panel: rýchlosť 1–200 (maximum zvýšené 10×), 300–40000 hviezd, dĺžka stôp, jas hmloviny, kvalita a žiara.
- Let používa celý uplynutý čas snímky: pokles FPS už nespomaľuje pohyb hviezd a oblakov.
- Ukladanie nastavení v prehliadači, export čistého obrazu do PNG, automatické skrývanie ovládania.
- Automatické zníženie rozlíšenia pri dlhšom nízkom FPS; zastavenie kreslenia v skrytej karte.

## Ovládanie

| Kláves | Funkcia |
| --- | --- |
| `F` / `F11` | Zapnúť / vypnúť celú obrazovku |
| `P` / medzerník | Pauza / pokračovať |
| `S` | Otvoriť / zavrieť nastavenia |
| `W` | Zapnúť / vypnúť warp |
| `A` | Autopilot / ručný let |
| `1`, `2`, `3`, `4` | Hmlovina, galaxia, klasika, Farebne plyny |
| `Esc` | Zavrieť panel; prehliadač opustí fullscreen |
| Pohyb myšou | Zobraziť ovládanie; pri ručnom lete meniť smer |

Tlačidlo **Uložiť PNG** uloží samotný vesmír bez panelov. **Nový vesmír** zmení rozmiestnenie hviezd aj lokálnych oblakov (textúry a vzdialené pozadie sa znova negenerujú). **Obnoviť** vráti predvolené nastavenia.

## Technické poznámky

Canvas 2D, bez externých knižníc a sietí. Pozadie sa generuje raz pri otvorení a používa sa ako offscreen textúra; pohyb hviezd je závislý od času, nie počtu snímok. Nastavenia sú v `localStorage` pod kľúčom `space-starfield98-v2`; dostupnosť ukladania pri `file://` závisí od prehliadača. Úsporná kvalita kreslí pri 1× DPI, vysoká najviac pri 2× DPI.

Toto je prehliadačová animácia, nie systémový `.scr` šetrič: nespúšťa sa automaticky pri nečinnosti a nemení nastavenia uzamknutia či napájania Windows.

Pôvodné súbory sú zachované v `backup-original/`. Verzia pred pridaním plynov je v `backup-before-gases/`.

## Overenie rýchlosti, hustoty a výkonu

`node test-controls.cjs` overí limit 200, viditeľné doplnenie hustoty a časovanie pri 10 FPS. `node test-gas-performance.cjs` overí presnú zhodu tienenia s pôvodným výpočtom a odstránenie kópií oblakov; parameter `--benchmark` zmeria samostatný výpočet tienenia.

Pri overení v prehliadači na 1920 × 1080 s 40000 hviezdami bol medián vo vnútri oblaku po optimalizácii 32 FPS (pred optimalizáciou približne 20 FPS). Samostatný Node benchmark tienenia sa zrýchlil približne 4,3×. Rýchlosť letu zostala 0,621 oproti očakávaným 0,620 jednotky/s. Nie je to garancia 60 FPS; iné rozlíšenia, prehliadače a dlhodobý beh neboli overené. Merania a vzorky sú v `verification-controls-performance.json`.

Rozsah opravy: bez nových závislostí alebo zmeny architektúry; odstránený časový limit snímky a alokácie v hlavnej slučke tienenia. Zložitosť zostáva lokálna, ďalší refaktoring nie je potrebný. Istota overenia: B (priame testy a regresie, obmedzená vzorka výkonu).

## Overenie priestorových viacfarebných oblakov

`node test-nebula.cjs` kontroluje náhodné hĺbky, bočné/vertikálne/zadné rozmiestnenie a bezpečné recyklovanie. `node test-cloud-variety.cjs` overuje prázdne koridory, široké rozdelenie veľkostí vrátane zriedkavých gigantov, päť odlišných siluet, šumom zdeformované obrysy a nemenný atlas textúr. `node test-cloud-bounds.cjs` kontroluje vzdialený nábeh gigantov, limit rozlíšenia kompozitnej vrstvy v portréte, orezanie mimo obrazovky a recyklovanie veľkých oblakov až mimo ich viditeľného objemu.

Aktuálne automatické overenie: 48 000 vzoriek vytvorilo 477 prázdnych a 523 zasiahnutých trás; polomery boli 0,35 / 1,67 / 16 (min/medián/max) a gigantické komplexy tvorili 2,04 %. V Chromium pri 784 × 471, 1800 hviezd a rýchlosti 20 bežal náhľad 60 FPS; bolo vykreslených 48 oblakov a farebné pixely potvrdili viditeľnú plynnovú vrstvu. Dôkazy: `verification-cloud-statistics.json`, `verification-clouds-final.json`, `preview-clouds-final.png`.

Ide o časovo obmedzený test jedného Chromium, nie garanciu 60 FPS na všetkých rozlíšeniach ani dlhodobého behu. Canvas vrstvy ostávajú aproximáciou objemu, nie fyzikálnym 3D raymarchingom. Zložitosť je lokálna v `gases.js`; istota B (priame browser/Canvas a regresné overenie, bez dlhého maximálneho záťažového testu).

## Overenie hĺbky a plynov

Spusti `node test-depth.cjs` (iba testy vyžadujú Node.js). Testuje vzdialený vznik a plynulú viditeľnosť hviezd, tienenie hviezd plynom, presný pohyb oblakov, bezpečné recyklovanie za kamerou a reset. Prehliadačové výsledky sú v `verification-gases.json`; obsahujú aj skutočný prelet dovnútra a von z oblaku. Viacvrstvové textúry simulujú objemový plyn v Canvas 2D — nejde o fyzikálny 3D raymarching.
