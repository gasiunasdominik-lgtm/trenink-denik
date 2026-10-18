// Grafy v čistém SVG (offline, bez knihoven). Zásady: jedna osa y na graf, tenké značky,
// tlumená mřížka, tooltip na dotyk, ke každému grafu tabulka.
import { h, fmt } from './dom.js';
import { fromKey, dm, range } from '../lib/dates.js';

const W = 360;
const PAD = { l: 36, r: 10, t: 12, b: 22 };
const NS = 'http://www.w3.org/2000/svg';
export const COLORS = {
  primary: '#d0563a',   // tartan – hlavní řada
  second: '#5b8fc7',    // modrá dráha – druhá řada (REG)
  grid: '#262523',
  axis: '#8c877d',
  band: 'rgba(245,242,234,.07)',
  ref: '#8c877d',
};
/** Sekvenční škála tartanu pro tmavý podklad: víc = světlejší. */
export const HEAT = ['#1a1917', '#7a3626', '#b84a31', '#ff8a66']; // ověřeno validátorem (ordinal, tmavý podklad)

const s = (tag, attrs = {}, ...kids) => {
  const el = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) if (v != null) el.setAttribute(k, v);
  kids.flat().forEach(k => k != null && el.append(k instanceof Node ? k : document.createTextNode(String(k))));
  return el;
};

const dayNum = k => Math.round(fromKey(k).getTime() / 864e5);

function niceTicks(min, max, n = 3) {
  if (min === max) { max = min + 1; }
  const span = max - min;
  const step0 = span / n;
  const mag = 10 ** Math.floor(Math.log10(step0));
  const step = [1, 2, 2.5, 5, 10].map(m => m * mag).find(st => st >= step0);
  const lo = Math.floor(min / step) * step;
  const hi = Math.ceil(max / step) * step;
  const ticks = [];
  for (let v = lo; v <= hi + step / 2; v += step) ticks.push(+v.toFixed(6));
  return { lo, hi, ticks };
}

function frame(title, note) {
  return h('figure.chart', h('figcaption', h('b', title), note ? h('small', note) : null));
}

function tableView(cols, rowsData) {
  return h('details.chart-table', h('summary', 'Tabulka'),
    h('table', h('thead', h('tr', cols.map(c => h('th', c)))),
      h('tbody', rowsData.map(r => h('tr', r.map(c => h('td', c)))))));
}

/** Tooltip + svislá čára; pick(px) vrací {x: svg x, html} nebo null. */
function hover(wrap, svg, plotH, pick) {
  const tip = h('div.chart-tip', { hidden: true });
  const line = s('line', { y1: PAD.t, y2: PAD.t + plotH, stroke: COLORS.axis, 'stroke-width': 1, visibility: 'hidden' });
  svg.append(line);
  wrap.append(tip);
  let timer;
  const move = e => {
    const r = svg.getBoundingClientRect();
    const px = ((e.clientX - r.left) / r.width) * W;
    const hit = pick(px);
    if (!hit) return hide();
    line.setAttribute('x1', hit.x); line.setAttribute('x2', hit.x); line.setAttribute('visibility', 'visible');
    tip.innerHTML = hit.html;
    tip.hidden = false;
    const left = (hit.x / W) * r.width;
    tip.style.left = `${Math.min(Math.max(left, 60), r.width - 60)}px`;
    clearTimeout(timer);
    timer = setTimeout(hide, 3000);
  };
  const hide = () => { tip.hidden = true; line.setAttribute('visibility', 'hidden'); };
  svg.addEventListener('pointermove', move);
  svg.addEventListener('pointerdown', move);
  svg.addEventListener('pointerleave', e => { if (e.pointerType === 'mouse') hide(); });
}

