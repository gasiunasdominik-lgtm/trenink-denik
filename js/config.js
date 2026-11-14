// Výchozí nastavení a číselníky. Uživatelské změny se ukládají přes store (settings).

/**
 * Zaměření jednotky (co se rozvíjelo). group = skupina ve výběru, bg = motiv tartanu, reg = regenerace (počítá se do REG, ne do ČZ/JED),
 * hint = nápověda pod čipem. Jednotka má hlavní zaměření v `typ`, všechna vybraná v `zamereni` a disciplíny v `discipliny` (čárkami).
 */
export const TYPES = {
  starty:     { label: 'Starty / akcelerace',     group: 'rychlost',   bg: 2,  hint: 'do 30–40 m · bloky, polovysoký start' },
  rychlost:   { label: 'Max. rychlost',           group: 'rychlost',   bg: 4,  hint: 'letmé úseky 20–60 m · plná pauza' },
  rv:         { label: 'Rychlostní vytrvalost',   group: 'rychlost',   bg: 3,  hint: '80–150 m téměř naplno · dlouhá pauza' },
  sv:         { label: 'Sprinterská vytrvalost',  group: 'rychlost',   bg: 3,  hint: '150–400 m · laktát · 400 m' },
  aerobni:    { label: 'Aerobní základ',          group: 'vytrvalost', bg: 3,  hint: 'klus, fartlek, kolo, plavání · dá se mluvit' },
  tempo:      { label: 'Tempo (extenzivní)',      group: 'vytrvalost', bg: 3,  hint: '100–300 m na 60–75 % · krátké pauzy' },
  vytrvalost: { label: 'Speciální vytrvalost',    group: 'vytrvalost', bg: 3,  hint: '1500 m: úseky 300–1000 m · ANP, VO₂max' },
  technika:   { label: 'Technika disciplín',      group: 'technika',   bg: 7,  hint: 'vyber disciplíny níž' },
  multi:      { label: 'Multi-event blok',        group: 'technika',   bg: 8,  hint: 'víc disciplín za sebou' },
  zavod:      { label: 'Závod / test',            group: 'technika',   bg: 2 },
  sila:       { label: 'Síla / posilovna',        group: 'sila',       bg: 10, hint: 'činky · max a submax' },
  vybusnost:  { label: 'Výbušnost / plyometrie',  group: 'sila',       bg: 10, hint: 'odrazy, skoky, medicinbal' },
  kruhovy:    { label: 'Kruhový / silová vytrv.', group: 'sila',       bg: 10 },
  gymnastika: { label: 'Gymnastika',              group: 'sila',       bg: 9 },
  slabiny:    { label: 'Slabiny / prevence',      group: 'sila',       bg: 10, hint: 'kotník, jednonožní, stabilita' },
  mobilita:   { label: 'Mobilita / rehab',        group: 'regen',      bg: 10, reg: true },
  regenerace: { label: 'Regenerace',              group: 'regen',      bg: 10, reg: true, hint: 'sauna, masáž, válec, protažení' },
  jine:       { label: 'Jiné / hry',              group: 'regen',      bg: 10, hint: 'fotbal, lyže, cokoli dalšího' },
  // dřívější typy – staré zápisy a šablony je dál nesou, ve výběru nejsou (legacy = nový typ, disc = disciplíny)
  start:      { label: 'Starty',        bg: 2,  legacy: 'starty' },
  prekazky:   { label: 'Překážky',      bg: 5,  legacy: 'technika', disc: ['110pr'] },
  dalka:      { label: 'Dálka',         bg: 7,  legacy: 'technika', disc: ['dalka'] },
  vyska:      { label: 'Výška',         bg: 9,  legacy: 'technika', disc: ['vyska'] },
  tyc:        { label: 'Tyč',           bg: 7,  legacy: 'technika', disc: ['tyc'] },
  vrhy:       { label: 'Koule / disk',  bg: 6,  legacy: 'technika', disc: ['koule', 'disk'] },
  ostep:      { label: 'Oštěp',         bg: 12, legacy: 'technika', disc: ['ostep'] },
  stafeta:    { label: 'Štafeta',       bg: 11, legacy: 'technika', disc: ['stafeta'] },
};

