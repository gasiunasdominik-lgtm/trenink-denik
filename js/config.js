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
  sheetUrl: '',
};

/** Lokální nastavení zařízení – nesynchronizuje se do Sheetu. */
export const DEFAULT_DEVICE = { apiUrl: '', token: '', lastPull: '' };
