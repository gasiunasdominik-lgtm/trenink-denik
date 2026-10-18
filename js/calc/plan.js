// Denní plán = šablona dne + denní mobilita + jednotky zapsané navíc. Hotové jednotky nesou min/rpe.
import { isoDow } from '../lib/dates.js';
import { TYPES } from '../config.js';
import * as store from '../data/store.js';
import { campOn } from './camps.js';

/** Pořadí částí dne pro jednotky zapsané navíc (soustředění, dvoufázové dny). */
export const DAY_PARTS = [['rano', 'Ráno'], ['dopoledne', 'Dopoledne'], ['odpoledne', 'Odpoledne'], ['vecer', 'Večer']];
const partOrder = u => { const i = DAY_PARTS.findIndex(([k]) => k === u.faze_dne); return i < 0 ? 9 : i; };

export const planId = (datum, i) => `${datum}-p${i}`;

/** Řádky dne: plánované (s případným zápisem) + navíc zapsané. Na soustředění se šablona nepoužije. */
export function dayRows(datum) {
  const s = store.getSettings();
  const logged = store.unitsOn(datum);
  if (campOn(datum)) {
    return logged.filter(u => !u.skip && u.min > 0)
      .sort((a, b) => partOrder(a) - partOrder(b) || a.id.localeCompare(b.id))
      .map((u, j) => ({ id: u.id, plan: null, unit: u, ...u, done: true, poradi: 100 + j }));
  }
  const planned = [...(s.daily || []), ...(s.template[isoDow(datum)] || [])];
  const rows = planned.map((p, i) => {
    const id = planId(datum, i);
    const u = logged.find(x => x.id === id);
    return { id, plan: p, unit: u, ...p, ...(u || {}), done: !!u && u.min > 0, skipped: !!u?.skip, poradi: i };
  });
  logged.filter(u => !u.id.includes('-p'))
    .sort((a, b) => partOrder(a) - partOrder(b) || a.id.localeCompare(b.id))
    .forEach((u, j) => rows.push({ id: u.id, plan: null, unit: u, ...u, done: u.min > 0, poradi: 100 + j }));
  return rows;
}

/** Motiv pozadí: podle první netriviální (neregenerační) jednotky dne. Ovál (1) se nepoužívá. */
export function bgFor(datum) {
  const s = store.getSettings();
  if (s.bg !== 'auto') return Number(s.bg);
  const main = dayRows(datum).find(r => !TYPES[r.typ]?.reg && !r.skipped);
  return main ? (TYPES[main.typ]?.bg ?? 10) : 10;
}
