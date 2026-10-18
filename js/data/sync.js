// Synchronizace s Google Sheetem přes Apps Script web app.
// Push: outbox → doPost. Pull: doGet se změnami od posledního pullu. Konflikty: novější ts vyhrává.
import * as store from './store.js';
import { normalizeRow } from './normalize.js';

const JSON_FIELDS = ['bolest', 'hodnota'];
const BATCH = 40;

let state = { status: 'idle', error: '', last: '' };
const listeners = new Set();
export const onStatus = fn => (listeners.add(fn), () => listeners.delete(fn));
export const status = () => ({ ...state, pending: store.pending() });
const set = patch => { state = { ...state, ...patch }; listeners.forEach(fn => fn(status())); };

const encode = row => Object.fromEntries(Object.entries(row).map(([k, v]) =>
  [k, JSON_FIELDS.includes(k) && v && typeof v === 'object' ? JSON.stringify(v) : v]));

// Sheet má vše jako text – čísla vracíme na čísla (kromě klíčů a textových polí).
const TEXT_FIELDS = ['id', 'datum', 'tyden', 'klic', 'cas', 'ts', 'nazev', 'detail', 'poznamka', 'text', 'titulek', 'zhodnoceni', 'typ',
  'zavod', 'misto', 'disciplina', 'vykon_txt', 'test', 'kategorie', 'jednotka', 'pb_datum',
  'rekord_cr_drzitel', 'rekord_sr_drzitel', 'spanek_zdroj', 'obsah',
  'pb_zavod', 'pb_venku_datum', 'pb_hala_datum', 'rekord_cr_u20_drzitel', 'rekord_sr_u20_drzitel', 'rekord_cr_u23_drzitel', 'typ', 'faze_dne', 'soustredeni'];
const decode = row => Object.fromEntries(Object.entries(row).map(([k, v]) => {
  if (JSON_FIELDS.includes(k) && typeof v === 'string' && v.startsWith('{')) {
    try { return [k, JSON.parse(v)]; } catch { /* necháme text */ }
  }
  if (v === '') return [k, null];
  if (typeof v === 'string' && !TEXT_FIELDS.includes(k) && /^-?\d+([.,]\d+)?$/.test(v)) return [k, Number(v.replace(',', '.'))];
  return [k, v];
}));

function configured() {
  const { apiUrl, token } = store.getDevice();
  return apiUrl && token ? { apiUrl, token } : null;
}

async function call(cfg, method, payload) {
  const url = new URL(cfg.apiUrl);
  let res;
  if (method === 'GET') {
    Object.entries({ ...payload, token: cfg.token }).forEach(([k, v]) => url.searchParams.set(k, v));
    res = await fetch(url, { cache: 'no-store' });
  } else {
    // text/plain = bez CORS preflightu, který Apps Script neumí
    res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ ...payload, token: cfg.token }) });
  }
  const data = await res.json();
  if (!data.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

async function push(cfg) {
  const items = await store.outbox();
  for (let i = 0; i < items.length; i += BATCH) {
    const chunk = items.slice(i, i + BATCH);
    await call(cfg, 'POST', { action: 'push', rows: chunk.map(it => ({ sheet: it.sheet, row: encode(it.row) })) });
    await store.ack(chunk.map(it => it.seq));
  }
}

async function pull(cfg) {
  const { lastPull, serverVersion } = store.getDevice();
  let data = await call(cfg, 'GET', { action: 'pull', since: lastPull || '' });
  // novější skript posílá i další listy → jednou stáhnout všechno od začátku
  if (lastPull && (data.version || 1) > (serverVersion || 1)) data = await call(cfg, 'GET', { action: 'pull', since: '' });
  const decoded = Object.fromEntries(Object.entries(data.sheets).map(([s, rows]) => [s, rows.map(r => normalizeRow(s, decode(r)))]));
  // řádky reportu bez id/ts (zapsané Claudem) – klíčem je týden, ts ať nepřebije nic novějšího
  (decoded.Reporty || []).forEach(r => { r.id ??= r.tyden || r.datum; r.ts ??= r.datum || ''; });
  await store.applyRemote(decoded);
  await store.saveDevice({ lastPull: data.now, serverVersion: data.version || 1 });
}

let running = null;
export function syncNow() {
  const cfg = configured();
  if (!cfg) { set({ status: 'unconfigured' }); return Promise.resolve(); }
  if (!navigator.onLine) { set({ status: 'offline' }); return Promise.resolve(); }
  running ??= (async () => {
    set({ status: 'syncing', error: '' });
    try {
      await push(cfg);
      await pull(cfg);
      set({ status: 'idle', last: new Date().toISOString() });
    } catch (e) {
      set({ status: 'error', error: e.message });
    } finally {
      running = null;
    }
  })();
  return running;
}

export async function test(apiUrl, token) {
  return call({ apiUrl, token }, 'GET', { action: 'ping' });
}

let timer;
const soon = () => { clearTimeout(timer); timer = setTimeout(syncNow, 1500); };

export function start() {
  store.subscribe(() => { if (store.pending()) soon(); });
  addEventListener('online', syncNow);
  addEventListener('offline', () => set({ status: 'offline' }));
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') syncNow(); });
  syncNow();
}
