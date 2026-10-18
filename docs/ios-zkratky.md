# iOS zkratky pro Trénink deník

Obě zkratky posílají data rovnou do Google Sheetu přes tvůj Apps Script (verze 3+). Appka je načte při dalším otevření.
U každé akce je v závorce anglický název, kdyby měl telefon jiný jazyk.

Budeš potřebovat **URL Apps Scriptu** (končí na `/exec`) a **token**. Obojí máš v **appce Deník → ozubené kolečko → Google Sheet**.

---

## 0. Ověření, co Garmin posílá do Zdraví (jednou)

1. **iPhone → aplikace Zdraví → vpravo dole Procházet → Srdce → Klidová tepová frekvence.** Sjeď dolů na **Zdroje dat a přístup**: musí tam být **Garmin Connect**.
2. **Zdraví → Procházet → Spánek:** musí být vidět poslední noc ze zdroje Garmin Connect.
3. Pokud tam Garmin chybí: **aplikace Garmin Connect → Více (☰) → Nastavení → Připojené aplikace → Apple Zdraví** a zapni **Spánek** a **Srdeční tep**. Pak ještě **Zdraví → profilová fotka vpravo nahoře → Aplikace → Garmin Connect** a povol zápis kategorií.

HRV Garmin do Zdraví neposílá. HRV dál zapisuješ z mySASY v ranním check-inu.

---

## 1. Zkratka „Zapiš trénink“ (Siri, diktováním)

Použití: řekneš „Hej Siri, zapiš trénink“, Siri se zeptá na trénink, minuty a RPE a zapíše jednotku. V appce se objeví na DNES jako jednotka navíc. Typ (tyč, výška, rychlost, regenerace…) se odhadne z názvu.

**iPhone → aplikace Zkratky → záložka Zkratky → + vpravo nahoře.** Nahoře klepni na název a přejmenuj zkratku na **Zapiš trénink**. Pak přidej akce v tomto pořadí (pole „Hledat akce“ dole):

1. **Zeptat se na vstup** (Ask for Input): typ **Text**, výzva `Co jsi trénoval?`
2. **Nastavit proměnnou** (Set Variable): název `Nazev`, vstup = *Zadaný vstup*
3. **Zeptat se na vstup**: typ **Číslo**, výzva `Kolik minut?`
4. **Nastavit proměnnou**: název `Minuty`, vstup = *Zadaný vstup*
5. **Zeptat se na vstup**: typ **Číslo**, výzva `RPE od jedné do deseti?`
6. **Nastavit proměnnou**: název `RPE`, vstup = *Zadaný vstup*
7. **Získat obsah URL** (Get Contents of URL):
   - URL: tvoje URL Apps Scriptu
   - klepni na **›** (Zobrazit více): **Metoda: POST**, **Tělo požadavku: JSON**
   - přidej pole (+ Přidat nové pole):
     | Typ | Klíč | Hodnota |
     |---|---|---|
     | Text | `token` | tvůj token |
     | Text | `action` | `log` |
     | Text | `nazev` | proměnná *Nazev* |
     | Číslo | `min` | proměnná *Minuty* |
     | Číslo | `rpe` | proměnná *RPE* |
8. **Získat hodnotu slovníku** (Get Dictionary Value): **Hodnota** pro klíč `text` v *Obsah URL*
9. **Zobrazit výsledek** (Show Result): *Hodnota slovníku*. Siri ji přečte, například „Zapsáno: Tyč technika, 90 min, RPE 7“.

Vyzkoušej: **Hej Siri, zapiš trénink.**

---

## 2. Zkratka „Ranní data ze Zdraví“ (spánek + klidový tep)

Doplní do dnešního check-inu spánek a klidový tep. Přepíše jen prázdná pole, takže co vyplníš ručně, zůstane. Ráno pak v check-inu stačí HRV a pocity.

**Zkratky → + → přejmenovat na „Ranní data ze Zdraví“.** Akce:

1. **Najít vzorky zdraví** (Find Health Samples):
   - Typ: **Klidová tepová frekvence** (Resting Heart Rate)
   - filtr: **Počáteční datum** je **dnes**
   - Seřadit podle **Počáteční datum**, pořadí **Od nejnovějších**, **Omezit** zapnuto, **1**
2. **Získat podrobnosti vzorků zdraví** (Get Details of Health Sample): **Hodnota**
3. **Nastavit proměnnou**: `Tep`
4. **Najít vzorky zdraví**:
   - Typ: **Spánek** (Sleep Analysis)
   - filtr: **Počáteční datum** je **v posledních 1 dnech**
   - druhý filtr: **Hodnota** **není** **V posteli** (In Bed). Sčítá se jen skutečný spánek.
5. **Získat podrobnosti vzorků zdraví**: **Doba trvání** (Duration)
6. **Vypočítat statistiku** (Calculate Statistics): **Součet**
7. **Nastavit proměnnou**: `Spanek`
8. **Získat obsah URL**: URL Apps Scriptu, **POST**, **JSON**:
   | Typ | Klíč | Hodnota |
   |---|---|---|
   | Text | `token` | tvůj token |
   | Text | `action` | `wellness` |
   | Text | `spanek` | proměnná *Spanek* |
   | Text | `rhr` | proměnná *Tep* |
9. **Získat hodnotu slovníku**: klíč `text`
10. **Zobrazit oznámení** (Show Notification): *Hodnota slovníku*

Skript pozná spánek v hodinách, minutách i sekundách („7,5“, „450“, „27000“, „7 h 30 min“), takže na jednotce, kterou Zkratky pošlou, nezáleží.

### Automatické spuštění ráno

**Zkratky → záložka Automatizace → + → Budík → Je zastaven** (Is Stopped) → vyber svůj ranní budík → **Spustit okamžitě** → **Další** → zkratka **Ranní data ze Zdraví**.

Garmin Connect musí mít noc už synchronizovanou do Zdraví. Když po zastavení budíku přijde oznámení „Nic nového“, otevři Garmin Connect (tím se data stáhnou) a zkratku spusť ručně. Případně automatizaci dej na čas, třeba **Denní čas 7:30**.

---

## Řešení problémů

- **„Špatný token“:** zkontroluj token v kroku Získat obsah URL. Musí být přesně stejný jako v appce.
- **„Neznámá akce“:** v Apps Scriptu běží starší verze. Nasaď novou podle README → Aktualizace skriptu.
- **Spánek nebo tep prázdný:** v kroku 0 zkontroluj, že Garmin zapisuje do Zdraví. Klidová tepová frekvence se někdy objeví až během dopoledne.
