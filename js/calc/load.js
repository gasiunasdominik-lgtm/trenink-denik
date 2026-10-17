// Zátěž: sRPE, ACWR 7/28, monotonie, strain, OTU týdne.
import { addDays, range, weekDays } from '../lib/dates.js';
import { TYPES } from '../config.js';

export const srpe = u => (u.min || 0) * (u.rpe || 0);
export const isReg = u => TYPES[u.typ]?.reg ?? false;
const done = u => u.min != null && u.min > 0;

/** Mapa datum → součet sRPE. */
export function dailyLoads(units) {
  const m = new Map();
  units.filter(done).forEach(u => m.set(u.datum, (m.get(u.datum) || 0) + srpe(u)));
  return m;
}

const sum = a => a.reduce((s, x) => s + x, 0);
const mean = a => (a.length ? sum(a) / a.length : 0);
const sd = a => { const m = mean(a); return Math.sqrt(mean(a.map(x => (x - m) ** 2))); };

/**
 * Metriky k danému dni (včetně).
 * ACWR = akutní 7denní součet / (chronický 28denní součet / 4). Monotonie = průměr / SD denních zátěží za 7 dní.
 */
export function loadMetrics(units, day) {
  const loads = dailyLoads(units);
  const last = n => range(addDays(day, 1 - n), day).map(d => loads.get(d) || 0);
  const d7 = last(7), d28 = last(28);
  const acute = sum(d7);
  const chronic = sum(d28) / 4;
  const s = sd(d7);
  const monotony = s > 0 ? mean(d7) / s : null;
  const hasHistory = d28.filter(x => x > 0).length >= 7;
  return {
    acute,
    chronic,
    acwr: chronic > 0 && hasHistory ? acute / chronic : null,
    monotony,
    strain: monotony != null ? acute * monotony : null,
  };
}

export function acwrZone(acwr) {
  if (acwr == null) return 'none';
  if (acwr > 1.5) return 'stop';
  if (acwr > 1.3 || acwr < 0.8) return 'warn';
  return 'go';
}

/**
 * OTU týdne. ČZ = minuty zatížení (bez regenerace), REG = regenerační minuty (+ reg_min u jednotek),
 * DNY = dny s tréninkem, JED = tréninkové jednotky (dvoufázový den = 2), ZO/ZN = dny se zdrav. omezením / nemocí.
 */
export function otu(units, anyDay) {
  const days = weekDays(anyDay);
  const wk = units.filter(u => days.includes(u.datum) && done(u));
  const load = wk.filter(u => !isReg(u));
  const dayCount = pred => new Set(wk.filter(pred).map(u => u.datum)).size;
  return {
    cz: sum(load.map(u => u.min || 0)),
    reg: sum(wk.filter(isReg).map(u => u.min || 0)) + sum(wk.map(u => u.reg_min || 0)),
    zo: dayCount(u => u.zo),
    zn: dayCount(u => u.zn),
    dny: new Set(load.map(u => u.datum)).size,
    jed: load.length,
    zav: wk.filter(u => u.typ === 'zavod' || u.zav).length,
    srpe: sum(wk.map(srpe)),
  };
}
