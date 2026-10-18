/**
 * Trénink deník – backend nad Google Sheetem.
 * Nasazení: viz README.md (Rozšíření → Apps Script → vložit tento soubor → spustit setup → Nasadit jako webovou aplikaci).
 *
 * GET  ?action=ping&token=…              → { ok, name }
 * GET  ?action=pull&token=…&since=ISO    → { ok, now, sheets: { Jednotky: [...], ... } }  (řádky s ts > since)
 * GET  ?action=version&token=…           → { ok, version }
 * POST {"action":"push","token":…,"rows":[{sheet,row}]}  → upsert podle klíče, neznámé sloupce se doplní
 * POST {"action":"log","token":…,"nazev":"tyč technika","min":90,"rpe":7}            → jednotka navíc (iOS zkratka / Siri)
 * POST {"action":"wellness","token":…,"spanek":"7,5","rhr":48}                       → ranní import z Apple Health,
 *      doplní jen prázdná pole dnešního check-inu (ruční zápis nepřepíše)
 */

const VERSION = 3; // zvyš při změně; appka upozorní, když běží starší nasazení

const SCHEMA = {
  Jednotky:     { key: 'id',         cols: ['id', 'datum', 'poradi', 'typ', 'nazev', 'detail', 'plan_min', 'min', 'rpe', 'srpe', 'poznamka', 'sprint_m', 'skoky', 'hody', 'prekazky', 'reg_min', 'zo', 'zn', 'zav', 'skip', 'smazano', 'ts'] },
  Wellness:     { key: 'datum',      cols: ['datum', 'cas', 'hrv', 'rhr', 'spanek_h', 'spanek_q', 'unava', 'svaly', 'nalada', 'bolest', 'ts'] },
  Tydny:        { key: 'tyden',      cols: ['tyden', 'zhodnoceni', 'ts'] },
  Reporty:      { key: 'id',         cols: ['id', 'tyden', 'datum', 'titulek', 'text', 'ts'] },
  Nastaveni:    { key: 'klic',       cols: ['klic', 'hodnota', 'ts'] },
  // fáze 2 – listy se založí už teď
  Zavody:       { key: 'id',         cols: ['id', 'datum', 'zavod', 'misto', 'disciplina', 'vykon', 'vykon_txt', 'vitr', 'rucne', 'poradi', 'body', 'poznamka', 'smazano', 'ts'] },
  Testy:        { key: 'id',         cols: ['id', 'datum', 'test', 'kategorie', 'hodnota', 'jednotka', 'poznamka', 'smazano', 'ts'] },
  PB_Plany:     { key: 'disciplina', cols: ['disciplina', 'pb', 'pb_datum', 'plan_letos', 'vykon_letos', 'plan_pristi', 'rekord_cr', 'rekord_sr', 'ts'] },
  Telesne_miry: { key: 'datum',      cols: ['datum', 'vaha', 'vyska', 'tuk_pct', 'rhr', 'ts'] },
};

const PULL_SHEETS = ['Jednotky', 'Wellness', 'Tydny', 'Reporty', 'Nastaveni', 'Zavody', 'Testy', 'PB_Plany', 'Telesne_miry'];

/** Spusť jednou ručně: založí listy a vygeneruje token (najdeš ho v protokolu provádění). */
function setup() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  Object.keys(SCHEMA).forEach(name => sheet_(ss, name));
  const props = PropertiesService.getScriptProperties();
  let token = props.getProperty('TOKEN');
  if (!token) {
    token = Utilities.getUuid().replace(/-/g, '');
    props.setProperty('TOKEN', token);
  }
  Logger.log('TOKEN: ' + token);
}

function doGet(e) {
  return handle_(() => {
    auth_(e.parameter.token);
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    if (e.parameter.action === 'ping') return { name: ss.getName(), version: VERSION };
    if (e.parameter.action === 'version') return { version: VERSION };
    if (e.parameter.action === 'pull') {
      const since = e.parameter.since || '';
      const now = new Date().toISOString();
      const sheets = {};
      PULL_SHEETS.forEach(name => {
        const rows = read_(sheet_(ss, name));
        // Reporty píše Claude ručně a nemusí vyplnit ts – posílají se vždy celé (je jich málo)
        sheets[name] = name === 'Reporty' ? rows : rows.filter(r => String(r.ts || '') > since);
      });
      return { now, sheets, version: VERSION };
    }
    throw new Error('Neznámá akce');
  });
}

