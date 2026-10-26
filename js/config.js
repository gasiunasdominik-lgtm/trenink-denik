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

const u = (typ, nazev, detail, min) => ({ typ, nazev, detail, min });

/** Týdenní šablona: klíč = den v týdnu (1 = pondělí … 7 = neděle). */
export const DEFAULT_TEMPLATE = {
  1: [u('rychlost', 'Rychlost se sprintery', 'max rychlost · letmé úseky', 90)],
  2: [u('multi', 'Multi-event blok', 'technika + síla', 120)],
  3: [u('slabiny', 'Slabiny bez trenéra', 'jednonožní reaktivita L · kotník · bez náčiní', 60),
      u('regenerace', 'Regenerace', 'protažení · válec', 30)],
  4: [{ ...u('technika', 'Tyč + gymnastika', 'rychlost · horní tělo', 120), zamereni: 'technika,gymnastika', discipliny: 'tyc' }],
  5: [u('rv', 'Rychlostní vytrvalost', 'tempo', 90)],
  6: [u('multi', 'Multi-event blok', 'technika + síla', 120),
      u('regenerace', 'Sauna + masáž', 'regenerace', 45)],
  7: [],
};

export const DEFAULT_DAILY = [u('mobilita', 'Mobilita / rehab', 'kotník L · loket P', 30)];

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

export const TEST_CATEGORIES = { obecne: 'Obecné', specialni: 'Speciální', vlastni: 'Vlastní' };

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
];

/** Sezóna (tréninkový rok) začíná 1. října. */
export const SEASON_START_MONTH = 10;
