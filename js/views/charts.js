// GRAFY: zátěž (sRPE, ACWR), HRV a tep, spánek, heatmapa bolesti, progrese PB a testů, OTU po týdnech.
// Jeden přepínač období nahoře řídí všechny grafy.
import { h, fmt } from '../ui/dom.js';
import { timeChart, stackedWeeks, heatmap, COLORS } from '../ui/chart.js';
import { tap } from '../ui/haptics.js';
import * as store from '../data/store.js';
import { dailyLoads, loadMetrics, otu } from '../calc/load.js';
import { baseline } from '../calc/readiness.js';
import { results, allTests, testValues, DECATHLON, OTHER } from '../calc/perf.js';
import { formatPerf } from '../calc/wa.js';
import { today, addDays, range, weekStart, isoWeek, dm, hm, toKey } from '../lib/dates.js';
import { SEASON_START_MONTH } from '../config.js';
import { campsBetween, campOn } from '../calc/camps.js';

const PERIODS = [['4t', '4 týdny'], ['sezona', 'Sezóna'], ['rok', 'Rok']];
let period = '4t';

function periodRange() {
  const to = today();
  if (period === '4t') return { from: addDays(to, -27), to };
  if (period === 'rok') return { from: addDays(to, -364), to };
  const d = new Date();
  const y = d.getMonth() + 1 >= SEASON_START_MONTH ? d.getFullYear() : d.getFullYear() - 1;
  return { from: toKey(new Date(y, SEASON_START_MONTH - 1, 1)), to };
}