function axes(svg, { y, yt, plotH, from, to, yFormat }) {
  const g = s('g');
  yt.ticks.forEach(v => {
    const yy = y(v);
    g.append(s('line', { x1: PAD.l, x2: W - PAD.r, y1: yy, y2: yy, stroke: COLORS.grid, 'stroke-width': 1 }));
    g.append(s('text', { x: PAD.l - 6, y: yy + 4, 'text-anchor': 'end', class: 'ax' }, yFormat(v)));
  });
  const xs = [from, to];
  g.append(s('text', { x: PAD.l, y: PAD.t + plotH + 16, class: 'ax' }, dm(xs[0])));
  g.append(s('text', { x: W - PAD.r, y: PAD.t + plotH + 16, 'text-anchor': 'end', class: 'ax' }, dm(xs[1])));
  svg.append(g);
}

/**
 * Časový graf (sloupce nebo čára) na jedné ose.
 * @param o.points [{x: 'YYYY-MM-DD', y: number|null}]
 * @param o.type 'bar' | 'line'
 * @param o.band {from, to, label} vodorovné pásmo (např. ACWR 0,8–1,3)
 * @param o.refs [{y, label}] referenční čáry
 */
export function timeChart(o) {
  const { title, note, points, from, to, type = 'line', height = 140, color = COLORS.primary,
    yFormat = v => fmt(v), unit = '', band, refs = [], yMin, dots = false, empty = 'Zatím žádná data.' } = o;
  const fig = frame(title, note);
  const valid = points.filter(p => p.y != null);
  if (!valid.length) { fig.append(h('p.chart-empty', empty)); return fig; }

  const plotW = W - PAD.l - PAD.r;
  const d0 = dayNum(from), d1 = dayNum(to);
  const days = Math.max(1, d1 - d0 + 1);
  const ys = valid.map(p => p.y).concat(band ? [band.from, band.to] : [], refs.map(r => r.y));
  const yt = niceTicks(yMin ?? (type === 'bar' ? 0 : Math.min(...ys)), Math.max(...ys));
  const y = v => PAD.t + height - ((v - yt.lo) / (yt.hi - yt.lo)) * height;
  const step = plotW / days;
  const x = k => PAD.l + (dayNum(k) - d0 + 0.5) * step;

  const svg = s('svg', { viewBox: `0 0 ${W} ${height + PAD.t + PAD.b}`, class: 'chart-svg', role: 'img', 'aria-label': title });
  axes(svg, { y, yt, plotH: height, from, to, yFormat });
  if (band) svg.append(s('rect', { x: PAD.l, width: plotW, y: y(band.to), height: y(band.from) - y(band.to), fill: COLORS.band }));
  refs.forEach(r => {
    svg.append(s('line', { x1: PAD.l, x2: W - PAD.r, y1: y(r.y), y2: y(r.y), stroke: COLORS.ref, 'stroke-width': 1 }));
    if (r.label) svg.append(s('text', { x: W - PAD.r, y: y(r.y) - 4, 'text-anchor': 'end', class: 'ax' }, r.label));
  });

  if (type === 'bar') {
    const bw = Math.max(1, step - 2);
    valid.forEach(p => {
      const top = y(p.y), base = y(Math.max(0, yt.lo));
      const r = bw >= 6 ? 2 : 0;
      svg.append(s('path', { fill: color, d: `M${x(p.x) - bw / 2},${base}V${top + r}q0,${-r} ${r},${-r}h${bw - 2 * r}q${r},0 ${r},${r}V${base}Z` }));
    });
  } else {
    let d = '', prevIn = false;
    points.forEach(p => {
      if (p.y == null) { prevIn = false; return; }
      d += `${prevIn ? 'L' : 'M'}${x(p.x).toFixed(1)},${y(p.y).toFixed(1)}`;
      prevIn = true;
    });
    svg.append(s('path', { d, fill: 'none', stroke: color, 'stroke-width': 2, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }));
    const pts = dots ? valid : [valid[valid.length - 1]];
    pts.forEach(p => svg.append(s('circle', { cx: x(p.x), cy: y(p.y), r: 4, fill: color, stroke: '#0d0d0c', 'stroke-width': 2 })));
  }
  // přímý popisek posledního bodu (u sloupců by překrýval – hodnoty jsou v tooltipu a tabulce)
  const last = valid[valid.length - 1];
  if (type !== 'bar') svg.append(s('text', { x: Math.min(x(last.x), W - PAD.r), y: Math.max(y(last.y) - 8, PAD.t + 8), 'text-anchor': 'end', class: 'val' }, yFormat(last.y) + unit));

  const wrap = h('div.chart-wrap', svg);
  const byDay = new Map(valid.map(p => [p.x, p]));
  hover(wrap, svg, height, px => {
    const k = range(from, to)[Math.floor((px - PAD.l) / step)];
    if (!k) return null;
    const p = byDay.get(k) || [...byDay.values()].reduce((best, q) => (Math.abs(dayNum(q.x) - dayNum(k)) < Math.abs(dayNum(best.x) - dayNum(k)) ? q : best));
    if (Math.abs(dayNum(p.x) - dayNum(k)) > Math.max(3, days / 30)) return null;
    return { x: x(p.x), html: `<b>${yFormat(p.y)}${unit}</b> ${dm(p.x)}${p.note ? ` · ${p.note}` : ''}` };
  });
  fig.append(wrap, tableView(['Datum', title], [...valid].reverse().map(p => [dm(p.x) + fromKey(p.x).getFullYear(), yFormat(p.y) + unit])));
  return fig;
}

