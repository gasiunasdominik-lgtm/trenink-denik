// Výkon: osobáky, nejlepší výkony v roce, součty víceboje, testy.
import * as store from '../data/store.js';
import { DISCIPLINES, DEFAULT_TESTS } from '../config.js';
import { better, points, disc as discOf } from './wa.js';

export const DECATHLON = DISCIPLINES.filter(d => d.dec).sort((a, b) => a.dec - b.dec);
export const OTHER = DISCIPLINES.filter(d => !d.dec);

export const results = disc => store.rows('zavody').filter(r => r.disciplina === disc && r.vykon != null)
  .sort((a, b) => a.datum.localeCompare(b.datum));

/** Nejlepší výkon (volitelně v daném roce). */
export function best(disc, year) {
  return results(disc).filter(r => !year || r.datum.startsWith(String(year)))
    .reduce((b, r) => (better(disc, r.vykon, b?.vykon) ? r : b), null);
}

/**
 * PB disciplíny. Řádek z PB_Plany má přednost (Cowork úloha z atletika.cz ho vybírá podle nářadí,
 * výšky překážek a venku/hala; nový PB zapsaný v appce ho přepíše). Ze Závodů se PB vezme jen tam, kde chybí.
 */
export function pbOf(disc) {
  const row = store.row('pb', disc) || { disciplina: disc };
  if (row.pb != null) return row;
  const fromResults = best(disc);
  return fromResults ? { ...row, pb: fromResults.vykon, pb_datum: fromResults.datum } : row;
}

/** Výsledek, který je současným PB (stejný výkon, a pokud je známé datum PB, i stejný den). */
export function isPbResult(r) {
  if (!discOf(r.disciplina) || r.vykon == null) return false; // štafety, žákovské nářadí apod. PB nemají
  const pb = pbOf(r.disciplina);
  return pb.pb != null && r.vykon === pb.pb && (!pb.pb_datum || pb.pb_datum === r.datum);
}

/** Body pro desetibojový „kalkulátor“ z osobáků a z plánu. */
export function decathlonSums() {
  let pb = 0, plan = 0, pbN = 0, planN = 0;
  DECATHLON.forEach(d => {
    const r = pbOf(d.id);
    if (r.pb != null) { pb += points(d.id, r.pb); pbN++; }
    if (r.plan_letos != null) { plan += points(d.id, r.plan_letos); planN++; }
  });
  return { pb, plan, pbN, planN };
}

export function allTests() {
  return [...DEFAULT_TESTS, ...(store.getSettings().customTests || [])];
}

export const testValues = id => store.rows('testy').filter(r => r.test === id && r.hodnota != null)
  .sort((a, b) => a.datum.localeCompare(b.datum));

/** Asymetrie L vs. P z posledních hodnot (záporná = levá slabší). */
export function asymmetry(idL, idP) {
  const l = testValues(idL).at(-1)?.hodnota, p = testValues(idP).at(-1)?.hodnota;
  if (l == null || p == null || !p) return null;
  return ((l - p) / Math.max(l, p)) * 100;
}
