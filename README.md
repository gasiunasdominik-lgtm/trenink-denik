# Trénink deník

Osobní tréninkový deník desetibojaře. Je to PWA: instaluje se na plochu iPhonu a funguje offline. Data se ukládají do Google Sheetu na tvém Drive.

- **Frontend:** čisté ES moduly, bez build kroku. Hosting zdarma na GitHub Pages.
- **Data:** IndexedDB v telefonu a outbox fronta, která se synchronizuje s Google Sheetem přes Apps Script web app.
- **Agregace** (sRPE, ACWR 7/28, monotonie, strain, OTU, readiness) počítá appka. Sheet obsahuje jen surová data.

## Struktura

```
index.html, manifest.webmanifest, sw.js   PWA shell (offline cache – při změně souborů zvyš VERSION v sw.js)
css/app.css                               celý vzhled („Dráha“)
js/main.js                                start, záložky
js/config.js                              typy jednotek, výchozí týdenní šablona, partie, prahy
js/data/   idb.js · store.js · sync.js · normalize.js   IndexedDB, stav + outbox, sync se Sheetem, sjednocení externích zápisů
js/calc/   load.js · readiness.js · plan.js · wa.js · perf.js   zátěž a OTU, readiness, plán + pozadí, body WA, PB a testy
js/ui/     dom · inputs · sheet · haptics · track-bg · chart · celebrate   UI stavebnice, 11 tartanových pozadí, SVG grafy, PB oslava
js/views/  today · checkin · done · week · performance · charts · settings
apps-script/Code.gs                       backend nad Sheetem
tools/     devserver.py · make_icons.py   lokální server bez cache, generátor ikon
```

## 1. Google Sheet + Apps Script (jednorázově, ~5 min)

