# iOS zkratka „Ranní data ze Zdraví“

Doplní do dnešního check-inu **spánek** a **klidový tep** z Apple Health (Garmin → Zdraví). Přepíše jen prázdná pole, takže co vyplníš ručně, zůstane. Ráno pak v check-inu stačí HRV a pocity.

Potřebuješ Apps Script **verze 6** (README → Aktualizace skriptu) a z **appky Deník → ozubené kolečko → Google Sheet** opsanou **URL** (končí na `/exec`) a **token**.

---

## 0. Ověření, že Garmin posílá data do Zdraví (jednou)

1. **iPhone → aplikace Zdraví → vpravo dole Procházet → Srdce → Klidová tepová frekvence.** Sjeď dolů na **Zdroje dat a přístup**: musí tam být **Garmin Connect**.
2. **Zdraví → Procházet → Spánek:** musí být vidět poslední noc.
3. Pokud něco chybí: **aplikace Garmin Connect → Více (☰) → Nastavení → Připojené aplikace → Apple Zdraví** a zapni **Spánek** a **Srdeční tep**.

---

## 1. Postavení zkratky (4 akce)

**iPhone → aplikace Zkratky → dole záložka Zkratky → vpravo nahoře +.** Nahoře klepni na název „Nová zkratka“ a přejmenuj ji na **Ranní data ze Zdraví**.

Do pole **Hledat akce** dole postupně napiš a přidej:

### Akce 1: Najít vzorky zdraví

- V akci klepni na modré slovo za „Najít“ (typ vzorku) a vyber **Klidová tepová frekvence**.
- Klepni na **Seřadit podle** → **Počáteční datum**, **Pořadí** → **Od nejnovějších**.
- Zapni **Omezit** a nech **1**.
- Filtr na datum nepřidávej.

### Akce 2: Najít vzorky zdravotních dat (spánek)

> Pozor: musí to být **Najít vzorky zdravotních dat**, ne **Filtrovat vzorky zdravotních dat**. Filtr hledá jen ve výsledku akce 1, tedy v jednom vzorku tepu, takže spánek nikdy nenajde.

- Typ: **Spánek** (Sleep)
- **Přidat filtr** → **Datum začátku** → **je v posledních** → **1** **dni**
- **Seřadit podle: Žádné**, **Omezit: vypnuto**. Další filtry nejsou potřeba.

Garmin zapisuje spánek po fázích (jádro, hluboký, REM, vzhůru) a navíc jeden dlouhý blok „V posteli“, který fáze překrývá. Skript si to rozebere sám: blok nezapočítá dvakrát a čas vzhůru vynechá.

### Akce 3: Získat obsah URL

- Do pole URL vlož svou URL Apps Scriptu.
- Klepni na šipku **›** u akce:
  - **Metoda:** **POST**
  - **Tělo požadavku:** **JSON**
- Klepni na **Přidat nové pole** → **Text** a vyplň klíč a hodnotu. Celkem 5 polí:

| Klíč | Hodnota |
|---|---|
| `token` | tvůj token (opiš z appky) |
| `action` | `wellness` |
| `rhr` | podrž prst v poli hodnoty → **Vybrat proměnnou** → klepni na výsledek **akce 1** (Vzorky zdraví) |
| `spanek` | stejně → klepni na výsledek **akce 2**. Pak klepni na vloženou modrou bublinu a zvol **Doba trvání** |
| `faze` | znovu výsledek **akce 2** → klepni na bublinu → zvol **Hodnota** (In Bed / Core / Deep / REM / Awake) |

Pole `faze` je páté. Díky němu skript přesně pozná, která délka patří ke které fázi. Bez něj spánek odhadne.

### Akce 4: Zobrazit oznámení

- Do textu vlož proměnnou **Obsah URL** (výsledek akce 3).

Hotovo. Zkratku spusť ručně (klepnutím na její dlaždici). Oznámení má ukázat třeba `{"ok":true,"text":"Zapsáno: spánek 6,3 h (fáze spánku, bez 0,1 h vzhůru), tep 41"}`. Když něco chybí, napíše proč, např. „spánek nepřišel – ve zkratce chybí akce Najít vzorky se spánkem“.

**Ověření:** v **Google Sheets → list Wellness** je u dnešního data vyplněný `spanek_h` a `rhr`. V **appce → DNES → Ranní check-in** jsou hodnoty předvyplněné. Appku před tím zavři a otevři, ať si data stáhne.

---

## 2. Automatické spuštění ráno

**Zkratky → dole záložka Automatizace → + (nebo Nová automatizace) → Budík → Je zastaven** → vyber svůj ranní budík → **Spustit okamžitě** → **Další** → vyber **Ranní data ze Zdraví**.

Garmin Connect musí mít noc už nahranou do Zdraví. Když oznámení napíše „Nic nového“, otevři Garmin Connect (tím se data stáhnou) a zkratku spusť ručně. Případně dej automatizaci na pevný čas: **Denní čas → 7:30**.

---

## Když to nejde

Pošli mi screenshot obrazovky, kde ses zasekl, nebo přesné znění oznámení:

- `Špatný token`: token v akci 3 se neshoduje s tím v appce.
- `Neznámá akce`: v Apps Scriptu běží starší verze, nasaď verzi 6.
- `Nic nového · spánek už zapsaný…`: dnešní hodnoty už v Sheetu jsou.
- `spánek nepřišel`: akce 2 je Filtrovat místo Najít, nebo pole `spanek` v akci 3 neukazuje na akci 2.
- `spánek nečitelný (přišlo: …)`: v poli `spanek` chybí vlastnost **Doba trvání**. Klepni na bublinu a vyber ji.
- `počet fází nesedí`: pole `faze` neukazuje na stejnou akci jako `spanek`, nebo u něj chybí vlastnost **Hodnota**.
- `fáze neúplné`: Garmin do Zdraví neposlal všechny fáze. Skript proto vzal blok V posteli bez času vzhůru. Porovnej s délkou spánku v Garmin Connect.
- Spánek ve Zdraví vůbec není (krok 0): spánek zadávej v ranním check-inu. Krokovač je předvyplněný včerejší hodnotou, takže stačí upravit o pár kliknutí.

---

## Volitelně: „Hej Siri, zapiš trénink“

Akce `log` ve skriptu je připravená. Pokud bys ji někdy chtěl, řekni mi a návod dopíšu.
