// Denní plán = šablona dne + denní mobilita + jednotky zapsané navíc. Hotové jednotky nesou min/rpe.
import { isoDow } from '../lib/dates.js';
import { TYPES } from '../config.js';
import * as store from '../data/store.js';

export const planId = (datum, i) => `${datum}-p${i}`;

/** Řádky dne: plánované (s případným zápisem) + navíc zapsané. */
export function dayRows(datum) {
  const s = store.getSettings();
  const planned = [...(s.daily || []), ...(s.template[isoDow(datum)] || [])];
  const logged = store.unitsOn(datum);
  const rows = planned.map((p, i) => {
    const id = planId(datum, i);
    const u = logged.find(x => x.id === id);
    return { id, plan: p, unit: u, ...p, ...(u || {}), done: !!u && u.min > 0, skipped: !!u?.skip, poradi: i };
  });
  logged.filter(u => !u.id.includes('-p')).forEach((u, j) =>
    rows.push({ id: u.id, plan: null, unit: u, ...u, done: u.min > 0, poradi: 100 + j }));
  return rows;
}

/** Motiv pozadí: podle první netriviální (neregenerační) jednotky dne. Ovál (1) se nepoužívá. */
export function bgFor(datum) {
  const s = store.getSettings();
  if (s.bg !== 'auto') return Number(s.bg);
  const main = dayRows(datum).find(r => !TYPES[r.typ]?.reg && !r.skipped);
  return main ? (TYPES[main.typ]?.bg ?? 10) : 10;
}
