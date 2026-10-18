// Zápis odtrénované jednotky. Cíl: Hotovo na 2 ťuknutí – minuty ze šablony, RPE podle minulé stejné
// jednotky, obsah a poznámka z návrhů, Uložit přilepené dole. Smazání / vynechání jde vrátit.
import { h } from '../ui/dom.js';
import { openSheet } from '../ui/sheet.js';
import { scale, stepper, numField, field, chips } from '../ui/inputs.js';
import { success, tap } from '../ui/haptics.js';
import { toast } from '../ui/toast.js';
import * as store from '../data/store.js';
import { TYPES } from '../config.js';
import { today, dm } from '../lib/dates.js';

const VOLUME = [
  ['sprint_m', 'Sprint', 'm'],
  ['skoky', 'Skoky', 'odr.'],
  ['hody', 'Hody / vrhy', 'pokusů'],
  ['prekazky', 'Překážky', 'přel.'],
  ['reg_min', 'REG', 'min'],
];
const MIN_PRESETS = [30, 45, 60, 75, 90, 120];
const isReg = typ => TYPES[typ]?.reg ?? false;
const norm = s => String(s || '').trim().toLowerCase();
const uniq = a => [...new Set(a.filter(Boolean))];

/** Dřívější zápisy stejné jednotky (podle názvu, jinak podle typu), nejnovější první. */
function history(u) {
  const done = store.units().filter(x => x.id !== u.id && x.min > 0).sort((a, b) => b.datum.localeCompare(a.datum));
  const byName = done.filter(x => norm(x.nazev) === norm(u.nazev));
  return byName.length ? byName : done.filter(x => x.typ === u.typ);
}

/** Části detailu ze šablony („dálka technika · koule · 3×150 m“) jako návrhy obsahu. */
const parts = s => String(s || '').split(/\s*[·,;]\s*/).map(x => x.trim()).filter(Boolean);

/**
 * @param row řádek z plan.dayRows nebo null pro novou jednotku navíc
 * @param onSaved(id) zavolá se těsně před uložením (pro animaci razítka)
 */
