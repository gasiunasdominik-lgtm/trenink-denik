/**
 * Trénink deník – backend nad Google Sheetem.
 * Nasazení: viz README.md (Rozšíření → Apps Script → vložit tento soubor → spustit setup → Nasadit jako webovou aplikaci).
 *
 * GET  ?action=ping&token=…              → { ok, name }
 * GET  ?action=pull&token=…&since=ISO    → { ok, now, sheets: { Jednotky: [...], ... } }  (řádky s ts > since)
 * GET  ?action=version&token=…           → { ok, version }
 * POST {"action":"push","token":…,"rows":[{sheet,row}]}  → upsert podle klíče, neznámé sloupce se doplní
 */

const VERSION = 2; // zvyš při změně; appka upozorní, když běží starší nasazení

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
      const cur = sh.getRange(at, head.indexOf('ts') + 1).getValue();
      if (String(cur) > String(r.ts || '')) return; // v Sheetu je novější verze
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