function doPost(e) {
  return handle_(() => {
    const body = JSON.parse(e.postData.contents);
    auth_(body.token);
    if (body.action === 'log') return withLock_(() => logUnit_(body));
    if (body.action === 'wellness') return withLock_(() => importWellness_(body));
    if (body.action !== 'push') throw new Error('Neznámá akce');
    const lock = LockService.getScriptLock();
    lock.waitLock(20000);
    try {
      const ss = SpreadsheetApp.getActiveSpreadsheet();
      const bySheet = {};
      (body.rows || []).forEach(it => { (bySheet[it.sheet] = bySheet[it.sheet] || []).push(it.row); });
      Object.keys(bySheet).forEach(name => {
        if (!SCHEMA[name]) throw new Error('Neznámý list ' + name);
        upsert_(sheet_(ss, name), SCHEMA[name].key, bySheet[name]);
      });
      return { saved: (body.rows || []).length };
    } finally {
      lock.releaseLock();
    }
  });
}

// ---------- iOS zkratky ----------

const TYPE_WORDS_ = [
  ['regenerace', /regener|protah|mobil|sauna|mas[aá]ž|v[aá]lec/i],
  ['prekazky', /p[rř]ek[aá]ž/i], ['tyc', /ty[cč]/i], ['vyska', /v[yý][sš]k/i], ['dalka', /d[aá]lk/i],
  ['ostep', /o[sš]t[eě]p/i], ['vrhy', /koul|disk|vrh/i], ['rychlost', /rychl|sprint|letm/i],
  ['tempo', /tempo|vytrval|[uú]sek/i], ['multi', /multi|v[ií]ceboj|desetiboj/i], ['zavod', /z[aá]vod|m[ií]tink/i],
  ['sila', /s[ií]l|posil|gym|činky|cinky/i],
];

function today_() { return Utilities.formatDate(new Date(), 'Europe/Prague', 'yyyy-MM-dd'); }

function num_(v) {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(String(v).replace(',', '.').replace(/[^\d.\-]/g, ''));
  return isFinite(n) ? n : null;
}

/** Spánek v libovolné podobě → hodiny: 7,5 · "7:30" · 450 (min) · 27000 (s) · "7 h 30 min". */
function hours_(v) {
  if (v === null || v === undefined || v === '') return null;
  const t = String(v);
  const hm = t.match(/(\d+)\s*(?:h|hod)[^\d]*(\d+)?/i) || t.match(/^(\d+):(\d{2})/);
  if (hm) return Math.round((Number(hm[1]) + Number(hm[2] || 0) / 60) * 100) / 100;
  const n = num_(t);
  if (n === null) return null;
  const h = n > 1000 ? n / 3600 : n > 24 ? n / 60 : n;
  return Math.round(h * 100) / 100;
}

function withLock_(fn) {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try { return fn(); } finally { lock.releaseLock(); }
}

function logUnit_(b) {
  const nazev = String(b.nazev || '').trim();
  if (!nazev) throw new Error('Chybí název tréninku');
  const min = num_(b.min), rpe = num_(b.rpe);
  const hit = TYPE_WORDS_.find(([, re]) => re.test(nazev));
  const datum = today_();
  const row = {
    id: datum + '-s' + Date.now().toString(36), datum, poradi: 200,
    typ: b.typ || (hit ? hit[0] : 'sila'),
    nazev: nazev.charAt(0).toUpperCase() + nazev.slice(1),
    min, rpe, srpe: min !== null && rpe !== null ? min * rpe : null,
    poznamka: b.poznamka ? String(b.poznamka) : 'Siri',
    ts: new Date().toISOString(),
  };
  upsert_(sheet_(SpreadsheetApp.getActiveSpreadsheet(), 'Jednotky'), 'id', [row]);
  return { text: 'Zapsáno: ' + row.nazev + (min !== null ? ', ' + min + ' min' : '') + (rpe !== null ? ', RPE ' + rpe : '') };
}