export function openDone(row, datum, onSaved = () => {}) {
  const extra = !row?.plan;
  const wasDone = !!row?.done;
  const u = {
    id: row?.id ?? `${datum}-x${Date.now().toString(36)}`,
    datum,
    poradi: row?.poradi ?? 100,
    typ: row?.typ ?? 'sila',
    nazev: row?.nazev ?? '',
    detail: row?.detail ?? '',
    plan_min: row?.plan?.min ?? null,
    ...(row?.unit || {}),
  };
  const prev = row?.unit ? { ...row.unit } : null;
  const hist = () => history(u);
  const last = hist()[0];

  // výchozí hodnoty: minuty z plánu (jinak minule), RPE z minula (regenerace 2)
  if (!(u.min > 0)) u.min = row?.plan?.min ?? last?.min ?? 60;
  let rpeFromHistory = false;
  if (!u.rpe) {
    u.rpe = last?.rpe ?? (isReg(u.typ) ? 2 : null);
    rpeFromHistory = u.rpe != null;
  }

  // ---------- pole ----------
  const minStep = stepper({ value: u.min, step: 5, min: 0, max: 400, unit: 'min', onChange: v => (u.min = v) });
  const minChoices = uniq([u.plan_min, last?.min, ...MIN_PRESETS].map(Number)).filter(n => n > 0).sort((a, b) => a - b).slice(0, 7);
  const rpeHint = h('small.rpe-hint', rpeFromHistory ? (last ? `předvyplněno jako ${dm(last.datum)}` : 'regenerace') : 'jak těžké to celé bylo');

  const obsahIn = h('textarea.text-in', { rows: 2, placeholder: 'co jsi dělal: cvičení, série, úseky…', on: { input: e => (u.obsah = e.target.value) } }, u.obsah || '');
  const noteIn = h('textarea.text-in', { rows: 2, placeholder: 'pocity, technika, co příště…', on: { input: e => (u.poznamka = e.target.value) } }, u.poznamka || '');
  const obsahChips = h('div.chips.quick');
  const noteChips = h('div.chips.quick');

  /** návrhy, které ťuknutím připíšou text (oddělovač „ · “) */
  function suggest(box, input, key, items) {
    box.replaceChildren(...uniq(items).slice(0, 8).map(text => h('button.qchip.add', { type: 'button', on: { click: () => {
      const cur = input.value.trim();
      if (cur.toLowerCase().includes(text.toLowerCase())) return;
      input.value = cur ? `${cur} · ${text}` : text;
      u[key] = input.value;
      tap();
    } } }, text.length > 34 ? text.slice(0, 33) + '…' : text)));
  }
  const refreshSuggestions = () => {
    const hs = hist();
    suggest(obsahChips, obsahIn, 'obsah', [...parts(u.detail), ...hs.map(x => x.obsah)]);
    suggest(noteChips, noteIn, 'poznamka', hs.map(x => x.poznamka));
  };
  refreshSuggestions();

  const body = [];
  if (extra) {
    const names = uniq(store.units().sort((a, b) => b.datum.localeCompare(a.datum)).map(x => x.nazev)).slice(0, 40);
    const typSel = h('select.sel', { on: { change: e => { u.typ = e.target.value; refreshSuggestions(); } } },
      Object.entries(TYPES).map(([k, t]) => h('option', { value: k, selected: k === u.typ }, t.label)));
    const nameIn = h('input.text-in', { value: u.nazev, list: 'unit-names', placeholder: 'např. Výška technika', on: {
      input: e => { u.nazev = e.target.value; },
      change: () => {
        // známý název → převzít typ a hodnoty z posledního zápisu
        const l = hist()[0];
        if (l && norm(l.nazev) === norm(u.nazev)) {
          u.typ = l.typ; typSel.value = l.typ;
          if (!wasDone) { minStep.setValue(l.min); if (l.rpe) { u.rpe = l.rpe; rpeBox.replaceWith(rpeBox = rpeScale()); rpeHint.textContent = `předvyplněno jako ${dm(l.datum)}`; } }
        }
        refreshSuggestions();
      },
    } });
    body.push(
      field('Název', h('div', nameIn, h('datalist#unit-names', names.map(n => h('option', { value: n }))))),
      h('div.two', field('Typ', typSel),
        field('Datum', h('input.text-in', { type: 'date', value: u.datum, max: today(), on: { change: e => (u.datum = e.target.value || u.datum) } }))),
    );
  }

  const rpeScale = () => scale({ from: 1, to: 10, value: u.rpe, labels: { 1: 'lehké', 10: 'max' }, onPick: v => { u.rpe = v; rpeHint.textContent = 'jak těžké to celé bylo'; } });
  let rpeBox = rpeScale();

  body.push(
    field('Minuty', h('div', minStep, chips(minChoices.map(n => ({ label: `${n}′`, value: n })), v => minStep.setValue(v), { active: u.min }))),
    h('div.field', h('div.field-l', 'RPE', rpeHint), rpeBox),
    field('Obsah tréninku', h('div', obsahIn, obsahChips)),
    field('Poznámka', h('div', noteIn, noteChips)),
    h('details.volume', { open: VOLUME.some(([k]) => u[k]) || u.zo || u.zn || u.zav },
      h('summary', 'Objem a OTU'),
      h('div.vol-grid', VOLUME.map(([k, l, unit]) =>
        h('div.vol', h('span', l), numField({ value: u[k], unit, onInput: v => (u[k] = v) })))),
      h('div.flags', toggle('zo', 'ZO', 'zdrav. omezení'), toggle('zn', 'ZN', 'nemoc / zranění'), toggle('zav', 'ZÁV', 'start / závod'))),
  );

  function toggle(k, label, hint) {
    const b = h('button.flag', { type: 'button', 'aria-pressed': String(!!u[k]) }, h('b', label), h('small', hint));
    b.addEventListener('click', () => { u[k] = u[k] ? 0 : 1; b.setAttribute('aria-pressed', String(!!u[k])); tap(); });
    return b;
  }

  // ---------- akce (přilepené dole) ----------
  const secondary = [
    row?.plan && !wasDone && !row.skipped ? h('button.btn-ghost', { on: { click: skip } }, 'Vynechat') : null,
    wasDone ? h('button.btn-ghost', { on: { click: remove } }, extra ? 'Smazat' : 'Smazat zápis') : null,
  ].filter(Boolean);
  const actions = h('div.sheet-actions.sticky',
    h('button.btn-primary', { on: { click: save } }, wasDone ? 'Uložit změny' : 'Hotovo'),
    secondary.length ? h('div.row.split', secondary) : null);

  const title = [u.nazev || 'Jednotka navíc', datum !== today() ? dm(datum) : null].filter(Boolean).join(' · ');
  const sheet = openSheet({ title, body: [...body, actions], full: true });

  async function save() {
    if (!u.rpe) {
      const sc = sheet.panel.querySelector('.scale');
      sc.classList.add('shake');
      sc.scrollIntoView({ block: 'center', behavior: 'smooth' });
      setTimeout(() => sc.classList.remove('shake'), 400);
      return;
    }
    if (!u.nazev.trim()) u.nazev = TYPES[u.typ]?.label || 'Trénink';
    u.srpe = u.min * u.rpe;
    delete u.skip;
    delete u.smazano;
    if (!wasDone) onSaved(u.id); // před uložením: překreslení po zápisu už ví, kam dopadne razítko
    sheet.close();
    await store.saveUnit(u);
    success();
    if (wasDone) toast('Změny uloženy');
  }

  async function skip() {
    sheet.close();
    await store.saveUnit({ ...u, min: 0, rpe: null, srpe: null, skip: 1 });
    toast(`${u.nazev} vynecháno`, { action: 'Vrátit', onAction: undo });
  }

  async function remove() {
    sheet.close();
    if (extra) await store.deleteUnit(u.id);
    else await store.saveUnit({ ...u, min: null, rpe: null, srpe: null });
    toast(extra ? 'Jednotka smazána' : 'Zápis smazán', { action: 'Vrátit', onAction: undo });
  }

  /** vrátit stav před vynecháním / smazáním */
  async function undo() {
    if (prev) await store.saveUnit({ ...prev, smazano: 0 });
    else await store.deleteUnit(u.id); // plánovaná jednotka bez zápisu → zpět jen plán
  }
}
