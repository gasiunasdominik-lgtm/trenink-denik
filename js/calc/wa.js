// Výkony: parsování, formát a body podle tabulek World Athletics pro víceboj.
import { DISCIPLINES } from '../config.js';

export const disc = id => DISCIPLINES.find(d => d.id === id);
export const lowerIsBetter = id => disc(id)?.kind === 'time';

/** '10,95' → 10.95 · '4:35,2' → 275.2 · '7,12' → 7.12 · '5 518' → 5518. Neplatné → null. */
export function parsePerf(id, text) {
  const t = String(text ?? '').trim().replace(/\s/g, '').replace(',', '.');
  if (!t) return null;
  if (disc(id)?.kind === 'time' && t.includes(':')) {
    const [m, s] = t.split(':');
    const v = Number(m) * 60 + Number(s);
    return Number.isFinite(v) && v > 0 ? v : null;
  }
  const v = Number(t);
  return Number.isFinite(v) && v > 0 ? v : null;
}

const cz = (n, d) => n.toLocaleString('cs-CZ', { minimumFractionDigits: d, maximumFractionDigits: d });

export function formatPerf(id, v) {
  if (v == null || v === '') return '–';
  const d = disc(id);
  if (d?.kind === 'points') return cz(Math.round(v), 0);
  if (d?.kind === 'time' && v >= 60) {
    const m = Math.floor(v / 60);
    const s = v - m * 60;
    return `${m}:${s < 10 ? '0' : ''}${cz(s, 2)}`;
  }
  return cz(v, 2);
}

/** Body WA. Časy v s (ruční čas + přirážka), skoky v m → cm, vrhy v m. */
export function points(id, v, { hand = false } = {}) {
  const d = disc(id);
  if (!d?.wa || v == null) return null;
  const { A, B, C, jumps } = d.wa;
  let x;
  if (d.kind === 'time') x = B - (v + (hand ? d.hand || 0 : 0));
  else x = (jumps ? v * 100 : v) - B;
  return x > 0 ? Math.floor(A * x ** C + 1e-9) : 0; // epsilon proti chybě plovoucí čárky na hranách
}

export const better = (id, a, b) => (b == null ? true : lowerIsBetter(id) ? a < b : a > b);