export function renderCharts(refresh) {
  const { from, to } = periodRange();
  const days = range(from, to);
  const units = store.units();
  const w = store.wellness;
  const t = store.getSettings().thresholds;

  const filter = h('nav.subtabs.sticky', PERIODS.map(([id, label]) =>
    h('button', { type: 'button', 'aria-pressed': String(period === id), on: { click: () => { period = id; tap(); refresh(); } } }, label)));

  // ---- soustředění v období
  const spans = campsBetween(from, to).map(c => ({ from: c.od, to: c.do, label: c.nazev }));

  // ---- zátěž
  const loads = dailyLoads(units);
  const acwr = days.map(d => ({ x: d, y: loadMetrics(units, d).acwr }));
  // porovnání: průměrná denní zátěž na soustředění vs. běžné dny (dny bez tréninku = 0)
  const past = days.filter(d => d <= to);
  const campDays = past.filter(d => campOn(d)), normalDays = past.filter(d => !campOn(d));
  const avg = ds => (ds.length ? ds.reduce((a, d) => a + (loads.get(d) || 0), 0) / ds.length : null);
  const compare = campDays.length
    ? h('div.otu-grid.compact.camp-compare',
        h('div.otu-c', h('b', fmt(avg(campDays))), h('span', 'SOUSTŘ.'), h('small', 'AU/den')),
        h('div.otu-c', h('b', normalDays.length ? fmt(avg(normalDays)) : '–'), h('span', 'BĚŽNĚ'), h('small', 'AU/den')),
        h('div.otu-c', h('b', campDays.length), h('span', 'DNY'), h('small', 'soustř.')),
        h('div.otu-c', h('b', normalDays.length && avg(normalDays) ? `${fmt((avg(campDays) / avg(normalDays) - 1) * 100)} %` : '–'), h('span', 'ROZDÍL'), h('small', 'zátěže')))
    : null;

  const load = [
    timeChart({ title: 'Denní zátěž', spans, note: 'sRPE = minuty × RPE', type: 'bar', from, to,
      points: days.map(d => ({ x: d, y: loads.get(d) || null })), unit: ' AU' }),
    timeChart({ title: 'ACWR 7/28', spans, note: 'pásmo 0,8–1,3 · nad 1,5 riziko', from, to, points: acwr,
      band: { from: 0.8, to: 1.3 }, refs: [{ y: 1.5, label: '1,5' }], yMin: 0, yFormat: v => fmt(v, 2),
      empty: 'ACWR se počítá od 7 tréninkových dnů v posledních 4 týdnech.' }),
  ];

  // ---- regenerace
  const hrvB = baseline(w, addDays(to, 1), 'hrv');
  const rhrB = baseline(w, addDays(to, 1), 'rhr');
  const recovery = [
    timeChart({ title: 'HRV', spans, note: 'mySASY', from, to, unit: ' ms', dots: period === '4t',
      points: days.map(d => ({ x: d, y: w(d)?.hrv ?? null })),
      refs: hrvB ? [{ y: hrvB, label: 'baseline 28 d' }] : [] }),
    timeChart({ title: 'Klidový tep', spans, from, to, unit: ' bpm', dots: period === '4t',
      points: days.map(d => ({ x: d, y: w(d)?.rhr ?? null })),
      refs: rhrB ? [{ y: rhrB, label: 'baseline 28 d' }] : [] }),
    timeChart({ title: 'Spánek', spans, note: 'hodiny', type: 'bar', from, to, yFormat: hm, refs: [{ y: 8, label: '8 h' }],
      points: days.map(d => ({ x: d, y: w(d)?.spanek_h ?? null, note: w(d)?.spanek_q ? `kvalita ${w(d).spanek_q}/5` : '' })) }),
  ];

  // ---- bolest
  const freq = new Map();
  days.forEach(d => Object.entries(w(d)?.bolest || {}).forEach(([p, v]) => v && freq.set(p, (freq.get(p) || 0) + 1)));
  const parts = [...freq.keys()].sort((a, b) => freq.get(b) - freq.get(a));
  const pain = heatmap({ title: 'Bolest podle partií', note: 'z ranního check-inu', rows: parts, from, to,
    value: (p, d) => Number(w(d)?.bolest?.[p] || 0) });

  // ---- progrese (všechny výsledky, malé grafy vedle sebe)
  const progDisc = [...DECATHLON, ...OTHER].map(d => ({ d, rs: results(d.id) })).filter(x => x.rs.length >= 2);
  const progTests = allTests().map(tt => ({ tt, vs: testValues(tt.id) })).filter(x => x.vs.length >= 2);
  const multiples = [
    ...progDisc.map(({ d, rs }) => timeChart({ title: d.label, note: `${rs.length} výsledků`, from: rs[0].datum, to: rs.at(-1).datum,
      dots: true, height: 90, yFormat: v => formatPerf(d.id, v), points: rs.map(r => ({ x: r.datum, y: r.vykon, note: r.zavod })) })),
    ...progTests.map(({ tt, vs }) => timeChart({ title: tt.name, note: `${vs.length} měření`, from: vs[0].datum, to: vs.at(-1).datum,
      dots: true, height: 90, unit: tt.unit ? ` ${tt.unit}` : '', yFormat: v => fmt(v, Number.isInteger(v) ? 0 : 2),
      points: vs.map(v => ({ x: v.datum, y: v.hodnota })) })),
  ];

  // ---- OTU po týdnech
  const weeks = [];
  for (let k = weekStart(from); k <= to; k = addDays(k, 7)) {
    const o = otu(units, k);
    weeks.push({ x: k, label: `T${isoWeek(k).week} (${dm(k)})`, values: { cz: o.cz, reg: o.reg }, o,
      camp: campsBetween(k, addDays(k, 6)).length > 0 });
  }
  const tot = weeks.reduce((a, wk) => ({ cz: a.cz + wk.o.cz, reg: a.reg + wk.o.reg, jed: a.jed + wk.o.jed, dny: a.dny + wk.o.dny, zav: a.zav + wk.o.zav }),
    { cz: 0, reg: 0, jed: 0, dny: 0, zav: 0 });

  return h('div.view.charts',
    h('header.page-head', h('h1', 'Grafy')),
    filter,
    h('section.ch-sect', h('h3.sect', 'Zátěž'), compare, load),
    h('section.ch-sect', h('h3.sect', 'Regenerace'), recovery),
    h('section.ch-sect', h('h3.sect', 'Bolest'), pain),
    h('section.ch-sect', h('h3.sect', 'Progrese'),
      multiples.length ? h('div.multiples', multiples) : h('p.muted', 'Graf se objeví u disciplíny se 2+ výsledky v Závodech a u testu se 2+ měřeními.')),
    h('section.ch-sect', h('h3.sect', period === 'rok' ? 'Roční OTU' : 'OTU po týdnech'),
      h('div.otu-grid.compact',
        ...[['ČZ', fmt(tot.cz), 'min'], ['REG', fmt(tot.reg), 'min'], ['DNY', tot.dny], ['JED', tot.jed]]
          .map(([l, v, u]) => h('div.otu-c', h('b', v), h('span', l), u ? h('small', u) : null))),
      stackedWeeks({ title: 'Minuty za týden', series: [
        { key: 'cz', label: 'ČZ', color: COLORS.primary },
        { key: 'reg', label: 'REG', color: COLORS.second }], data: weeks, unit: ' min' })),
  );
}
