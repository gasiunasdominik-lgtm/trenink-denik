// Stav appky: data v paměti, trvale v IndexedDB, změny se řadí do outboxu pro sync se Sheetem.
import * as idb from './idb.js';
import { DEFAULT_SETTINGS, DEFAULT_DEVICE } from '../config.js';
import { nowIso } from '../lib/dates.js';

/** Kolekce ↔ list v Google Sheetu. */
export const SHEETS = {
  units:    { sheet: 'Jednotky', key: 'id' },
  wellness: { sheet: 'Wellness', key: 'datum' },
  weeks:    { sheet: 'Tydny',    key: 'tyden' },
  reports:  { sheet: 'Reporty',  key: 'id' },
  zavody:   { sheet: 'Zavody',   key: 'id' },
  testy:    { sheet: 'Testy',    key: 'id' },
  pb:       { sheet: 'PB_Plany', key: 'disciplina' },
  miry:     { sheet: 'Telesne_miry', key: 'datum' },
};

const mem = Object.fromEntries(Object.keys(SHEETS).map(k => [k, new Map()]));
let settings = structuredClone(DEFAULT_SETTINGS);
let device = { ...DEFAULT_DEVICE };
let settingsTs = '';
let outboxCount = 0;
const listeners = new Set();

export const subscribe = fn => (listeners.add(fn), () => listeners.delete(fn));
const emit = () => listeners.forEach(fn => fn());

export async function init() {
  for (const name of Object.keys(mem)) {
    (await idb.all(name)).forEach(r => mem[name].set(r[SHEETS[name].key], r));
  }
  const kv = Object.fromEntries((await idb.all('kv')).map(r => [r.k, r.v]));
  if (kv.settings) settings = mergeSettings(kv.settings);
  settingsTs = kv.settingsTs || '';
  if (kv.device) device = { ...DEFAULT_DEVICE, ...kv.device };
  outboxCount = (await idb.all('outbox')).length;
}

function mergeSettings(s) {
  const d = structuredClone(DEFAULT_SETTINGS);
  return { ...d, ...s, thresholds: { ...d.thresholds, ...s.thresholds }, checkinFields: { ...d.checkinFields, ...s.checkinFields }, modules: { ...d.modules, ...s.modules } };
}

// ---------- čtení ----------
export const units = () => [...mem.units.values()].filter(u => !u.smazano);
export const unitsOn = datum => units().filter(u => u.datum === datum).sort((a, b) => (a.poradi ?? 99) - (b.poradi ?? 99));
export const unit = id => mem.units.get(id);
export const wellness = datum => mem.wellness.get(datum);
export const wellnessAll = () => [...mem.wellness.values()];
export const week = tyden => mem.weeks.get(tyden);
export const reports = () => [...mem.reports.values()];
export const getSettings = () => settings;
export const getDevice = () => device;
export const pending = () => outboxCount;

// ---------- zápis ----------
async function write(coll, row) {
  row.ts = nowIso();
  mem[coll].set(row[SHEETS[coll].key], row);
  await idb.put(coll, row);
  await enqueue(SHEETS[coll].sheet, row);
  emit();
  return row;
}

export const saveUnit = u => write('units', u);
export const deleteUnit = id => { const u = mem.units.get(id); return u && write('units', { ...u, smazano: 1 }); };
export const saveWellness = w => write('wellness', w);
export const saveWeek = w => write('weeks', w);

// obecné kolekce (výkon): zavody, testy, pb, miry
export const rows = coll => [...mem[coll].values()].filter(r => !r.smazano);
export const row = (coll, key) => mem[coll].get(key);
export const saveRow = (coll, r) => write(coll, r);
export const deleteRow = (coll, key) => { const r = mem[coll].get(key); return r && write(coll, { ...r, smazano: 1 }); };

export async function saveSettings(patch) {
  settings = mergeSettings({ ...settings, ...patch });
  settingsTs = nowIso();
  await idb.put('kv', { k: 'settings', v: settings });
  await idb.put('kv', { k: 'settingsTs', v: settingsTs });
  await enqueue('Nastaveni', { klic: 'settings', hodnota: settings, ts: settingsTs });
  emit();
}

export async function saveDevice(patch) {
  device = { ...device, ...patch };
  await idb.put('kv', { k: 'device', v: device });
  emit();
}

// ---------- outbox ----------
async function enqueue(sheet, row) {
  await idb.put('outbox', { sheet, row: structuredClone(row) });
  outboxCount++;
}

export const outbox = () => idb.all('outbox');

export async function ack(seqs) {
  for (const s of seqs) await idb.del('outbox', s);
  outboxCount = Math.max(0, outboxCount - seqs.length);
  emit();
}

/** Data ze Sheetu: novější (podle ts) vyhrává. */
export async function applyRemote(data) {
  let changed = false;
  for (const [coll, { sheet, key }] of Object.entries(SHEETS)) {
    const fresh = (data[sheet] || []).filter(r => {
      const cur = mem[coll].get(r[key]);
      return !cur || (r.ts || '') > (cur.ts || '');
    });
    if (!fresh.length) continue;
    // PB a plány můžou psát appka i Cowork úloha (třeba jen PB z atletika.cz) – slučovat po polích, ne přepsat celý řádek
    const merge = coll === 'pb'
      ? r => ({ ...mem.pb.get(r[key]), ...Object.fromEntries(Object.entries(r).filter(([, v]) => v != null && v !== '')) })
      : r => r;
    fresh.forEach((r, i) => { fresh[i] = merge(r); mem[coll].set(r[key], fresh[i]); });
    await idb.putMany(coll, fresh);
    changed = true;
  }
  const remoteSettings = (data.Nastaveni || []).find(r => r.klic === 'settings');
  if (remoteSettings && (remoteSettings.ts || '') > settingsTs && remoteSettings.hodnota) {
    settings = mergeSettings(remoteSettings.hodnota);
    settingsTs = remoteSettings.ts;
    await idb.put('kv', { k: 'settings', v: settings });
    await idb.put('kv', { k: 'settingsTs', v: settingsTs });
    changed = true;
  }
  if (changed) emit();
}

export function exportAll() {
  return {
    exported: nowIso(),
    settings,
    Jednotky: units(),
    Wellness: wellnessAll(),
    Tydny: [...mem.weeks.values()],
    Reporty: reports(),
    Zavody: rows('zavody'),
    Testy: rows('testy'),
    PB_Plany: rows('pb'),
    Telesne_miry: rows('miry'),
  };
}