/** Skládané týdenní sloupce (např. ČZ + REG). series [{key, label, color}], data [{x: weekStartKey, label, values}] */
export function stackedWeeks({ title, note, series, data, height = 140, unit = '' }) {
  const fig = frame(title, note);
  if (!data.some(d => series.some(sr => d.values[sr.key]))) { fig.append(h('p.chart-empty', 'Zatím žádná data.')); return fig; }
  const plotW = W - PAD.l - PAD.r;
  const totals = data.map(d => series.reduce((a, sr) => a + (d.values[sr.key] || 0), 0));
  const yt = niceTicks(0, Math.max(...totals));
  const y = v => PAD.t + height - (v / yt.hi) * height;
  const step = plotW / data.length;
  const bw = Math.max(1.5, step - 2);
  const svg = s('svg', { viewBox: `0 0 ${W} ${height + PAD.t + PAD.b}`, class: 'chart-svg', role: 'img', 'aria-label': title });
  axes(svg, { y, yt, plotH: height, from: data[0].x, to: data[data.length - 1].x, yFormat: v => fmt(v) });
  data.forEach((d, i) => {
    let acc = 0;
    series.forEach(sr => {
      const v = d.values[sr.key] || 0;
      if (!v) return;
      const top = y(acc + v), bot = y(acc);
      // 2px mezera mezi segmenty
      svg.append(s('rect', { x: PAD.l + i * step + 1, width: bw, y: top, height: Math.max(0, bot - top - (acc ? 2 : 0)), fill: sr.color }));
      acc += v;
    });
  });
  const wrap = h('div.chart-wrap', svg);
  hover(wrap, svg, height, px => {
    const i = Math.floor((px - PAD.l) / step);
    const d = data[i];
    if (!d) return null;
    return { x: PAD.l + i * step + step / 2, html: `<b>${d.label}</b> ` + series.map(sr => `${sr.label} ${fmt(d.values[sr.key] || 0)}${unit}`).join(' · ') };
  });
  const legend = h('div.legend', series.map(sr => h('span', h('i', { style: { background: sr.color } }), sr.label)));
  fig.append(legend, wrap, tableView(['Týden', ...series.map(sr => sr.label)], [...data].reverse().map(d => [d.label, ...series.map(sr => fmt(d.values[sr.key] || 0))])));
  return fig;
}

