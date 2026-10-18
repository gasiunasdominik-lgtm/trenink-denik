// NASTAVENÍ: sync, check-in pole, týdenní šablona, partie, prahy, pozadí, export.
// Pohled se po uložení nepřekresluje celý (ztratil by se fokus) – změny se ukládají při opuštění pole.
import { h, fmt } from '../ui/dom.js';
import * as store from '../data/store.js';
import * as sync from '../data/sync.js';
import { TYPES, CHECKIN_FIELDS, DEFAULT_TEMPLATE, DEFAULT_DAILY } from '../config.js';
import { VARIANT_NAMES } from '../ui/track-bg.js';
import { tap } from '../ui/haptics.js';

const DAYS = ['', 'Pondělí', 'Úterý', 'Středa', 'Čtvrtek', 'Pátek', 'Sobota', 'Neděle'];

export function renderSettings() {
  const s = structuredClone(store.getSettings());
  const dev = store.getDevice();
  const save = patch => store.saveSettings(patch);

  // ---------- sync ----------
  const url = h('input.text-in', { value: dev.apiUrl, placeholder: 'https://script.google.com/macros/s/…/exec', inputmode: 'url', autocapitalize: 'off', spellcheck: false });
  const token = h('input.text-in', { value: dev.token, placeholder: 'tajný token', autocapitalize: 'off', spellcheck: false });
  const statusEl = h('p.sync-status');
  const paintStatus = st => {
    const label = { idle: 'OK', syncing: 'Synchronizuji…', error: `Chyba: ${st.error}`, offline: 'Offline – čeká se na připojení', unconfigured: 'Nenastaveno' }[st.status];
    statusEl.textContent = `${label} · ve frontě ${st.pending}${st.last ? ` · poslední ${new Date(st.last).toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' })}` : ''}`;
    statusEl.dataset.status = st.status;
  };
  paintStatus(sync.status());
  const off = sync.onStatus(paintStatus);
  const offStore = store.subscribe(() => paintStatus(sync.status()));

  const saveConn = async () => {
    await store.saveDevice({ apiUrl: url.value.trim(), token: token.value.trim() });
  };
  url.addEventListener('change', saveConn);
  token.addEventListener('change', saveConn);

  const testBtn = h('button.btn-ghost', { on: { click: async () => {
    await saveConn();
    statusEl.textContent = 'Testuji…';
    try {
      const r = await sync.test(url.value.trim(), token.value.trim());
      const v = r.version || 1;
      statusEl.textContent = `Spojení OK · Sheet: ${r.name} · skript v${v}${v < 6 ? ' – nasaď novou verzi (README → Aktualizace skriptu)' : ''}`;
      statusEl.dataset.status = 'idle';
    } catch (e) {
      statusEl.textContent = `Nepovedlo se: ${e.message}`;
      statusEl.dataset.status = 'error';
    }
  } } }, 'Otestovat');
  const syncBtn = h('button.btn-ghost', { on: { click: () => sync.syncNow() } }, 'Synchronizovat');

  const sheetUrl = h('input.text-in', { value: s.sheetUrl, placeholder: 'odkaz na Google Sheet', inputmode: 'url', autocapitalize: 'off',
    on: { change: e => save({ sheetUrl: e.target.value.trim() }) } });

  // ---------- check-in pole ----------
  const fields = h('div.toggles', Object.entries(CHECKIN_FIELDS).map(([k, label]) =>
    toggleRow(label, s.checkinFields[k], v => { s.checkinFields[k] = v; save({ checkinFields: s.checkinFields }); })));

  // ---------- šablona ----------
  const tplBox = h('div.tpl');
  const renderTpl = () => {
    tplBox.replaceChildren(
      dayBlock('Denně', s.daily, list => { s.daily = list; save({ daily: list }); }),
      ...[1, 2, 3, 4, 5, 6, 7].map(d => dayBlock(DAYS[d], s.template[d] || [], list => { s.template[d] = list; save({ template: s.template }); })),
      h('button.btn-link', { on: { click: () => {
        if (!confirm('Vrátit týdenní šablonu na výchozí?')) return;
        s.template = structuredClone(DEFAULT_TEMPLATE); s.daily = structuredClone(DEFAULT_DAILY);
        save({ template: s.template, daily: s.daily }); renderTpl();
      } } }, 'Obnovit výchozí šablonu'),
    );
  };
  function dayBlock(title, list, commit) {
    const box = h('div.tpl-day', h('h4', title));
    const draw = () => {
      box.replaceChildren(h('h4', title),
        ...list.map((u, i) => h('div.tpl-unit',
          h('select.sel', { on: { change: e => { u.typ = e.target.value; commit(list); } } },
            Object.entries(TYPES).map(([k, t]) => h('option', { value: k, selected: k === u.typ }, t.label))),
          h('input.text-in', { value: u.nazev, placeholder: 'název', on: { change: e => { u.nazev = e.target.value; commit(list); } } }),
          h('input.text-in', { value: u.detail || '', placeholder: 'detail', on: { change: e => { u.detail = e.target.value; commit(list); } } }),
          h('label.tpl-min', h('input.text-in', { value: u.min, inputmode: 'numeric', on: { change: e => { u.min = Number(e.target.value) || 0; commit(list); } } }), 'min'),
          h('button.btn-x', { 'aria-label': 'Odebrat', on: { click: () => { list.splice(i, 1); commit(list); draw(); } } }, '×'),
        )),
        h('button.btn-link', { on: { click: () => { list.push({ typ: 'sila', nazev: '', detail: '', min: 60 }); commit(list); draw(); } } }, '+ jednotka'),
      );
    };
    draw();
    return box;
  }
  renderTpl();

  // ---------- partie ----------
  const partsBox = h('div.chips');
  const drawParts = () => partsBox.replaceChildren(
    ...s.bodyParts.map((p, i) => h('span.chip', p, h('button.btn-x', { 'aria-label': `Odebrat ${p}`, on: { click: () => { s.bodyParts.splice(i, 1); save({ bodyParts: s.bodyParts }); drawParts(); } } }, '×'))),
    h('input.text-in.chip-in', { placeholder: '+ partie', on: { change: e => {
      const v = e.target.value.trim(); if (!v) return;
      s.bodyParts.push(v); save({ bodyParts: s.bodyParts }); drawParts();
    } } }),
  );
  drawParts();

  // ---------- prahy ----------
  const th = s.thresholds;
  const thr = (k, label, unit) => h('div.thr', h('span', label), h('label.num-field',
    h('input.num-in', { value: th[k], inputmode: 'decimal', on: { change: e => { th[k] = Number(e.target.value.replace(',', '.')) || 0; save({ thresholds: th }); } } }),
    h('span.num-unit', unit)));

  // ---------- pozadí ----------
  const bgSel = h('select.sel', { on: { change: e => save({ bg: e.target.value }) } },
    h('option', { value: 'auto', selected: s.bg === 'auto' }, 'Podle dnešního tréninku'),
    Object.entries(VARIANT_NAMES).map(([k, n]) => h('option', { value: k, selected: String(s.bg) === k }, `Vždy: ${n}`)));

  const view = h('div.view.settings',
    h('header.page-head', h('h1', 'Nastavení')),
    sect('Google Sheet', h('p.muted', 'Vlož URL webové aplikace Apps Scriptu (končí na /exec) a token, pak Otestovat. Ukládá se jen v tomhle zařízení.'),
      labeled('URL Apps Scriptu', url), labeled('Token', token), h('div.row', testBtn, syncBtn), statusEl, labeled('Odkaz na Sheet (volitelné)', sheetUrl),
      s.sheetUrl ? h('a.btn-link', { href: s.sheetUrl, target: '_blank', rel: 'noopener' }, 'Otevřít Sheet ↗') : null),
    sect('Check-in pole', fields),
    sect('Týdenní šablona', tplBox),
    sect('Partie (bolest)', partsBox),
    sect('Prahy semaforu',
      h('p.muted', 'Overreaching = všechny tři podmínky zároveň, tolik dní po sobě.'),
      thr('hrvDropPct', 'Pokles HRV vs. baseline', '%'), thr('rhrRise', 'Vzestup klidového tepu', 'bpm'),
      thr('sleepDropH', 'Spánek pod baseline', 'h'), thr('days', 'Dní po sobě', 'dny'),
      thr('green', 'Zelená od', 'b.'), thr('amber', 'Žlutá od', 'b.')),
    sect('Pozadí DNES', bgSel),
    sect('Export', h('div.row',
      h('button.btn-ghost', { on: { click: exportJson } }, 'JSON'),
      h('button.btn-ghost', { on: { click: () => exportCsv('Jednotky') } }, 'CSV jednotky'),
      h('button.btn-ghost', { on: { click: () => exportCsv('Wellness') } }, 'CSV wellness'))),
    h('p.muted.foot', `Trénink deník · fáze 1 · ${fmt(store.units().length)} jednotek, ${fmt(store.wellnessAll().length)} check-inů`),
  );
  view.cleanup = () => { off(); offStore(); };
  return view;
}

function labeled(label, control) {
  return h('label.lbl', h('span', label), control);
}

function sect(title, ...kids) {
  return h('section.set-sect', h('h3.sect', title), ...kids);
}

function toggleRow(label, value, onChange) {
  const b = h('button.toggle', { type: 'button', role: 'switch', 'aria-checked': String(!!value) }, h('span', label), h('i'));
  b.addEventListener('click', () => {
    const v = b.getAttribute('aria-checked') !== 'true';
    b.setAttribute('aria-checked', String(v));
    tap();
    onChange(v);
  });
  return b;
}

function download(name, text, type) {
  const a = h('a', { href: URL.createObjectURL(new Blob([text], { type })), download: name });
  document.body.append(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}

const stamp = () => new Date().toISOString().slice(0, 10);

function exportJson() {
  download(`trenink-denik-${stamp()}.json`, JSON.stringify(store.exportAll(), null, 2), 'application/json');
}

function exportCsv(sheet) {
  const rows = store.exportAll()[sheet];
  const cols = [...new Set(rows.flatMap(Object.keys))];
  const esc = v => {
    const t = v == null ? '' : typeof v === 'object' ? JSON.stringify(v) : String(v);
    return /[";\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
  };
  // středník + BOM: Excel v češtině to otevře správně
  const csv = '﻿' + [cols.join(';'), ...rows.map(r => cols.map(c => esc(r[c])).join(';'))].join('\n');
  download(`${sheet.toLowerCase()}-${stamp()}.csv`, csv, 'text/csv');
}
