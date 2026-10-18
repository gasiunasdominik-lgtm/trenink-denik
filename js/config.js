// Výchozí nastavení a číselníky. Uživatelské změny se ukládají přes store (settings).

/** Typy jednotek: popisek, motiv pozadí (varianta tartanu) a zda jde o regeneraci (počítá se do REG, ne do ČZ/JED). */
export const TYPES = {
  rychlost:   { label: 'Rychlost',          bg: 4,  reg: false },
  start:      { label: 'Starty',            bg: 2,  reg: false },
  multi:      { label: 'Multi-event',       bg: 8,  reg: false },
  tempo:      { label: 'Tempo / RV',        bg: 3,  reg: false },
  prekazky:   { label: 'Překážky',          bg: 5,  reg: false },
  dalka:      { label: 'Dálka',             bg: 7,  reg: false },
  vyska:      { label: 'Výška',             bg: 9,  reg: false },
  tyc:        { label: 'Tyč',               bg: 7,  reg: false },
  vrhy:       { label: 'Koule / disk',      bg: 6,  reg: false },
  ostep:      { label: 'Oštěp',             bg: 12, reg: false },
  stafeta:    { label: 'Štafeta',           bg: 11, reg: false },
  sila:       { label: 'Síla / gym',        bg: 10, reg: false },
  slabiny:    { label: 'Slabiny',           bg: 10, reg: false },
  zavod:      { label: 'Závod',             bg: 2,  reg: false },
  mobilita:   { label: 'Mobilita / rehab',  bg: 10, reg: true },
  regenerace: { label: 'Regenerace',        bg: 10, reg: true },
};

const u = (typ, nazev, detail, min) => ({ typ, nazev, detail, min });

/** Týdenní šablona: klíč = den v týdnu (1 = pondělí … 7 = neděle). */
export const DEFAULT_TEMPLATE = {
  1: [u('rychlost', 'Rychlost se sprintery', 'max rychlost · letmé úseky', 90)],
  2: [u('multi', 'Multi-event blok', 'technika + síla', 120)],
  3: [u('slabiny', 'Slabiny bez trenéra', 'jednonožní reaktivita L · kotník · bez náčiní', 60),
      u('regenerace', 'Regenerace', 'protažení · válec', 30)],
  4: [u('tyc', 'Tyč + gymnastika', 'rychlost · horní tělo', 120)],
  5: [u('tempo', 'Rychlostní vytrvalost', 'tempo', 90)],
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