/** Heatmapa: řádky × dny, hodnota 0–3. */
export function heatmap({ title, note, rows, from, to, value, levels = ['', 'lehká', 'střední', 'silná'] }) {
  const fig = frame(title, note);
  const days = range(from, to);
  const any = rows.some(r => days.some(d => value(r, d)));
  if (!rows.length || !any) { fig.append(h('p.chart-empty', 'Bez bolesti v tomto období.')); return fig; }
  const labelW = 92;
  const cell = (W - labelW - PAD.r) / days.length;
  const rh = 18;
  const H = rows.length * (rh + 2) + PAD.b;
  const svg = s('svg', { viewBox: `0 0 ${W} ${H}`, class: 'chart-svg', role: 'img', 'aria-label': title });
  rows.forEach((r, ri) => {
    const yy = ri * (rh + 2);
    svg.append(s('text', { x: 0, y: yy + 13, class: 'ax lbl' }, r));
    days.forEach((d, di) => {
      const v = value(r, d) || 0;
      svg.append(s('rect', { x: labelW + di * cell + (cell > 3 ? 0.5 : 0), y: yy, width: Math.max(0.6, cell - (cell > 3 ? 1 : 0)), height: rh, fill: HEAT[v] }));
    });
  });
  svg.append(s('text', { x: labelW, y: H - 6, class: 'ax' }, dm(from)));
  svg.append(s('text', { x: W - PAD.r, y: H - 6, 'text-anchor': 'end', class: 'ax' }, dm(to)));
  const wrap = h('div.chart-wrap', svg);
  // tooltip: buňka pod prstem
  const tip = h('div.chart-tip', { hidden: true });
  wrap.append(tip);
  svg.addEventListener('pointerdown', e => {
    const r = svg.getBoundingClientRect();
    const px = ((e.clientX - r.left) / r.width) * W, py = ((e.clientY - r.top) / r.height) * H;
    const di = Math.floor((px - labelW) / cell), ri = Math.floor(py / (rh + 2));
    if (di < 0 || ri < 0 || ri >= rows.length || !days[di]) { tip.hidden = true; return; }
    const v = value(rows[ri], days[di]) || 0;
    tip.innerHTML = `<b>${rows[ri]}</b> ${dm(days[di])} · ${v ? levels[v] : 'bez bolesti'}`;
    tip.style.left = `${Math.min(Math.max(e.clientX - r.left, 70), r.width - 70)}px`;
    tip.hidden = false;
  });
  const legend = h('div.legend', [1, 2, 3].map(v => h('span', h('i', { style: { background: HEAT[v] } }), levels[v])));
  const rowsT = [];
  days.forEach(d => rows.forEach(r => { const v = value(r, d); if (v) rowsT.push([dm(d), r, levels[v]]); }));
  fig.append(legend, wrap, tableView(['Datum', 'Partie', 'Bolest'], rowsT.reverse()));
  return fig;
}

/** Malý průběh (bez os) – pro seznamy testů. */
export function sparkline(values, { lower = false, w = 72, hgt = 22 } = {}) {
  if (values.length < 2) return h('span.spark-empty');
  const min = Math.min(...values), max = Math.max(...values);
  const yy = v => hgt - 3 - ((v - min) / (max - min || 1)) * (hgt - 6);
  const xx = i => 3 + (i / (values.length - 1)) * (w - 6);
  const d = values.map((v, i) => `${i ? 'L' : 'M'}${xx(i).toFixed(1)},${yy(v).toFixed(1)}`).join('');
  const best = lower ? min : max;
  const bi = values.lastIndexOf(best);
  return s('svg', { viewBox: `0 0 ${w} ${hgt}`, width: w, height: hgt, class: 'spark', 'aria-hidden': 'true' },
    s('path', { d, fill: 'none', stroke: COLORS.primary, 'stroke-width': 1.5 }),
    s('circle', { cx: xx(bi), cy: yy(best), r: 2.5, fill: COLORS.primary }));
}
