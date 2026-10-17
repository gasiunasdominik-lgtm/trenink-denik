// Práce s daty v lokálním čase. Datum = řetězec 'YYYY-MM-DD'.

const pad = n => String(n).padStart(2, '0');

export const toKey = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const fromKey = k => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d); };
export const today = () => toKey(new Date());
export const addDays = (k, n) => { const d = fromKey(k); d.setDate(d.getDate() + n); return toKey(d); };

/** 1 = pondělí … 7 = neděle */
export const isoDow = k => fromKey(k).getDay() || 7;

export function isoWeek(k) {
  const d = fromKey(k);
  d.setDate(d.getDate() + 4 - (d.getDay() || 7));
  const y = d.getFullYear();
  const w = Math.ceil(((d - new Date(y, 0, 1)) / 864e5 + 1) / 7);
  return { year: y, week: w, key: `${y}-W${pad(w)}` };
}

export const weekStart = k => addDays(k, 1 - isoDow(k));
export const weekDays = k => { const s = weekStart(k); return [0, 1, 2, 3, 4, 5, 6].map(i => addDays(s, i)); };

export const dayOfYear = k => { const d = fromKey(k); return Math.round((d - new Date(d.getFullYear(), 0, 1)) / 864e5) + 1; };

export const range = (from, to) => { const out = []; for (let k = from; k <= to; k = addDays(k, 1)) out.push(k); return out; };

const DOW = ['', 'Po', 'Út', 'St', 'Čt', 'Pá', 'So', 'Ne'];
const DOW_LONG = ['', 'Pondělí', 'Úterý', 'Středa', 'Čtvrtek', 'Pátek', 'Sobota', 'Neděle'];
export const dowShort = k => DOW[isoDow(k)];
export const dowLong = k => DOW_LONG[isoDow(k)];
export const dm = k => { const d = fromKey(k); return `${d.getDate()}.${d.getMonth() + 1}.`; };

/** 7.5 → '7:30' */
export const hm = hours => {
  if (hours == null) return '–';
  const m = Math.round(hours * 60);
  return `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}`;
};

export const hhmm = (d = new Date()) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
export const nowIso = () => new Date().toISOString();