/** Skupiny zaměření ve výběru (pořadí = pořadí na obrazovce). */
export const TYPE_GROUPS = [['rychlost', 'Rychlost'], ['vytrvalost', 'Vytrvalost'], ['technika', 'Technika a závody'], ['sila', 'Síla'], ['regen', 'Regenerace a ostatní']];

/** Disciplíny, které jde k jednotce přiřadit (víc najednou). id = id z DISCIPLINES, štafeta navíc. */
export const UNIT_DISC = [['100', '100 m'], ['dalka', 'Dálka'], ['koule', 'Koule'], ['vyska', 'Výška'], ['400', '400 m'], ['110pr', 'Překážky'],
  ['disk', 'Disk'], ['tyc', 'Tyč'], ['ostep', 'Oštěp'], ['1500', '1500 m'], ['stafeta', 'Štafeta']];

const u = (typ, nazev, detail, min, extra = {}) => ({ typ, nazev, detail, min, ...extra });

/**
 * Týdenní šablona: klíč = den v týdnu (1 = pondělí … 7 = neděle). Jeden trénink = jedna jednotka;
 * `obsah` je předepsaný obsah, který se předvyplní do zápisu a dá se tam i v Nastavení upravit.
 * Plán vícebojaře od 11/2026: Po + Út těžké, St lehká, Čt technický, Pá těžký, So střední, Ne volno.
 */
export const DEFAULT_TEMPLATE = {
  1: [u('rychlost', 'Rychlost se sprintery', 'max rychlost · se skupinou', 90, {
    obsah: '4min. Klus; 10min MMPR; technické cvičení na běh s mediky/gumou/malými překážkami; akcelerace + max rychlost [20–30m úseky podle trenéra, plná p.]; 4min. Klus',
  })],
  2: [u('technika', 'Výška + síla', 'výška → výskoky → tempo → bulharák', 120, {
    zamereni: 'technika,vybusnost,sila,tempo', discipliny: 'vyska',
    obsah: 'Warm up Running 2x(60-50-40-30-20s) p1 p3; 10min MMPR; izometrie loket; 4x running ABC, 4x jumping ABC; Výška [10–12x skoky ze 4/6 kroků]; '
      + 'Příprava + stabilita: 8+8 RDL single leg + FX kyčle s 12,5kg KB, 2x20 pogo jumps (s gumou); '
      + 'Výskoky: Rear foot elevated Split squat jump 3x(4+4) p. 2–3min., Single leg countermovement jump 3x(4+4); '
      + 'Extenzivní tempo [5–6x 200m 70–75% p. klus/chůze]; '
      + 'Bulgarian Split squat (excentricky dolu, explozivně nahoru) 3x(6+6) RPE 75-85% (10+10kg) p. 2–3min.; 400m výklus',
  })],
  3: [u('aerobni', 'Rozběhání + fyzio', 'lehký den · loket, core, mostík', 60, {
    zamereni: 'aerobni,mobilita',
    obsah: 'Warm up Running 6x60s p1; 10min MMPR; 10x30m ABC (odrazy jen skipy); '
      + 'Fyzio: Powerball 3x30s, KB rotace 3x(8+8); Mostík na jedné noze 3x(30s+30s); '
      + 'Zápěstní flexe 3x12, pronace s odporem 3x12 (izotonicky až po izometrické fázi); Core: dead bug 2x8, Pallof press s gumou 2x8',
  })],
  4: [u('technika', 'Tyč + vrh', 'se skupinou · horní polovina na konci', 110, {
    zamereni: 'technika,sila', discipliny: 'tyc,koule',
    obsah: '800m klus; 10min MMPR; 5x ABC; 2x rovinka; 20min plant drills; Tyč [skoky ze 6/8 kroků; ztuhlé nohy → kratší rozběh]; '
      + 'Koule [odhody od prsou/z místa/sun]; Horní polovina: 3x (přítahy, shyby, landmine press, medicimbal) – bez těžkého benche; 120m výklus',
  })],
  5: [u('rv', 'Rychlostní vytrvalost', 'se skupinou · nebo příprava na 1500/1000m', 85, {
    zamereni: 'rv,vytrvalost,slabiny', discipliny: '1500',
    obsah: 'Warm up Running; 10min MMPR; 4x running ABC; 2x rovinka; RV / 1500m [úseky podle trenéra]; Reverse nordic 1x6 (od 3. týdne 2x6); Core 3x8–10; výklus',
  })],
  6: [u('technika', 'Překážky + vrhy', 'technicky ≤85 % · vrhy podle lokte', 90, {
    zamereni: 'technika', discipliny: '110pr,koule',
    obsah: 'Warm up Running; 10min MMPR + kotníková prevence; 4x ABC, 2x rovinka; Překážky [3–4x(3–5 překážek) zkrácené rozestupy ≤85% p. 3–4min.]; '
      + 'Vrhy [10–25 hodů podle fáze lokte, jen když čtvrtek ≤3/10]; Klus 20–30min RPE ≤4 (vynechat při nízkém HRV/ztuhlém hamstringu); protažení',
  }),
      u('regenerace', 'Sauna + masáž', 'regenerace', 45)],
  7: [],
};

