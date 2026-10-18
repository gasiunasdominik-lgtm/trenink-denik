// Správa soustředění: přidat / upravit / smazat (s možností vrátit).
import { h } from '../ui/dom.js';
import { openSheet } from '../ui/sheet.js';
import { field } from '../ui/inputs.js';
import { toast } from '../ui/toast.js';
import { camps, saveCamp, deleteCamp } from '../calc/camps.js';
import { today, addDays, dm, fromKey } from '../lib/dates.js';

const dmy = k => `${dm(k)}${fromKey(k).getFullYear()}`;

/** Seznam soustředění s tlačítkem pro přidání (do TÝDNE). */
export function campList() {
  const list = camps();
  return h('section.camps',
    h('h3.sect', 'Soustředění'),
    list.length ? list.map(c => h('button.camp-row', { type: 'button', on: { click: () => editCamp(c) } },
      h('b', c.nazev), h('span', `${dmy(c.od)} – ${dmy(c.do)}${c.misto ? ` · ${c.misto}` : ''}`))) : h('p.muted', 'Na soustředění se nepoužije týdenní šablona: jednotky zapisuješ na DNES tlačítkem + Jednotka.'),
    h('button.btn-ghost', { on: { click: () => editCamp(null) } }, '+ Soustředění'));
}

export function editCamp(existing) {
  const c = existing ? { ...existing } : { id: `s-${Date.now().toString(36)}`, nazev: '', misto: '', od: today(), do: addDays(today(), 6), poznamka: '' };
  const err = h('p.form-err');
  const inp = (k, ph, type = 'text') => h('input.text-in', { type, value: c[k] || '', placeholder: ph, on: { input: e => (c[k] = e.target.value) } });
  const sheet = openSheet({ title: existing ? c.nazev : 'Nové soustředění', full: true, body: [
    field('Název', inp('nazev', 'např. Soustředění Nymburk')),
    field('Místo', inp('misto', 'město / sportovní centrum')),
    h('div.two', field('Od', inp('od', '', 'date')), field('Do', inp('do', '', 'date'))),
    field('Poznámka', h('textarea.text-in', { rows: 3, placeholder: 'zaměření, trenér, dvoufázové dny…', on: { input: e => (c.poznamka = e.target.value) } }, c.poznamka || '')),
    err,
    h('div.sheet-actions.sticky',
      h('button.btn-primary', { on: { click: save } }, 'Uložit'),
      existing ? h('div.row.split', h('button.btn-ghost', { on: { click: remove } }, 'Smazat')) : null),
  ] });

  async function save() {
    if (!c.nazev.trim()) { err.textContent = 'Doplň název.'; return; }
    if (!c.od || !c.do || c.do < c.od) { err.textContent = 'Datum „do“ musí být stejné nebo pozdější než „od“.'; return; }
    const clash = camps().find(x => x.id !== c.id && x.od <= c.do && x.do >= c.od);
    if (clash) { err.textContent = `Překrývá se se soustředěním ${clash.nazev}.`; return; }
    c.nazev = c.nazev.trim();
    sheet.close();
    await saveCamp(c);
    toast(existing ? 'Soustředění upraveno' : `Přidáno: ${c.nazev}`);
  }

  async function remove() {
    sheet.close();
    await deleteCamp(c.id);
    toast('Soustředění smazáno', { action: 'Vrátit', onAction: () => saveCamp(existing) });
  }
}
