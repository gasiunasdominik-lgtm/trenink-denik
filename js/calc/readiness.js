// Readiness 0–100 z ranního check-inu + overreaching flag.
// Subjektivní škály 1–5: 5 = nejlepší (svěží, svaly OK, dobrá nálada).
import { addDays } from '../lib/dates.js';

const clamp01 = x => Math.max(0, Math.min(1, x));
const mean = a => a.reduce((s, x) => s + x, 0) / a.length;
const num = v => (v == null || v === '' ? null : Number(v));

/** Průměr hodnoty za 28 dní před daným dnem (min. 5 záznamů). */
export function baseline(byDate, day, field) {
  const vals = [];
  for (let i = 1; i <= 28; i++) {
    const v = num(byDate(addDays(day, -i))?.[field]);
    if (v != null) vals.push(v);
  }
  return vals.length >= 5 ? mean(vals) : null;
}

export function painMax(w) {
  return Math.max(0, ...Object.values(w?.bolest || {}).map(Number));
}

/**
 * @param byDate funkce datum → wellness záznam
 * @returns {score, lights 0–5, level 'go'|'warn'|'stop', verdict, parts, overreaching}
 */
export function readiness(byDate, day, t) {
  const w = byDate(day);
  if (!w) return null;
  const parts = [];
  const add = (weight, value) => value != null && !Number.isNaN(value) && parts.push([weight, clamp01(value)]);

  const hrv = num(w.hrv), hrvB = baseline(byDate, day, 'hrv');
  const rhr = num(w.rhr), rhrB = baseline(byDate, day, 'rhr');
  if (hrv != null && hrvB) add(0.30, 1 + (hrv / hrvB - 1) / 0.15);      // −15 % a víc = 0
  if (rhr != null && rhrB) add(0.15, 1 - (rhr - rhrB) / 8);             // +8 bpm a víc = 0
  const sh = num(w.spanek_h), sq = num(w.spanek_q);
  if (sh != null) add(0.12, (sh - 5) / 3);                              // 5 h = 0, 8 h = 1
  if (sq != null) add(0.08, (sq - 1) / 4);
  const subj = ['unava', 'svaly', 'nalada'].map(k => num(w[k])).filter(v => v != null);
  if (subj.length) add(0.35, (mean(subj) - 1) / 4);

  if (!parts.length) return null;
  const totalW = parts.reduce((s, [wt]) => s + wt, 0);
  const raw = 100 * parts.reduce((s, [wt, v]) => s + wt * v, 0) / totalW;
  const score = Math.round(Math.max(0, raw - painMax(w) * 6));

  const level = score >= t.green ? 'go' : score >= t.amber ? 'warn' : 'stop';
  const verdict = { go: 'Plný trénink', warn: 'Uprav objem', stop: 'Lehce / regenerace' }[level];
  const over = overreaching(byDate, day, t);
  return {
    score,
    lights: Math.max(0, Math.min(5, Math.round(score / 20))),
    level: over ? 'stop' : level,
    verdict: over ? 'Overreaching' : verdict,
    hrvDelta: hrv != null && hrvB ? (hrv / hrvB - 1) * 100 : null,
    rhrDelta: rhr != null && rhrB ? rhr - rhrB : null,
    overreaching: over,
  };
}

/** Pokles HRV + zvýšený klidový tep + horší spánek po `t.days` dní za sebou. */
export function overreaching(byDate, day, t) {
  for (let i = 0; i < t.days; i++) {
    const d = addDays(day, -i);
    const w = byDate(d);
    if (!w) return false;
    const hrvB = baseline(byDate, d, 'hrv'), rhrB = baseline(byDate, d, 'rhr'), shB = baseline(byDate, d, 'spanek_h');
    const hrv = num(w.hrv), rhr = num(w.rhr), sh = num(w.spanek_h), sq = num(w.spanek_q);
    const hrvDown = hrv != null && hrvB && (1 - hrv / hrvB) * 100 >= t.hrvDropPct;
    const rhrUp = rhr != null && rhrB && rhr - rhrB >= t.rhrRise;
    const sleepBad = (sh != null && shB && shB - sh >= t.sleepDropH) || (sq != null && sq <= 2);
    if (!(hrvDown && rhrUp && sleepBad)) return false;
  }
  return true;
}
