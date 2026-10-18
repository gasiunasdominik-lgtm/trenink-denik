# iOS zkratka „Ranní data ze Zdraví“

Doplní do dnešního check-inu **spánek**, **čas v posteli** a **klidový tep** z Apple Health (Garmin → Zdraví).

- Zkratka pošle u každého vzorku spánku začátek, konec, fázi a zdroj.
- Skript vezme jen poslední noc (od 18:00 včerejška) a jen jeden zdroj (Garmin, jinak ten s nejvíc daty).
- Spánek spočítá jako sjednocení fází jádro / hluboký / REM / spánek: bez „V posteli“, bez „Vzhůru“ a bez dvojího započtení.
- Spánek, který změníš ručně v check-inu, import nepřepíše.

Potřebuješ Apps Script **verze 8** (README → Aktualizace skriptu) a z **appky Deník → ozubené kolečko → Google Sheet** opsanou **URL** (končí na `/exec`) a **token**.

---

## A. Úprava stávající zkratky (máš-li verzi se `spanek` a `faze`)

**iPhone → Zkratky → podrž „Ranní data ze Zdraví“ → Upravit → akce „Načíst obsah“ → rozbal pole (šipka ›).**

1. Řádek **`spanek`**: smaž ho (přejeď po něm doleva → Smazat, nebo červené −).
2. Řádek **`faze`** nech, jak je (výsledek hledání spánku → **Hodnota**).
3. **Přidat nové pole → Text:** klíč `zacatek`. Do hodnoty podrž prst → **Vybrat proměnnou** → výsledek akce se spánkem. Klepni na modrou bublinu:
   - zvol **Datum začátku**,
   - u **Formát data** zvol **ISO 8601** a zapni **zahrnout čas**, pokud tam ta volba je.
4. **Přidat nové pole → Text:** klíč `konec`, stejně jako v kroku 3, jen zvol **Datum konce** (opět ISO 8601).
5. **Přidat nové pole → Text:** klíč `zdroj`, výsledek akce se spánkem → bublina → **Zdroj**.
6. Klepni na **▶**. Oznámení má napsat třeba
   `Zapsáno: spánek 8,4 h (Garmin Connect, 23:05–8:36, v posteli 9,5 h, ostatní zdroje vynechány)`.

Dnešní chybných 14,5 h skript sám přepíše, protože pochází z importu, ne z ručního zápisu.

---

## B. Celá zkratka od začátku (4 akce)

**Zkratky → + → název „Ranní data ze Zdraví“.**

1. **Najít vzorky zdravotních dat:** typ **Klidová tepová frekvence**, Seřadit podle **Datum začátku**, **Od nejnovějších**, **Omezit na 1**.
2. **Najít vzorky zdravotních dat:** typ **Spánek**, filtr **Datum začátku je v posledním 1 dni**, Seřadit **Žádné**, Omezit **vypnuto**.
   Musí to být **Najít**, ne „Filtrovat“: filtr hledá jen ve výsledku akce 1.
3. **Načíst obsah (Získat obsah URL):** tvoje URL, **Metoda POST**, **Tělo požadavku JSON**. Pole (typ **Text**):

   | Klíč | Hodnota |
   |---|---|
   | `token` | tvůj token |
   | `action` | `wellness` |
   | `rhr` | výsledek akce 1 → **Hodnota** |
   | `zacatek` | výsledek akce 2 → **Datum začátku**, Formát data **ISO 8601** |
   | `konec` | výsledek akce 2 → **Datum konce**, Formát data **ISO 8601** |
   | `faze` | výsledek akce 2 → **Hodnota** |
   | `zdroj` | výsledek akce 2 → **Zdroj** |

4. **Zobrazit oznámení:** proměnná **Obsah URL**.

### Automatické spuštění ráno

**Zkratky → Automatizace → + → Budík → Je zastaven** → tvůj ranní budík → **Spustit okamžitě** → **Ranní data ze Zdraví**.

Garmin Connect musí mít noc nahranou do Zdraví. Když oznámení napíše „žádný spánek od 18:00 včerejška“, otevři Garmin Connect a zkratku spusť ručně.

---

## Hlášení v oznámení

- `spánek: seznamy mají různou délku`: pole `zacatek`, `konec` a `faze` musí ukazovat na **stejnou** akci (hledání spánku).
- `spánek: nečitelné datum`: u `zacatek` nebo `konec` není formát data ISO 8601 (český formát skript zvládne taky, ale jiné ne).
- `žádný spánek od 18:00 včerejška`: Garmin ještě nenahrál noc do Zdraví.
- `spánek už zapsaný ručně`: spánek jsi zadal v check-inu, import ho nepřepisuje.
- `Špatný token` / `Neznámá akce`: zkontroluj token / nasaď verzi 8 skriptu.

Pokud by to i tak nešlo: spánek zadávej v ranním check-inu. Krokovač je předvyplněný včerejší hodnotou.

---

# Zkratka „Zapiš trénink“ (Siri, diktováním)

Řekneš **„Hej Siri, zapiš trénink“**. Siri se zeptá, co jsi trénoval, kolik minut a jaké RPE, a jednotku zapíše rovnou do Sheetu. V appce se objeví na **DNES** jako jednotka navíc s razítkem. Typ (tyč, výška, rychlost, regenerace…) skript odhadne z toho, co řekneš.

**iPhone → Zkratky → + → název „Zapiš trénink“** (podle názvu ji Siri spouští). Akce:

1. **Zeptat se na vstup:** typ **Text**, výzva `Co jsi trénoval?`
2. **Nastavit proměnnou:** název `Nazev`, vstup **Zadaný vstup**
3. **Zeptat se na vstup:** typ **Číslo**, výzva `Kolik minut?`
4. **Nastavit proměnnou:** `Minuty`
5. **Zeptat se na vstup:** typ **Číslo**, výzva `RPE od jedné do deseti?`
6. **Nastavit proměnnou:** `RPE`
7. **Načíst obsah (Získat obsah URL):** tvoje URL Apps Scriptu, **POST**, **JSON**:

   | Typ | Klíč | Hodnota |
   |---|---|---|
   | Text | `token` | tvůj token |
   | Text | `action` | `log` |
   | Text | `nazev` | proměnná *Nazev* |
   | Číslo | `min` | proměnná *Minuty* |
   | Číslo | `rpe` | proměnná *RPE* |

8. **Získat hodnotu slovníku:** klíč `text` z *Obsah URL*
9. **Zobrazit výsledek:** *Hodnota slovníku*. Siri řekne třeba „Zapsáno: Tyč technika, 90 min, RPE 7“.

Když jednotka patří k dnešnímu plánu (třeba „Multi-event blok“), zapiš ji raději v appce přes **Hotovo**, ať se odškrtne plánovaná dráha. Siri je na tréninky mimo šablonu.