/** Verze výchozí šablony. Při zvýšení se uložená šablona jednou nahradí novou (viz store.mergeSettings). */
export const TEMPLATE_VERSION = 3;

export const DEFAULT_DAILY = [u('mobilita', 'Mobilita / rehab', 'kotník L · loket P', 30)];

/** Denní jednotka, kterou omylem nastavila verze 2 – při přechodu se vrací tvoje původní. */
export const DAILY_V2 = [u('mobilita', 'Mobilita / rehab', 'izometrie lokte 4–5× 30–45 s · kotník L · hamstringy', 15)];

export const DEFAULT_BODY_PARTS = ['P hamstring', 'L flexor kyčle', 'L kotník', 'P rameno', 'P loket'];

export const CHECKIN_FIELDS = {
  hrv:       'HRV (mySASY)',
  rhr:       'Klidový tep',
  spanek_h:  'Spánek – hodiny',
  spanek_q:  'Spánek – kvalita',
  unava:     'Únava',
  svaly:     'Svaly',
  nalada:    'Nálada',
  bolest:    'Bolest',
};

export const DEFAULT_SETTINGS = {
  template: DEFAULT_TEMPLATE,
  templateVersion: TEMPLATE_VERSION,
  daily: DEFAULT_DAILY,
  bodyParts: DEFAULT_BODY_PARTS,
  checkinFields: Object.fromEntries(Object.keys(CHECKIN_FIELDS).map(k => [k, true])),
  thresholds: {
    hrvDropPct: 10,   // pokles HRV vs. 28denní baseline (%)
    rhrRise: 3,       // vzestup klidového tepu (bpm)
    sleepDropH: 0.5,  // spánek pod baseline (h)
    days: 2,          // kolik dní po sobě
    green: 70,        // readiness ≥ green → plný trénink
    amber: 50,        // readiness ≥ amber → upravit
  },
  bg: 'auto',         // 'auto' = podle dnešního tréninku, jinak číslo varianty
  customTests: [],    // vlastní testy {id, name, unit, lower, cat: 'vlastni'}
  modules: { vykon: true, grafy: true }, // záložky, které jde vypnout
  camps: [],          // soustředění {id, nazev, misto, od, do, poznamka}
  sheetUrl: '',
};

