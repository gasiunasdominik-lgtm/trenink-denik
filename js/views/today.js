// DNES: tartan s readiness, dnešní jednotky jako dráhy, razítko po zápisu, palcové CTA dole.
import { h, fmt } from '../ui/dom.js';
import { trackSvg } from '../ui/track-bg.js';
import * as store from '../data/store.js';
import { dayRows, bgFor } from '../calc/plan.js';
import { readiness, painMax } from '../calc/readiness.js';
import { loadMetrics, acwrZone } from '../calc/load.js';
import { today, isoWeek, dayOfYear, dowShort, dm, hm } from '../lib/dates.js';
import { openCheckin } from './checkin.js';
import { openDone } from './done.js';

let justStamped = null;

const signed = (n, d = 0, unit = '') => (n == null ? '' : `${n > 0 ? '+' : n < 0 ? '−' : '±'}${fmt(Math.abs(n), d)}${unit}`);

export function stamp(time, animate) {
  return h('span.stamp' + (animate ? '.new' : ''), { style: { '--r': `${-11 + ((time || '').charCodeAt(4) % 7)}deg` } }, 'Hotovo');
}

export function renderToday(datum = today()) {
  const s = store.getSettings();
  const w = store.wellness(datum);
  const r = readiness(store.wellness, datum, s.thresholds);
  const rows = dayRows(datum);
  const load = loadMetrics(store.units(), datum);
  const v = bgFor(datum);
  const wk = isoWeek(datum);

  const refresh = () => {}; // překreslení řeší subscribe v main.js

  // ---------- tartan ----------
  const state = w
    ? h('button.state', { type: 'button', on: { click: () => openCheckin(datum, refresh) }, 'aria-label': 'Upravit check-in' },
        r ? h('div.lights', { 'data-level': r.level }, [1, 2, 3, 4, 5].map(i => h('i', { class: i <= r.lights ? 'on' : '' }))) : null,
        h('b', r ? r.verdict : 'Check-in uložen'),
        h('small',
          [w.hrv != null && `HRV ${w.hrv} ms ${r?.hrvDelta != null ? signed(r.hrvDelta, 0, ' %') : ''}`, w.rhr != null && `tep ${w.rhr}${r?.rhrDelta != null && Math.abs(r.rhrDelta) >= 1 ? ` (${signed(r.rhrDelta)})` : ''}`].filter(Boolean).join(' · ') || null,
          h('br'),
          [w.spanek_h != null && `spánek ${hm(w.spanek_h)}`, ['unava', 'svaly', 'nalada'].every(k => w[k] != null) && `${w.unava}/${w.svaly}/${w.nalada}`].filter(Boolean).join(' · '),
          painMax(w) ? h('span.pain-note', h('br'), 'bolí: ', Object.keys(w.bolest).join(', ')) : null))
    : h('button.state.state-cta', { type: 'button', on: { click: () => openCheckin(datum, refresh) } },
        h('b', 'Ranní check-in'), h('small', 'HRV · tep · spánek · pocity', h('br'), '≈ 20 s'));

  const track = h(`section.track.bgv${v}`,
    h('div.track-bg', { html: trackSvg(v) }),
    h('div.meta', h('span', `${dowShort(datum)} ${dm(datum)} · T${wk.week}`), h('span', `Den ${dayOfYear(datum)}`)),
    state,
    r ? h('div.paint', r.score) : null,
    r ? h('div.paint-l', 'Readiness') : null,
  );

  // ---------- dráhy ----------
  const lanes = h('div.lanes',
    rows.map((row, i) => {
      const lane = h('button.lane' + (row.done ? '.done' : '') + (row.skipped ? '.skipped' : ''), {
        type: 'button', on: { click: () => openDone(row, datum, id => { justStamped = id; }) },
      },
        h('span.n', i + 1),
        h('span.t', row.nazev, h('small', row.done
          ? [`RPE ${row.rpe}`, `sRPE ${row.srpe ?? row.min * row.rpe}`, row.poznamka].filter(Boolean).join(' · ')
          : row.skipped ? 'vynecháno' : row.detail || '')),
        h('span.v', row.done ? row.min : row.min ?? row.plan?.min ?? '–', h('i', '′')),
        row.done ? stamp(row.ts, justStamped === row.id) : null,
      );
      return lane;
    }),
    h('button.lane.lane-add', { type: 'button', on: { click: () => openDone(null, datum, id => { justStamped = id; }) } },
      h('span.n', '+'), h('span.t', 'Jednotka navíc', h('small', 'mimo šablonu')), h('span.v')),
  );
  setTimeout(() => { justStamped = null; }, 600);

  const z = acwrZone(load.acwr);
  const bar = h('div.loadbar',
    h('span', 'ACWR', h('b', { 'data-zone': z }, load.acwr == null ? '–' : fmt(load.acwr, 2))),
    h('span', 'sRPE 7d', h('b', fmt(load.acute))),
    h('span', 'Mono', h('b', load.monotony == null ? '–' : fmt(load.monotony, 1))),
  );

  const banner = r?.overreaching
    ? h('div.alert', h('b', 'Overreaching flag'), ` HRV ↓ ≥ ${s.thresholds.hrvDropPct} %, tep ↑, horší spánek ${s.thresholds.days}+ dny. Zvaž lehký den a řekni trenérovi.`)
    : null;

  // ---------- CTA v dosahu palce ----------
  const nextRow = rows.find(x => !x.done && !x.skipped);
  const cta = !w
    ? h('button.cta', { on: { click: () => openCheckin(datum, refresh) } }, 'Ranní check-in')
    : nextRow
      ? h('button.cta', { on: { click: () => openDone(nextRow, datum, id => { justStamped = id; }) } },
          h('span', 'Hotovo'), h('small', nextRow.nazev))
      : h('button.cta.cta-quiet', { on: { click: () => openDone(null, datum, id => { justStamped = id; }) } }, 'Den splněn · + jednotka');

  return h('div.view.today', track, banner, lanes, bar, h('div.cta-wrap', cta));
}
