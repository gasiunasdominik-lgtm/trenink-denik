// DNES: tartan s readiness, dnešní jednotky jako dráhy, razítko po zápisu, palcové CTA dole.
import { h, fmt } from '../ui/dom.js';
import { trackSvg } from '../ui/track-bg.js';
import * as store from '../data/store.js';
import { dayRows, bgFor } from '../calc/plan.js';
import { readiness, painMax } from '../calc/readiness.js';
import { loadMetrics, acwrZone } from '../calc/load.js';
import { today, isoWeek, dayOfYear, dowShort, dm, hm, addDays } from '../lib/dates.js';
import { TYPES } from '../config.js';
import { campOn } from '../calc/camps.js';
import { DAY_PARTS } from '../calc/plan.js';
import { openCheckin } from './checkin.js';
import { openDone } from './done.js';

let justStamped = null;

const signed = (n, d = 0, unit = '') => (n == null ? '' : `${n > 0 ? '+' : n < 0 ? '−' : '±'}${fmt(Math.abs(n), d)}${unit}`);

export function stamp(time, animate) {
  return h('span.stamp' + (animate ? '.new' : ''), { style: { '--r': `${-11 + ((time || '').charCodeAt(4) % 7)}deg` } }, 'Hotovo');
}

/** @param opts.onDay(datum) přepnutí dne (přepínač ‹ ›) */
export function renderToday(datum = today(), { onDay } = {}) {
  const s = store.getSettings();
  const w = store.wellness(datum);
  const r = readiness(store.wellness, datum, s.thresholds);
  const rows = dayRows(datum);
  const load = loadMetrics(store.units(), datum);
  const v = bgFor(datum);
  const wk = isoWeek(datum);
  const camp = campOn(datum);
  const partLabel = k => DAY_PARTS.find(([key]) => key === k)?.[1];

  const refresh = () => {}; // překreslení řeší subscribe v main.js

  // ---------- tartan ----------
  const state = w
    ? h('button.state', { type: 'button', on: { click: () => openCheckin(datum, refresh) }, 'aria-label': 'Upravit check-in' },
        r ? h('div.lights', { 'data-level': r.level }, [1, 2, 3, 4, 5].map(i => h('i', { class: i <= r.lights ? 'on' : '' }))) : null,
        h('b', r ? r.verdict : 'Check-in uložen'),
        h('small',
          [w.hrv != null && `HRV ${w.hrv} ms ${r?.hrvDelta != null ? signed(r.hrvDelta, 0, ' %') : ''}`, w.rhr != null && `tep ${w.rhr}${r?.rhrDelta != null && Math.abs(r.rhrDelta) >= 1 ? ` (${signed(r.rhrDelta)})` : ''}`].filter(Boolean).join(' · ') || null,
          h('br'),
          [w.spanek_h != null && `spánek ${hm(w.spanek_h)}${w.v_posteli_h != null ? ` / ${hm(w.v_posteli_h)}` : ''}`, ['unava', 'svaly', 'nalada'].every(k => w[k] != null) && `${w.unava}/${w.svaly}/${w.nalada}`].filter(Boolean).join(' · '),
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

  // ---------- přepínač dne (zápis a úpravy zpětně) ----------
  const isToday = datum === today();
  const dayswitch = onDay ? h('nav.dayswitch', { 'aria-label': 'Přepnout den' },
    h('button', { type: 'button', 'aria-label': 'Předchozí den', on: { click: () => onDay(addDays(datum, -1)) } }, '‹'),
    h('span', isToday ? `Dnes · ${dowShort(datum)} ${dm(datum)}` : `${dowShort(datum)} ${dm(datum)}`),
    h('button', { type: 'button', 'aria-label': 'Další den', disabled: isToday, on: { click: () => onDay(addDays(datum, 1)) } }, '›'),
  ) : null;

  // ---------- dráhy ----------
  const lanes = h('div.lanes',
    rows.map((row, i) => {
      const lane = h('button.lane' + (row.done ? '.done' : '') + (row.skipped ? '.skipped' : ''), {
        type: 'button', on: { click: () => openDone(row, datum, id => { justStamped = id; }) },
      },
        h('span.n', i + 1),
        h('span.t', row.nazev, h('small', row.done
          ? [partLabel(row.faze_dne), `RPE ${row.rpe}`, row.obsah || row.poznamka].filter(Boolean).join(' · ')
          : row.skipped ? 'vynecháno – ťukni pro zápis' : row.detail || '')),
        h('span.v', row.done ? row.min : row.min ?? row.plan?.min ?? '–', h('i', '′')),
        row.done ? stamp(row.ts, justStamped === row.id) : null,
      );
      return lane;
    }),
    h('button.lane.lane-add', { type: 'button', on: { click: () => openDone(null, datum, id => { justStamped = id; }) } },
      h('span.n', '+'), h('span.t', camp ? 'Jednotka' : 'Jednotka navíc', h('small', camp ? 'typ, minuty, RPE, obsah' : 'mimo šablonu')), h('span.v')),
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

  const dev = store.getDevice();
  const connect = !(dev.apiUrl && dev.token)
    ? h('a.connect', { href: '#nastaveni' },
        h('b', 'Propojit Google Sheet'),
        h('small', 'Zápisy jsou zatím jen v telefonu. Nastavení → Google Sheet → URL a token.'))
    : null;

  // ---------- CTA v dosahu palce ----------
  // hlavní trénink před mobilitou; ranní check-in nabídne jen dnes dopoledne (jinak je v rámečku na tartanu)
  const open = rows.filter(x => !x.done && !x.skipped);
  const nextRow = open.find(x => !TYPES[x.typ]?.reg) ?? open[0];
  const checkinFirst = !w && isToday && new Date().getHours() < 12;
  const addUnit = () => openDone(null, datum, id => { justStamped = id; });
  const cta = camp && !checkinFirst
    ? h('button.cta', { on: { click: addUnit } }, h('span', '+ Jednotka'), h('small', `soustředění · den ${camp.day}/${camp.total}`))
    : checkinFirst
    ? h('button.cta', { on: { click: () => openCheckin(datum, refresh) } }, 'Ranní check-in')
    : nextRow
      ? h('button.cta', { on: { click: () => openDone(nextRow, datum, id => { justStamped = id; }) } },
          h('span', 'Hotovo'), h('small', nextRow.nazev))
      : h('button.cta.cta-quiet', { on: { click: () => openDone(null, datum, id => { justStamped = id; }) } }, 'Den splněn · + jednotka');

  const campStrip = camp
    ? h('div.camp-strip', h('b', `Soustředění · den ${camp.day}/${camp.total}`),
        h('span', [camp.camp.nazev, camp.camp.misto].filter(Boolean).join(' · ')),
        h('small', 'Bez týdenní šablony – jednotky přidávej tlačítkem + Jednotka.'))
    : null;

  return h('div.view.today' + (camp ? '.camp' : ''), track, campStrip, connect, banner, dayswitch, lanes, bar, h('div.cta-wrap', cta));
}