/** Lokální nastavení zařízení – nesynchronizuje se do Sheetu. */
export const DEFAULT_DEVICE = { apiUrl: '', token: '', lastPull: '' };

// ---------- fáze 2: výkon ----------

/**
 * Disciplíny. kind: time (s, nižší = lepší) | dist (m) | points (body víceboje).
 * wa: koeficienty bodovacích tabulek World Athletics pro víceboj muži (A, B, C);
 * jumps = true → výkon v cm. hand = přirážka k ručně měřenému času.
 */
export const DISCIPLINES = [
  { id: '100',    label: '100 m',        kind: 'time', dec: 1,  wa: { A: 25.4347, B: 18,   C: 1.81 }, hand: 0.24 },
  { id: 'dalka',  label: 'Dálka',        kind: 'dist', dec: 2,  wa: { A: 0.14354, B: 220,  C: 1.40, jumps: true } },
  { id: 'koule',  label: 'Koule',        kind: 'dist', dec: 3,  wa: { A: 51.39,   B: 1.5,  C: 1.05 } },
  { id: 'vyska',  label: 'Výška',        kind: 'dist', dec: 4,  wa: { A: 0.8465,  B: 75,   C: 1.42, jumps: true } },
  { id: '400',    label: '400 m',        kind: 'time', dec: 5,  wa: { A: 1.53775, B: 82,   C: 1.81 }, hand: 0.14 },
  { id: '110pr',  label: '110 m př.',    kind: 'time', dec: 6,  wa: { A: 5.74352, B: 28.5, C: 1.92 }, hand: 0.24 },
  { id: 'disk',   label: 'Disk',         kind: 'dist', dec: 7,  wa: { A: 12.91,   B: 4,    C: 1.10 } },
  { id: 'tyc',    label: 'Tyč',          kind: 'dist', dec: 8,  wa: { A: 0.2797,  B: 100,  C: 1.35, jumps: true } },
  { id: 'ostep',  label: 'Oštěp',        kind: 'dist', dec: 9,  wa: { A: 10.14,   B: 7,    C: 1.08 } },
  { id: '1500',   label: '1500 m',       kind: 'time', dec: 10, wa: { A: 0.03768, B: 480,  C: 1.85 } },
  { id: 'desetiboj', label: 'Desetiboj', kind: 'points' },
  { id: '60',     label: '60 m',         kind: 'time', wa: { A: 58.015,  B: 11.5, C: 1.81 }, hand: 0.24 },
  { id: '60pr',   label: '60 m př.',     kind: 'time', wa: { A: 20.5173, B: 15.5, C: 1.92 }, hand: 0.24 },
  { id: '1000',   label: '1000 m',       kind: 'time', wa: { A: 0.08713, B: 305.5, C: 1.85 } },
  { id: 'sedmiboj', label: 'Sedmiboj',   kind: 'points' },
  { id: '200',    label: '200 m',        kind: 'time' },
];

export const TEST_CATEGORIES = { obecne: 'Obecné', specialni: 'Speciální', vald: 'VALD / ForceDecks', vlastni: 'Vlastní' };

