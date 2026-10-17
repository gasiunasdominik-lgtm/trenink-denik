// Zápis odtrénované jednotky: minuty, RPE, poznámka, volitelně objem.
import { h } from '../ui/dom.js';
import { openSheet } from '../ui/sheet.js';
import { scale, stepper, numField, field } from '../ui/inputs.js';
import { success, tap } from '../ui/haptics.js';
import * as store from '../data/store.js';
import { TYPES } from '../config.js';

const VOLUME = [
  ['sprint_m', 'Sprint', 'm'],
  ['skoky', 'Skoky', 'odr.'],
  ['hody', 'Hody / vrhy', 'pokusů'],
  ['prekazky', 'Překážky', 'přel.'],
  ['reg_min', 'REG', 'min'],
];

/**
 * @param row řádek z plan.dayRows nebo null pro novou jednotku navíc
 * @param onSaved(id) zavolá se těsně před uložením (pro animaci razítka)
 */
export function openDone(row, datum, onSaved = () => {}) {
  const isNew = !row;
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
  u.min ??= row?.plan?.min ?? 60;

  const body = [];
  if (isNew || !row.plan) {
    body.push(
      field('Typ', h('select.sel', { on: { change: e => (u.typ = e.target.value) } },
        Object.entries(TYPES).map(([k, t]) => h('option', { value: k, selected: k === u.typ }, t.label)))),
      field('Název', h('input.text-in', { value: u.nazev, placeholder: 'např. Výška technika', on: { input: e => (u.nazev = e.target.value) } })),
    );
  }
  body.push(
    field('Minuty', stepper({ value: u.min, step: 5, min: 0, max: 400, unit: 'min', onChange: v => (u.min = v) })),
    field('RPE', scale({ from: 1, to: 10, value: u.rpe, labels: { 1: 'lehké', 10: 'max' }, onPick: v => (u.rpe = v) }), 'jak těžké to celé bylo'),
    field('Poznámka', h('textarea.text-in', { rows: 2, placeholder: 'technika, pocity, co příště…', on: { input: e => (u.poznamka = e.target.value) } }, u.poznamka || '')),
    h('details.volume', { open: VOLUME.some(([k]) => u[k]) || u.zo || u.zn },
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

  const actions = h('div.sheet-actions',
    h('button.btn-primary', { on: { click: save } }, 'Uložit · Hotovo'),
    row?.plan && !row.done ? h('button.btn-ghost', { on: { click: skip } }, 'Dnes vynechat') : null,
    row && (row.done || !row.plan) ? h('button.btn-ghost', { on: { click: remove } }, row.plan ? 'Zrušit zápis' : 'Smazat') : null,
  );

  const sheet = openSheet({ title: u.nazev || 'Jednotka navíc', body: [...body, actions], full: true });

  async function save() {
    if (!u.rpe) { sheet.panel.querySelector('.scale').classList.add('shake'); setTimeout(() => sheet.panel.querySelector('.scale')?.classList.remove('shake'), 400); return; }
    if (!u.nazev) u.nazev = TYPES[u.typ]?.label || 'Trénink';
    u.srpe = u.min * u.rpe;
    delete u.skip;
    onSaved(u.id); // před uložením: překreslení po zápisu už ví, kam dopadne razítko
    sheet.close();
    await store.saveUnit(u);
    success();
  }

  async function skip() {
    await store.saveUnit({ ...u, min: 0, rpe: null, skip: 1 });
    sheet.close();
  }

  async function remove() {
    if (row.plan) await store.saveUnit({ ...u, min: null, rpe: null, srpe: null });
    else await store.deleteUnit(u.id);
    sheet.close();
  }
}