1. Na [sheets.new](https://sheets.new) založ prázdnou tabulku, pojmenuj ji třeba *Trénink deník*.
2. V tabulce otevři **Rozšíření → Apps Script**. Smaž obsah `Kód.gs`, vlož celý soubor `apps-script/Code.gs` a ulož (Ctrl+S).
3. Nahoře vyber funkci **setup** a klikni na **Spustit**.
   - Google si řekne o oprávnění. Klikni na **Zkontrolovat oprávnění**, vyber svůj účet, pak **Rozšířené → Přejít na … (nebezpečné)** a **Povolit**. Je to tvůj vlastní skript, proto ho Google vede jako „neověřený“.
   - V **Protokolu provádění** se objeví řádek `TOKEN: …`. Ten si zkopíruj.
   - V tabulce se založí listy Jednotky, Wellness, Tydny, Reporty, Nastaveni, Zavody, Testy, PB_Plany a Telesne_miry.
4. Klikni na **Nasadit → Nové nasazení → ozubené kolečko → Webová aplikace** a nastav:
   - *Spustit jako:* **Já**
   - *Kdo má přístup:* **Kdokoli**. Bez toho se appka nepřipojí. Data chrání token, bez něj skript nic nevrátí.
5. Klikni na **Nasadit** a zkopíruj **URL webové aplikace** (končí na `/exec`).
6. V appce otevři **Nastavení (ozubené kolečko) → Google Sheet**, vlož URL a token a dej **Otestovat**. Do třetího pole můžeš vložit odkaz na samotnou tabulku.

### Aktualizace skriptu

Když se `apps-script/Code.gs` změní (aktuálně verze 9):

1. **Google Sheets** (tvoje tabulka v prohlížeči na počítači) → **Rozšíření → Apps Script**.
2. **Editor Apps Scriptu** → soubor `Kód.gs` → označ všechno (Ctrl+A) → vlož nový obsah `apps-script/Code.gs` z GitHubu → Ctrl+S.
3. **Editor Apps Scriptu** → vpravo nahoře **Nasadit → Spravovat nasazení** → u stávajícího nasazení **tužka (Upravit)** → *Verze:* **Nová verze** → **Nasadit**.
4. URL ani token se nemění, v appce nic nepřepisuješ. **Appka na iPhonu → ozubené kolečko → Google Sheet → Otestovat** pak ukáže `Spojení OK`.

## 2. Hosting na GitHub Pages

1. Na [github.com/new](https://github.com/new) založ repozitář `trenink-denik`, nastav ho jako **Public** a nepřidávej README.
2. Nahraj kód (`git push`).
3. V repozitáři otevři **Settings → Pages → Build and deployment**. Zvol *Source:* **Deploy from a branch**, *Branch:* **main** a **/ (root)**, pak **Save**.
4. Asi za minutu poběží appka na `https://gasiunasdominik-lgtm.github.io/trenink-denik/`.

## Fáze 3: nedělní report a ranní zkratka

- Nedělní report píše samostatná Cowork úloha do listu **Reporty**; appka ho ukáže v **TÝDNU → Claude · nedělní analýza** (formát: `## nadpis`, `- odrážka`, `**tučně**`).
- [docs/ios-zkratky.md](docs/ios-zkratky.md): ranní import spánku, času v posteli a klidového tepu z Apple Health (Garmin → Zdraví). Potřebuje Apps Script verze 8+.

## 3. Instalace na iPhone

Otevři adresu v **Safari** a dej **Sdílet → Přidat na plochu**. Appka se spustí přes celou obrazovku a funguje offline. Zápisy bez signálu čekají ve frontě a odešlou se, jakmile se telefon připojí (v Nastavení vidíš „ve frontě N“).

## Vývoj

```
python tools/devserver.py        # http://localhost:5173 (na localhostu je service worker vypnutý)
python tools/make_icons.py       # přegeneruje ikony
```

Po každé změně souborů, kterou nasazuješ, zvyš `VERSION` v `sw.js`. Jinak iPhone dál servíruje starou verzi z cache.

## Datový model (listy)

| List | Klíč | Sloupce |
|---|---|---|
| Jednotky | id | datum, poradi, typ, nazev, detail, plan_min, min, rpe, srpe, obsah, poznamka, sprint_m, skoky, hody, prekazky, reg_min, zo, zn, zav, skip, smazano, ts |
| Wellness | datum | cas, hrv, rhr, spanek_h, v_posteli_h, spanek_zdroj (zdravi / rucne), spanek_q, unava, svaly, nalada (1–5, 5 = nejlepší), bolest (JSON partie → 1–3), ts |
| Tydny | tyden (`2026-W42`) | zhodnoceni, ts |
| Reporty | id / tyden | datum, titulek, text, ts – plní Claude (fáze 3) |
| Nastaveni | klic | hodnota (JSON), ts |
| Zavody | id | datum, zavod, misto, disciplina, vykon (s nebo m), vykon_txt, vitr, rucne, poradi, body (WA), poznamka, ts |
| Testy | id | datum, test, kategorie, hodnota, jednotka, poznamka, ts |
| PB_Plany | disciplina | pb, pb_datum, plan_letos, vykon_letos, plan_pristi, rekord_cr (český rekord), rekord_cr_drzitel, rekord_sr (světový rekord), rekord_sr_drzitel, ts |
| Telesne_miry | datum | vaha, vyska, tuk_pct, rhr, ts |

Konflikty řeší pravidlo „novější `ts` vyhrává“. Všechny buňky jsou textové, aby Sheets nepřeváděl data a časy na vlastní typy.

## Výpočty

- **sRPE** = minuty × RPE. **ACWR** = součet za 7 dní ÷ (součet za 28 dní ÷ 4). Počítá se až od 7 tréninkových dnů v historii.
- **Monotonie** = průměr ÷ směrodatná odchylka denních zátěží za 7 dní. **Strain** = 7denní zátěž × monotonie.
- **Readiness 0–100** se skládá z HRV vs. 28denní baseline (30 %), klidového tepu (15 %), spánku (20 %) a únavy, svalů a nálady (35 %). Za každý stupeň nejsilnější bolesti se odečte 6 bodů.
- **Overreaching flag** se zapne, když platí pokles HRV ≥ práh, vzestup tepu ≥ práh a horší spánek, a to N dní po sobě. Prahy nastavíš v Nastavení.
- **OTU:** ČZ jsou minuty bez regenerace, REG jsou regenerační jednotky + REG min, DNY a JED (dvoufázový den = 2), ZO/ZN jsou dny se zdravotním omezením a nemocí, ZÁV jsou starty.
