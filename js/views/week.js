// TÝDEN: 7 drah (Po–Ne), OTU jako výsledková tabule, zhodnocení a karta Claude reportu.
import { h, fmt } from '../ui/dom.js';
import * as store from '../data/store.js';
import { dayRows } from '../calc/plan.js';
import { readiness } from '../calc/readiness.js';
import { otu, loadMetrics, srpe, acwrZone, isReg } from '../calc/load.js';
import { weekDays, isoWeek, dowShort, dm, today } from '../lib/dates.js';

export function renderWeek(anchor, { onDay, onShift }) {
  const days = weekDays(anchor);
  const wk = isoWeek(anchor);
  const s = store.getSettings();
  const all = store.units();
  const o = otu(all, anchor);
  const end = days[6] < today() ? days[6] : today();
  const load = loadMetrics(all, end);
  const t = today();

  const head = h('header.wk-head',
    h('button.wk-nav', { 'aria-label': 'Předchozí týden', on: { click: () => onShift(-7) } }, '‹'),
    h('div.wk-bib', h('small', `${wk.year} · týden`), h('b', wk.week), h('span', `${dm(days[0])} – ${dm(days[6])}`)),
    h('button.wk-nav', { 'aria-label': 'Další týden', on: { click: () => onShift(7) }, disabled: days[6] >= t }, '›'),
  );

  const lanes = h('div.wk-lanes', days.map(d => {
    const rows = dayRows(d);
    const doneRows = rows.filter(r => r.done);
    const r = readiness(store.wellness, d, s.thresholds);
    const min = doneRows.reduce((a, x) => a + (x.min || 0), 0);
    const load = doneRows.reduce((a, x) => a + srpe(x), 0);
    const future = d > t;
    const main = rows.filter(x => !x.skipped && !isReg(x));
    const regMin = doneRows.filter(isReg).reduce((a, x) => a + (x.min || 0), 0);
    return h('button.wk-lane' + (d === t ? '.is-today' : '') + (future ? '.future' : ''), { type: 'button', on: { click: () => onDay(d) } },
      h('span.wk-dow', dowShort(d), h('small', dm(d))),
      h('span.wk-units', main.length ? main.map(x => h('span.wk-u' + (x.done ? '.done' : ''), x.nazev)) : h('span.wk-u.rest', 'Volno'),
        regMin ? h('span.wk-reg', `+ REG ${regMin}′`) : null),
      h('span.wk-r', r ? h('b', { 'data-level': r.level }, r.score) : h('i', future ? '' : '–')),
      h('span.wk-min', min ? fmt(min) : '', h('small', load ? `${fmt(load)}` : '')),
    );
  }));

  const cell = (label, value, hint) => h('div.otu-c', h('b', value), h('span', label), hint ? h('small', hint) : null);
  const board = h('section.otu',
    h('h3.sect', 'OTU týdne'),
    h('div.otu-grid',
      cell('ČZ', fmt(o.cz), 'min'), cell('REG', fmt(o.reg), 'min'), cell('DNY', o.dny), cell('JED', o.jed),
      cell('ZO', o.zo, 'dny'), cell('ZN', o.zn, 'dny'), cell('ZÁV', o.zav, 'starty'),
      cell('sRPE', fmt(o.srpe), 'AU')),
    h('details.otu-help', h('summary', 'Co znamenají zkratky'),
      h('dl', [['ČZ', 'celkový čas zatížení – všechny tréninkové jednotky kromě regenerace'],
        ['REG', 'čas na regeneraci a protahování (mobilita, sauna, masáž + REG min zapsané u jednotek)'],
        ['DNY', 'dny s tréninkem'], ['JED', 'tréninkové jednotky, dvoufázový den = 2'],
        ['ZO', 'dny se zdravotním omezením'], ['ZN', 'dny nemoci nebo zranění'], ['ZÁV', 'závodní starty'],
        ['sRPE', 'minuty × RPE, součet za týden']].map(([k, v]) => [h('dt', k), h('dd', v)]))),
    h('div.loadbar',
      h('span', 'ACWR', h('b', { 'data-zone': acwrZone(load.acwr) }, load.acwr == null ? '–' : fmt(load.acwr, 2))),
      h('span', 'Mono', h('b', load.monotony == null ? '–' : fmt(load.monotony, 1))),
      h('span', 'Strain', h('b', load.strain == null ? '–' : fmt(load.strain)))),
  );

  const rec = store.week(wk.key);
  const note = h('textarea.text-in.wk-note', { rows: 4, placeholder: 'Co fungovalo, co ne, jak tělo, co příští týden…' }, rec?.zhodnoceni || '');
  note.addEventListener('change', () => store.saveWeek({ tyden: wk.key, zhodnoceni: note.value }));

  const report = store.reports()
    .filter(x => x.tyden === wk.key)
    .sort((a, b) => (b.ts || '').localeCompare(a.ts || ''))[0];

  return h('div.view.week', head, lanes, board,
    h('section.wk-eval', h('h3.sect', 'Zhodnocení týdne'), note),
    h('section.report',
      h('h3.sect', 'Claude · nedělní analýza'),
      report
        ? h('article.report-card', h('small', [report.datum, report.titulek].filter(Boolean).join(' · ')),
            reportBody(report.text))
        : h('p.muted', days[6] <= t
            ? 'Report pro tento týden zatím není. Píše ho naplánovaná úloha Clauda v neděli večer.'
            : 'Report přijde v neděli večer.')),
  );
}

/** Jednoduchý markdown z reportu: ## nadpis, - odrážky, **tučně**. Vkládá se jako text, ne HTML. */
function reportBody(text) {
  const inline = line => line.split(/(\*\*[^*]+\*\*)/).map(part =>
    part.startsWith('**') && part.endsWith('**') ? h('b', part.slice(2, -2)) : part);
  const out = [];
  let list = null;
  String(text || '').split('\n').forEach(raw => {
    const line = raw.trim();
    if (/^[-•]\s+/.test(line)) {
      list ??= h('ul');
      list.append(h('li', inline(line.replace(/^[-•]\s+/, ''))));
      return;
    }
    if (list) { out.push(list); list = null; }
    if (!line) return;
    if (line.startsWith('#')) out.push(h('h4', line.replace(/^#+\s*/, '')));
    else out.push(h('p', inline(line)));
  });
  if (list) out.push(list);
  return out;
}
