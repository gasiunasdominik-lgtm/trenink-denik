/**
 * Trénink deník – backend nad Google Sheetem.
 * Nasazení: viz README.md (Rozšíření → Apps Script → vložit tento soubor → spustit setup → Nasadit jako webovou aplikaci).
 *
 * GET  ?action=ping&token=…              → { ok, name }
 * GET  ?action=pull&token=…&since=ISO    → { ok, now, sheets: { Jednotky: [...], ... } }  (řádky s ts > since)
 * GET  ?action=version&token=…           → { ok, version }
 * POST {"action":"push","token":…,"rows":[{sheet,row}]}  → upsert podle klíče, neznámé sloupce se doplní
 * POST {"action":"wellness","token":…,"rhr":48,"zacatek":"ISO
…","konec":"ISO
…","faze":"In Bed
Core…","zdroj":"Garmin Connect
…"}
 *      (starší varianta: "spanek" = délky + "faze")                     → ranní import z Apple Health,
 *      doplní jen prázdná pole dnešního check-inu (ruční zápis nepřepíše)
 */

const VERSION = 9; // zvyš při změně; appka upozorní, když běží starší nasazení

const SCHEMA = {
  Jednotky:     { key: 'id',         cols: ['id', 'datum', 'poradi', 'typ', 'nazev', 'detail', 'plan_min', 'min', 'rpe', 'srpe', 'obsah', 'poznamka', 'sprint_m', 'skoky', 'hody', 'prekazky', 'reg_min', 'zo', 'zn', 'zav', 'faze_dne', 'soustredeni', 'skip', 'smazano', 'ts'] },
  Wellness:     { key: 'datum',      cols: ['datum', 'cas', 'hrv', 'rhr', 'spanek_h', 'v_posteli_h', 'spanek_zdroj', 'spanek_q', 'unava', 'svaly', 'nalada', 'bolest', 'ts'] },
  Tydny:        { key: 'tyden',      cols: ['tyden', 'zhodnoceni', 'ts'] },
  Reporty:      { key: 'id',         cols: ['id', 'tyden', 'typ', 'datum', 'titulek', 'text', 'ts'] },
  Nastaveni:    { key: 'klic',       cols: ['klic', 'hodnota', 'ts'] },
  // fáze 2 – listy se založí už teď
  Zavody:       { key: 'id',         cols: ['id', 'datum', 'zavod', 'misto', 'disciplina', 'vykon', 'vykon_txt', 'vitr', 'rucne', 'poradi', 'body', 'poznamka', 'smazano', 'ts'] },
  Testy:        { key: 'id',         cols: ['id', 'datum', 'test', 'kategorie', 'hodnota', 'jednotka', 'poznamka', 'smazano', 'ts'] },
  PB_Plany:     { key: 'disciplina', cols: ['disciplina', 'pb', 'pb_datum', 'plan_letos', 'vykon_letos', 'plan_pristi', 'rekord_cr', 'rekord_cr_drzitel', 'rekord_sr', 'rekord_sr_drzitel', 'pb_zavod', 'pb_venku', 'pb_venku_datum', 'pb_hala', 'pb_hala_datum',
    'rekord_cr_u20', 'rekord_cr_u20_drzitel', 'rekord_sr_u20', 'rekord_sr_u20_drzitel', 'rekord_cr_u23', 'rekord_cr_u23_drzitel', 'ts'] },
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
        const sh = sheet_(ss, name);
        stamp_(sh, name, now); // řádky zapsané ručně / Claudem bez id nebo ts dostanou obojí
        const rows = read_(sh);
        // Reporty: posílají se vždy celé (je jich málo a Claude je může přepsat se starým ts)
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

// ---------- iOS zkratka „Ranní data ze Zdraví“ ----------

function today_() { return Utilities.formatDate(new Date(), 'Europe/Prague', 'yyyy-MM-dd'); }

function num_(v) {
  if (v === null || v === undefined || v === '') return null;
  // první číslo v textu – zkratka může poslat celý vzorek („48 count/min · Garmin · 18. 10.“)
  const m = String(v).match(/-?\d+(?:[.,]\d+)?/);
  return m ? Number(m[0].replace(',', '.')) : null;
}

// Jedna délka: h:mm:ss | mm:ss (v seznamu) / h:mm (samotná hodnota) | „1 h 23 min 5 s“ | „23 min“ | „45 s“ | číslo bez jednotky
const DUR_RE_ = new RegExp([
  '(\\d+):(\\d{2}):(\\d{2})',
  '(\\d+):(\\d{2})',
  '(\\d+(?:[.,]\\d+)?)\\s*(?:h|hod[a-zá]*|hr|hrs|hours?)\\b(?:\\s*(\\d+(?:[.,]\\d+)?)\\s*(?:min[a-z]*|m)\\b)?(?:\\s*(\\d+)\\s*(?:s|sek[a-z]*|sec[a-z]*)\\b)?',
  '(\\d+(?:[.,]\\d+)?)\\s*(?:min[a-z]*|m)\\b(?:\\s*(\\d+)\\s*(?:s|sek[a-z]*|sec[a-z]*)\\b)?',
  '(\\d+(?:[.,]\\d+)?)\\s*(?:s|sek[a-z]*|sec[a-z]*)\\b',
  '(\\d+(?:[.,]\\d+)?)',
].join('|'), 'gi');

/** Text se seznamem délek (řádky, mezery, středníky) → pole délek v hodinách, nebo null. */
function durations_(v) {
  if (v === null || v === undefined || v === '') return null;
  // tisíce oddělené mezerou jen před jednotkou („12 600 s“), jinak by se slily sousední položky
  const t = String(v).replace(/(\d)[\s ](?=\d{3}\s*(?:s\b|sek|sec|min))/g, '$1');
  const f = x => (x === undefined ? 0 : Number(String(x).replace(',', '.')));
  const items = [];
  let m;
  DUR_RE_.lastIndex = 0;
  while ((m = DUR_RE_.exec(t))) items.push(m);
  if (!items.length) return null;
  const list = items.length > 1;
  const plainOnly = items.every(x => x[12] !== undefined);
  const plainSum = items.reduce((a, x) => a + f(x[12]), 0);
  // čísla bez jednotek: podle velikosti součtu sekundy / minuty / hodiny
  const plainDiv = plainSum > 1000 ? 3600 : plainSum > 24 ? 60 : 1;
  return items.map(x => {
    if (x[1] !== undefined) return f(x[1]) + f(x[2]) / 60 + f(x[3]) / 3600;
    if (x[4] !== undefined) return list ? f(x[4]) / 60 + f(x[5]) / 3600 : f(x[4]) + f(x[5]) / 60; // iOS: pod hodinu „12:59“ = mm:ss
    if (x[6] !== undefined) return f(x[6]) + f(x[7]) / 60 + f(x[8]) / 3600;
    if (x[9] !== undefined) return f(x[9]) / 60 + f(x[10]) / 3600;
    if (x[11] !== undefined) return f(x[11]) / 3600;
    return f(x[12]) / (plainOnly ? plainDiv : 3600);
  });
}

const PHASE_RE_ = /in\s*bed|v\s*posteli|na\s*l[uů]žku|awake|vzh[uů]ru|bd[eě]n[ií]|core|j[aá]dro|deep|hlubok[a-zýáé]*|rem|asleep|unspecified|nespecifik[a-zé]*|lehk[a-zýé]*|light|sp[aá]nek/gi;
const phaseKind_ = p => (/in\s*bed|posteli|l[uů]žku/i.test(p) ? 'inbed' : /awake|vzh[uů]ru|bd[eě]n/i.test(p) ? 'awake' : 'asleep');
const h1_ = x => Math.round(x * 10) / 10;
const czh_ = x => String(h1_(x)).replace('.', ',') + ' h';

/**
 * Spánek ze vzorků Zdraví → { h, detail }.
 * Garmin zapisuje fáze (jádro, hluboký, REM, vzhůru) a navíc blok „V posteli“, který je překrývá.
 * - S polem `faze` (hodnoty vzorků ve stejném pořadí): sečtou se fáze spánku, V posteli a Vzhůru se vynechají.
 * - Bez něj: položka ≥ součtu ostatních = blok V posteli.
 * Když fáze pokrývají méně než 85 % bloku (Garmin někdy nepošle všechny), bere se blok.
 */
function sleep_(spanek, faze) {
  const d = durations_(spanek);
  if (!d) return null;
  const sum = a => a.reduce((s, x) => s + x, 0);
  let h, detail;
  const labels = faze ? (String(faze).match(PHASE_RE_) || []) : [];
  if (labels.length && labels.length === d.length) {
    const by = { inbed: 0, awake: 0, asleep: 0 };
    labels.forEach((p, i) => { by[phaseKind_(p)] += d[i]; });
    if (by.inbed && by.asleep < 0.85 * (by.inbed - by.awake)) {
      h = by.inbed - by.awake;
      detail = 'v posteli ' + czh_(by.inbed) + ', fáze neúplné (' + czh_(by.asleep) + ')';
    } else {
      h = by.asleep;
      detail = 'fáze spánku' + (by.awake ? ', bez ' + czh_(by.awake) + ' vzhůru' : '');
    }
  } else {
    const max = Math.max.apply(null, d), rest = sum(d) - max;
    if (d.length > 1 && max >= rest) {
      if (rest >= 0.85 * max) { h = rest; detail = 'fáze ' + czh_(rest) + ', blok v posteli vynechán'; }
      else { h = max; detail = 'blok v posteli ' + czh_(max) + ', fáze neúplné (' + czh_(rest) + ')'; }
    } else {
      h = sum(d);
      detail = d.length > 1 ? 'součet ' + d.length + ' úseků' : '';
    }
    if (faze && labels.length !== d.length) detail += (detail ? ', ' : '') + 'počet fází nesedí (' + labels.length + '/' + d.length + ')';
  }
  return h > 0 && h < 16 ? { h: h1_(h), detail: detail } : null;
}

function withLock_(fn) {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try { return fn(); } finally { lock.releaseLock(); }
}

// ---------- spánek z intervalů (zkratka posílá začátek, konec, fázi a zdroj každého vzorku) ----------

const lines_ = v => (v === null || v === undefined ? [] : String(v).split(/\r?\n/).map(s => s.trim()).filter(Boolean));

/** ISO 8601 („2026-10-19T07:12:00+02:00“) nebo český zápis („19. 10. 2026 v 7:12“, „19.10.26 7:12“) → Date. */
function parseWhen_(s) {
  if (/^\d{4}-\d{2}-\d{2}T/.test(s)) { const d = new Date(s); return isNaN(d) ? null : d; }
  const m = s.match(/(\d{1,2})\.\s*(\d{1,2})\.\s*(\d{2,4})\D+(\d{1,2}):(\d{2})(?::(\d{2}))?/);
  if (!m) return null;
  const p = n => ('0' + n).slice(-2);
  const y = m[3].length === 2 ? '20' + m[3] : m[3]; // krátký formát data („19.10.26 7:12“)
  return Utilities.parseDate(y + '-' + p(m[2]) + '-' + p(m[1]) + ' ' + p(m[4]) + ':' + m[5] + ':' + (m[6] || '00'), 'Europe/Prague', 'yyyy-MM-dd HH:mm:ss');
}

/** Délka sjednocení intervalů v hodinách (překryvy a duplicity se nepočítají dvakrát). */
function unionHours_(iv) {
  const s = iv.slice().sort((a, b) => a[0] - b[0]);
  let total = 0, cs = null, ce = null;
  s.forEach(([a, b]) => {
    if (ce === null || a > ce) { if (ce !== null) total += ce - cs; cs = a; ce = b; }
    else if (b > ce) ce = b;
  });
  if (ce !== null) total += ce - cs;
  return total / 36e5;
}

const hm_ = d => Utilities.formatDate(d, 'Europe/Prague', 'H:mm');

/**
 * Poslední noc z paralelních seznamů zacatek/konec/faze/zdroj (jeden řádek = jeden vzorek).
 * Okno: od 18:00 předchozího dne do teď. Jeden zdroj: Garmin, jinak ten s nejvíc spánkem.
 * Spánek = sjednocení fází Asleep/Core/Deep/REM. V posteli = sjednocení In Bed, jinak první–poslední vzorek.
 */
function sleepNight_(b, now) {
  const zs = lines_(b.zacatek), ks = lines_(b.konec), fs = lines_(b.faze), src = lines_(b.zdroj);
  if (!zs.length) return null;
  if (zs.length !== ks.length || zs.length !== fs.length) return { error: 'seznamy mají různou délku (začátky ' + zs.length + ', konce ' + ks.length + ', fáze ' + fs.length + ')' };
  now = now || new Date();
  const hh = Number(Utilities.formatDate(now, 'Europe/Prague', 'H')), mm = Number(Utilities.formatDate(now, 'Europe/Prague', 'm'));
  const sinceMidnight = (hh * 60 + mm) * 6e4;
  const winStart = new Date(now.getTime() - sinceMidnight - (hh >= 18 ? -18 : 6) * 36e5);

  const samples = [];
  for (let i = 0; i < zs.length; i++) {
    const a = parseWhen_(zs[i]), e = parseWhen_(ks[i]);
    if (!a || !e) return { error: 'nečitelné datum „' + (a ? ks[i] : zs[i]).slice(0, 40) + '“ – v poli zacatek/konec nastav formát data ISO 8601' };
    if (e <= winStart || a >= now) continue;
    samples.push({ a: Math.max(a.getTime(), winStart.getTime()), e: Math.min(e.getTime(), now.getTime()), kind: phaseKind_(fs[i]), src: src[i] || '?' });
  }
  if (!samples.length) return { error: 'žádný spánek od 18:00 včerejška' };

  const bySrc = {};
  samples.forEach(s => { (bySrc[s.src] = bySrc[s.src] || []).push(s); });
  const asleepOf = list => unionHours_(list.filter(s => s.kind === 'asleep').map(s => [s.a, s.e]));
  const names = Object.keys(bySrc);
  const source = names.find(n => /garmin/i.test(n) && asleepOf(bySrc[n]) > 0)
    || names.sort((x, y) => asleepOf(bySrc[y]) - asleepOf(bySrc[x]))[0];
  const own = bySrc[source];

  let sleep = asleepOf(own);
  const bedIv = own.filter(s => s.kind === 'inbed').map(s => [s.a, s.e]);
  const first = Math.min.apply(null, own.map(s => s.a)), last = Math.max.apply(null, own.map(s => s.e));
  let bed = bedIv.length ? unionHours_(bedIv) : (last - first) / 36e5;
  if (!sleep && bedIv.length) sleep = bed - unionHours_(own.filter(s => s.kind === 'awake').map(s => [s.a, s.e])); // zdroj bez fází
  bed = Math.max(bed, sleep);
  if (!(sleep > 0 && sleep < 16)) return { error: 'spánek mimo rozsah (' + czh_(sleep) + ')' };
  return {
    h: h1_(sleep), bed: h1_(bed),
    detail: source + ', ' + hm_(new Date(first)) + '–' + hm_(new Date(last)) + ', v posteli ' + czh_(bed) + (names.length > 1 ? ', ostatní zdroje vynechány' : ''),
  };
}

function importWellness_(b) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const datum = b.datum || today_();
  const cur = read_(sheet_(ss, 'Wellness')).find(r => String(r.datum) === datum) || { datum: datum };
  // nový formát (intervaly) má přednost, starý (součet délek) zůstává jako záloha
  const sl = b.zacatek !== undefined ? sleepNight_(b) : sleep_(b.spanek, b.faze);
  const ok = sl && !sl.error;
  const incoming = { spanek_h: ok ? sl.h : null, rhr: num_(b.rhr), hrv: num_(b.hrv) };
  const filled = [];
  // spánek z dřívějšího importu (nebo zjevně chybný > 13 h) se smí přepsat, ruční zápis z check-inu ne
  const sleepReplaceable = cur.spanek_zdroj === 'zdravi' || num_(cur.spanek_h) > 13;
  Object.keys(incoming).forEach(k => {
    const empty = cur[k] === '' || cur[k] === undefined || cur[k] === null;
    const replace = k === 'spanek_h' && sleepReplaceable && incoming[k] !== num_(cur[k]);
    if (incoming[k] !== null && (empty || replace)) { cur[k] = incoming[k]; filled.push(k); }
  });
  if (filled.indexOf('spanek_h') >= 0) { cur.spanek_zdroj = 'zdravi'; if (sl.bed) cur.v_posteli_h = sl.bed; }
  // diagnostika pro oznámení ve zkratce: co přišlo a proč se něco nezapsalo
  const notes = [];
  if (incoming.spanek_h === null) {
    const raw = String(b.zacatek !== undefined ? b.zacatek : b.spanek === undefined ? '' : b.spanek).trim().replace(/\s*\n\s*/g, ' | ').replace(/\s+/g, ' ');
    notes.push(sl && sl.error ? 'spánek: ' + sl.error
      : raw ? 'spánek nečitelný (přišlo: „' + raw.slice(0, 60) + '“)' : 'spánek nepřišel – ve zkratce chybí akce Najít vzorky se spánkem');
  } else if (filled.indexOf('spanek_h') < 0) notes.push('spánek už zapsaný ručně (' + cur.spanek_h + ' h; ze Zdraví by bylo ' + czh_(sl.h) + ')');
  if (incoming.rhr === null) notes.push('tep nepřišel');
  else if (filled.indexOf('rhr') < 0) notes.push('tep už zapsaný (' + cur.rhr + ')');

  if (filled.length) {
    cur.ts = new Date().toISOString();
    upsert_(sheet_(ss, 'Wellness'), 'datum', [cur]);
  }
  const done = filled.map(k => ({ spanek_h: 'spánek ' + czh_(cur.spanek_h) + (sl.detail ? ' (' + sl.detail + ')' : ''), rhr: 'tep ' + cur.rhr, hrv: 'HRV ' + cur.hrv })[k]);
  return { text: (done.length ? 'Zapsáno: ' + done.join(', ') : 'Nic nového') + (notes.length ? ' · ' + notes.join(' · ') : '') };
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

/**
 * Doplní chybějící klíč a ts u řádků, které nezapsala appka (ruční úprava v Sheetu, Cowork úloha).
 * Bez ts by je appka při synchronizaci nikdy nestáhla.
 */
function stamp_(sh, name, now) {
  const values = sh.getDataRange().getValues();
  if (values.length < 2) return;
  const head = values[0].map(String);
  const ti = head.indexOf('ts'), key = SCHEMA[name].key, ki = head.indexOf(key);
  if (ti < 0 || ki < 0) return;
  const gen = { Zavody: 'z-', Testy: 't-', Jednotky: 'x-' }[name];
  for (let r = 1; r < values.length; r++) {
    const row = values[r];
    if (!row.some(v => v !== '')) continue;
    if (row[ki] === '') {
      let k = name === 'Reporty' ? String(row[head.indexOf('tyden')] || '') : gen ? gen + Utilities.getUuid().slice(0, 8) : '';
      if (name === 'Jednotky' && k) k = String(row[head.indexOf('datum')] || '') + '-' + k;
      if (k) sh.getRange(r + 1, ki + 1).setValue(k);
    }
    if (row[ti] === '') sh.getRange(r + 1, ti + 1).setValue(now);
  }
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
