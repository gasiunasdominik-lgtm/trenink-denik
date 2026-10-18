// Soustředění: období bez týdenní šablony. Ukládají se v Nastavení (settings.camps) → synchronizace přes list Nastaveni.
import * as store from '../data/store.js';
import { fromKey } from '../lib/dates.js';

/** Všechna soustředění seřazená od nejnovějšího. {id, nazev, misto, od, do, poznamka} */
export const camps = () => [...(store.getSettings().camps || [])].sort((a, b) => b.od.localeCompare(a.od));

const days = (a, b) => Math.round((fromKey(b) - fromKey(a)) / 864e5) + 1;

/** Soustředění, které daný den probíhá: { camp, day, total } nebo null. */
export function campOn(datum) {
  const c = camps().find(x => x.od <= datum && datum <= x.do);
  return c ? { camp: c, day: days(c.od, datum), total: days(c.od, c.do) } : null;
}

/** Soustředění, která zasahují do období. */
export const campsBetween = (from, to) => camps().filter(c => c.od <= to && c.do >= from);

export async function saveCamp(c) {
  const list = (store.getSettings().camps || []).filter(x => x.id !== c.id);
  await store.saveSettings({ camps: [...list, c] });
}

export async function deleteCamp(id) {
  await store.saveSettings({ camps: (store.getSettings().camps || []).filter(x => x.id !== id) });
}