/** Testy. lower = nižší hodnota je lepší. */
export const DEFAULT_TESTS = [
  { id: 't50',        name: '50 m z bloků',             unit: 's',     lower: true,  cat: 'obecne' },
  { id: 'plny_mic',   name: 'Autový hod plným míčem',   unit: 'm',     lower: false, cat: 'obecne' },
  { id: 'skok_mista', name: 'Skok z místa',             unit: 'cm',    lower: false, cat: 'obecne' },
  { id: 'sed_leh',    name: 'Sed-leh 1 min',            unit: 'opak.', lower: false, cat: 'obecne' },
  { id: 'drep',       name: 'Hluboký dřep',             unit: 'kg',    lower: false, cat: 'obecne' },
  { id: 'predklon',   name: 'Předklon',                 unit: 'cm',    lower: false, cat: 'obecne' },
  { id: 'beh12',      name: '12min běh',                unit: 'm',     lower: false, cat: 'obecne' },
  { id: 'cmj',        name: 'CMJ',                      unit: 'cm',    lower: false, cat: 'specialni' },
  { id: 'cmj_l',      name: 'CMJ jednonož L',           unit: 'cm',    lower: false, cat: 'specialni' },
  { id: 'cmj_p',      name: 'CMJ jednonož P',           unit: 'cm',    lower: false, cat: 'specialni' },
  { id: 'rsi',        name: 'RSI',                      unit: '',      lower: false, cat: 'specialni' },
  { id: 'rsi_l',      name: 'RSI jednonož L',           unit: '',      lower: false, cat: 'specialni' },
  { id: 'rsi_p',      name: 'RSI jednonož P',           unit: '',      lower: false, cat: 'specialni' },
  { id: 'forcedecks', name: 'ForceDecks',               unit: '',      lower: false, cat: 'specialni' },
  // VALD (ForceDecks, DynaMo) – metriky z reportů Body Solution Clinic; L/P = levá/pravá DK
  ...[['ham_iso', 'Hamstring 30/30 izometrie – peak', 'N'], ['ham_f200', 'Hamstring 30/30 – síla za 200 ms', 'N'], ['ham_rfd', 'Hamstring 30/30 – RFD 150 ms', 'N/s'],
    ['slcmj_rsi', 'SL CMJ rebound – RSI', 'm/s'], ['slcmj_imp', 'SL CMJ rebound – konc. impulz / BM', 'N s/kg'], ['sl_land', 'SL CMJ rebound – dopadová síla', 'N'],
    ['sldj_h', 'SL drop jump – výška', 'cm'], ['sldj_ci', 'SL drop jump – konc. impulz', 'N s'], ['sldj_ei', 'SL drop jump – exc. impulz', 'N s'],
    ['hipflex_rfd', 'Flexe kyčle vsedě – RFD', 'N/s'], ['kneeflex_rfd', 'Flexe kolene vsedě – RFD', 'N/s']]
    .flatMap(([id, name, unit]) => [['_l', ' L'], ['_p', ' P']].map(([s, l]) => ({ id: id + s, name: name + l, unit, lower: id === 'sl_land', cat: 'vald' }))),
  { id: 'dj_h',       name: 'Drop jump – výška',               unit: 'cm',   lower: false, cat: 'vald' },
  { id: 'dj_ci',      name: 'Drop jump – konc. impulz',        unit: 'N s',  lower: false, cat: 'vald' },
  { id: 'dj_land',    name: 'Drop jump – dopadová síla',       unit: 'N',    lower: true,  cat: 'vald' },
  { id: 'sj_h',       name: 'Squat jump – výška',              unit: 'cm',   lower: false, cat: 'vald' },
  { id: 'sj_pp',      name: 'Squat jump – peak power / BM',    unit: 'W/kg', lower: false, cat: 'vald' },
  { id: 'sj_ci',      name: 'Squat jump – konc. impulz',       unit: 'N s',  lower: false, cat: 'vald' },
  { id: 'sj_rfd',     name: 'Squat jump – konc. RFD',          unit: 'N/s',  lower: false, cat: 'vald' },
  { id: 'cmj_pp',     name: 'CMJ – peak power / BM',           unit: 'W/kg', lower: false, cat: 'vald' },
  { id: 'cmj_ci',     name: 'CMJ – konc. impulz',              unit: 'N s',  lower: false, cat: 'vald' },
  { id: 'cmj_ebrfd',  name: 'CMJ – exc. brzdné RFD',           unit: 'N/s',  lower: false, cat: 'vald' },
];

/** Sezóna (tréninkový rok) začíná 1. října. */
export const SEASON_START_MONTH = 10;