function importWellness_(b) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const datum = b.datum || today_();
  const cur = read_(sheet_(ss, 'Wellness')).find(r => String(r.datum) === datum) || { datum: datum };
  const incoming = { spanek_h: hours_(b.spanek), rhr: num_(b.rhr), hrv: num_(b.hrv) };
  const filled = [];
  Object.keys(incoming).forEach(k => {
    if (incoming[k] !== null && (cur[k] === '' || cur[k] === undefined || cur[k] === null)) { cur[k] = incoming[k]; filled.push(k); }
  });
  if (!filled.length) return { text: 'Nic nového – dnešní hodnoty už jsou zapsané nebo nedorazila data ze Zdraví.' };
  cur.ts = new Date().toISOString();
  upsert_(sheet_(ss, 'Wellness'), 'datum', [cur]);
  return { text: 'Ze Zdraví: ' + filled.map(k => ({ spanek_h: 'spánek ' + cur.spanek_h + ' h', rhr: 'tep ' + cur.rhr, hrv: 'HRV ' + cur.hrv })[k]).join(', ') };
}

// ---------- interní ----------

function handle_(fn) {
  let out;
  try { out = Object.assign({ ok: true }, fn()); } catch (err) { out = { ok: false, error: String(err.message || err) }; }
  return ContentService.createTextOutput(JSON.stringify(out)).setMimeType(ContentService.MimeType.JSON);
}

function auth_(token) {
  const expected = PropertiesService.getScriptProperties().getProperty('TOKEN');
  if (!expected || token !== expected) throw new Error('Špatný token');
}

function sheet_(ss, name) {
  let sh = ss.getSheetByName(name);
  if (!sh) {
    sh = ss.insertSheet(name);
    const cols = SCHEMA[name].cols;
    sh.getRange(1, 1, 1, cols.length).setValues([cols]).setFontWeight('bold');
    sh.setFrozenRows(1);
    // vše jako text, ať Sheets nepřevádí data a časy na své typy
    sh.getRange(1, 1, sh.getMaxRows(), Math.max(sh.getMaxColumns(), cols.length)).setNumberFormat('@');
  }
  return sh;
}

function headers_(sh) {
  const last = sh.getLastColumn();
  return last ? sh.getRange(1, 1, 1, last).getValues()[0].map(String) : [];
}

function read_(sh) {
  const values = sh.getDataRange().getValues();
  const head = values.shift() || [];
  return values.filter(r => r.some(v => v !== '')).map(r => {
    const o = {};
    head.forEach((h, i) => { o[h] = r[i] instanceof Date ? Utilities.formatDate(r[i], 'Europe/Prague', 'yyyy-MM-dd') : r[i]; });
    return o;
  });
}

function upsert_(sh, key, incoming) {
  // v jedné dávce může být víc verzí téhož záznamu – nechat jen nejnovější
  const latest = {};
  incoming.forEach(r => { const k = String(r[key]); if (!latest[k] || String(r.ts) >= String(latest[k].ts)) latest[k] = r; });
  const rows = Object.keys(latest).map(k => latest[k]);
  let head = headers_(sh);
  // doplnit sloupce, které appka posílá a list ještě nemá
  const missing = [];
  rows.forEach(r => Object.keys(r).forEach(k => { if (head.indexOf(k) < 0 && missing.indexOf(k) < 0) missing.push(k); }));
  if (missing.length) {
    sh.getRange(1, head.length + 1, 1, missing.length).setValues([missing]).setFontWeight('bold');
    head = head.concat(missing);
  }
  const keyCol = head.indexOf(key);
  const lastRow = sh.getLastRow();
  const keys = lastRow > 1 ? sh.getRange(2, keyCol + 1, lastRow - 1, 1).getValues().map(r => String(r[0])) : [];
  const index = {};
  keys.forEach((k, i) => { index[k] = i + 2; });

  const appends = [];
  rows.forEach(r => {
    const line = head.map(h => (r[h] === null || r[h] === undefined ? '' : r[h]));
    const at = index[String(r[key])];
    if (at) {
      const existing = sh.getRange(at, 1, 1, head.length).getValues()[0];
      const curTs = existing[head.indexOf('ts')];
      if (String(curTs) > String(r.ts || '')) {
        // v Sheetu je novější verze (např. ranní import): nepřepisovat, jen doplnit prázdná pole
        const merged = existing.map((v, i) => (v === '' && line[i] !== '' ? line[i] : v));
        if (merged.some((v, i) => v !== existing[i])) sh.getRange(at, 1, 1, head.length).setValues([merged]);
        return;
      }
      sh.getRange(at, 1, 1, head.length).setValues([line]);
    } else {
      appends.push(line);
    }
  });
  if (appends.length) {
    const start = sh.getLastRow() + 1;
    sh.getRange(start, 1, appends.length, head.length).setNumberFormat('@').setValues(appends);
  }
}
