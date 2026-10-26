// VÝKON: PB a plány (desetibojový výsledkový list), závody s body WA, testy, tělesné míry.
import { h, fmt } from '../ui/dom.js';
import { openSheet } from '../ui/sheet.js';
import { field, numField } from '../ui/inputs.js';
import { sparkline } from '../ui/chart.js';
import { celebratePB } from '../ui/celebrate.js';
import { tap } from '../ui/haptics.js';
import * as store from '../data/store.js';
import { DISCIPLINES, TEST_CATEGORIES } from '../config.js';
import { disc, parsePerf, formatPerf, points, better } from '../calc/wa.js';
import { DECATHLON, OTHER, pbOf, isPbResult, best, decathlonSums, allTests, testValues, asymmetry } from '../calc/perf.js';
import { today, dm, fromKey } from '../lib/dates.js';

const SUBS = [['pb', 'PB'], ['zavody', 'Závody'], ['testy', 'Testy'], ['telo', 'Tělo']];
let sub = 'pb';

const year = () => new Date().getFullYear();
const dmy = k => (k ? `${dm(k)}${fromKey(k).getFullYear()}` : '–');
const WIND = ['100', '200', '110pr', 'dalka', '60pr'];

/** @param refresh překreslí aktuální záložku (main.render) */
export function renderPerformance(refresh) {
  const tabs = h('nav.subtabs', SUBS.map(([id, label]) =>
    h('button', { type: 'button', 'aria-pressed': String(sub === id), on: { click: () => { sub = id; tap(); refresh(); } } }, label)));
  const body = h('div.perf-body', { pb: viewPB, zavody: viewResults, testy: viewTests, telo: viewBody }[sub]());
  return h('div.view.perf', h('header.page-head', h('h1', 'Výkon')), tabs, oldScriptNote(), body);
}

function oldScriptNote() {
  const dev = store.getDevice();
  if (!dev.apiUrl || (dev.serverVersion || 0) >= 2) return null;
  return h('p.note-warn', 'Apps Script v Google Sheets je starší verze: výsledky a testy se do Sheetu zapíšou, ale z jiného zařízení se nenačtou. Nasaď novou verzi (návod v README, „Aktualizace skriptu“).');
}

// ---------------------------------------------------------------- PB
function viewPB() {
  const sums = decathlonSums();
  const realPB = pbOf('desetiboj');
  const hero = h('section.dec-hero',
    h('div', h('small', 'Desetiboj · PB'), h('b', realPB.pb != null ? fmt(realPB.pb) : '–'), h('span', realPB.pb_datum ? dmy(realPB.pb_datum) : 'zadej v řádku Desetiboj')),
    h('div', h('small', `Součet osobáků (${sums.pbN}/10)`), h('b', sums.pbN ? fmt(sums.pb) : '–'), h('span', sums.planN ? `plán letos ${fmt(sums.plan)} (${sums.planN}/10)` : 'plán zatím nezadán')),
  );

  const lanes = h('div.dec-lanes', DECATHLON.map((d, i) => {
    const r = pbOf(d.id);
    const p = r.pb != null ? points(d.id, r.pb) : null;
    const pp = r.plan_letos != null ? points(d.id, r.plan_letos) : null;
    // výkon letos: lepší z výsledků v Závodech a sloupce vykon_letos (Cowork ho bere i z disciplín s jiným názvem)
    const fromRes = best(d.id, year())?.vykon;
    const letos = fromRes == null ? r.vykon_letos : r.vykon_letos == null || better(d.id, fromRes, r.vykon_letos) ? fromRes : r.vykon_letos;
    return h('button.dec-lane', { type: 'button', on: { click: () => editPB(d.id) } },
      h('span.n', i + 1),
      h('span.dl',
        h('span.dl-top', h('b', d.label), h('span.pbv', formatPerf(d.id, r.pb))),
        h('span.dl-bar', h('i', { style: { width: `${Math.min(100, (p || 0) / 10)}%` } }),
          pp != null ? h('em', { style: { left: `${Math.min(100, pp / 10)}%` }, title: 'plán' }) : null),
        h('small', [`letos ${formatPerf(d.id, letos)}`, `plán ${formatPerf(d.id, r.plan_letos)}`,
          `příští ${formatPerf(d.id, r.plan_pristi)}`].join(' · ')),
        venkuHala(d.id, r),
        records(d.id, r)),
      h('span.pts', p != null ? p : '–'));
  }));

  const others = h('div.pb-list', OTHER.map(d => {
    const r = pbOf(d.id);
    return h('button.pb-row', { type: 'button', on: { click: () => editPB(d.id) } },
      h('b', d.label), h('span', formatPerf(d.id, r.pb)), h('small', r.pb_datum ? dmy(r.pb_datum) : ''), records(d.id, r));
  }));

  return [hero,
    h('p.legend-line', h('i.lg-bar'), 'body z PB (0–1000)', h('i.lg-tick'), 'plán letos'),
    lanes, h('h3.sect.pad', 'Další disciplíny'), others,
    h('p.muted.pad', 'Body podle tabulek World Athletics. PB se doplní samo z výsledků v Závodech, ručně ho přepíšeš ťuknutím na řádek.')];
}

/** PB venku / v hale (sloupce od Cowork úlohy) – jen když jsou vyplněné. */
function venkuHala(id, r) {
  const one = (label, v, d) => (v != null ? `${label} ${formatPerf(id, v)}${d ? ` (${dmy(d)})` : ''}` : null);
  const txt = [one('venku', r.pb_venku, r.pb_venku_datum), one('hala', r.pb_hala, r.pb_hala_datum)].filter(Boolean).join(' · ');
  return txt ? h('small.records', txt) : null;
}

/** Řádek s rekordy pod disciplínou – jen když jsou vyplněné. */
function records(id, r) {
  const one = (label, v, who) => (v != null ? `${label} ${formatPerf(id, v)}${who ? ` (${who})` : ''}` : null);
  const txt = [one('Český rekord', r.rekord_cr, r.rekord_cr_drzitel), one('Světový rekord', r.rekord_sr, r.rekord_sr_drzitel)].filter(Boolean).join(' · ');
  return txt ? h('small.records', txt) : null;
}

function editPB(id) {
  const d = disc(id);
  const r = { ...pbOf(id), disciplina: id };
  const perfIn = (key, label) => {
    const inp = h('input.text-in', { value: r[key] != null ? formatPerf(id, r[key]) : '', inputmode: 'decimal', placeholder: d.kind === 'time' ? 'např. 10,95 nebo 4:35,20' : d.kind === 'points' ? 'body' : 'm, např. 7,12' });
    const hint = h('small.perf-hint');
    const upd = () => {
      const v = parsePerf(id, inp.value);
      r[key] = v;
      hint.textContent = inp.value && v == null ? 'neplatný zápis' : v != null && d.wa ? `${points(id, v)} b.` : '';
    };
    inp.addEventListener('input', upd);
    upd();
    return field(label, h('div', inp, hint));
  };
  const textIn = (key, label, placeholder) =>
    field(label, h('input.text-in', { value: r[key] || '', placeholder, on: { input: e => (r[key] = e.target.value.trim() || null) } }));
  const sheet = openSheet({ title: d.label, full: true, body: [
    perfIn('pb', 'Osobní rekord'),
    r.pb_zavod ? h('p.muted', `PB: ${r.pb_zavod}`) : null,
    perfIn('pb_venku', 'PB venku'),
    perfIn('pb_hala', 'PB v hale'),
    field('Datum PB', h('input.text-in', { type: 'date', value: r.pb_datum || '', on: { change: e => (r.pb_datum = e.target.value) } })),
    perfIn('plan_letos', `Plán ${year()}`),
    perfIn('plan_pristi', `Plán ${year() + 1}`),
    perfIn('rekord_cr', 'Český rekord'),
    textIn('rekord_cr_drzitel', 'Držitel českého rekordu', 'jméno, rok'),
    perfIn('rekord_sr', 'Světový rekord'),
    textIn('rekord_sr_drzitel', 'Držitel světového rekordu', 'jméno, rok'),
    perfIn('rekord_cr_u23', 'Český rekord U23'),
    textIn('rekord_cr_u23_drzitel', 'Držitel českého rekordu U23', 'jméno, rok'),
    perfIn('rekord_cr_u20', 'Český rekord U20'),
    textIn('rekord_cr_u20_drzitel', 'Držitel českého rekordu U20', 'jméno, rok'),
    perfIn('rekord_sr_u20', 'Světový rekord U20'),
    textIn('rekord_sr_u20_drzitel', 'Držitel světového rekordu U20', 'jméno, rok'),
    h('div.sheet-actions', h('button.btn-primary', { on: { click: async () => { await store.saveRow('pb', r); sheet.close(); } } }, 'Uložit')),
  ] });
}

// ---------------------------------------------------------------- Závody
function viewResults() {
  const all = store.rows('zavody').sort((a, b) => b.datum.localeCompare(a.datum) || (disc(a.disciplina)?.dec ?? 99) - (disc(b.disciplina)?.dec ?? 99));
  const groups = new Map();
  all.forEach(r => {
    const k = `${r.datum.slice(0, 7)}|${r.zavod || ''}`;
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(r);
  });

  return [
    h('div.pad', h('button.btn-primary', { on: { click: () => editResult(null) } }, '+ Výsledek')),
    groups.size ? null : h('p.muted.pad', 'Zatím žádné výsledky. Body se počítají samy podle tabulek WA, PB se hlídá automaticky.'),
    ...[...groups.values()].map(g => {
      const rows = [...g].sort((a, b) => a.datum.localeCompare(b.datum) || (disc(a.disciplina)?.dec ?? 99) - (disc(b.disciplina)?.dec ?? 99));
      const multi = rows.filter(r => disc(r.disciplina)?.dec);
      const sum = multi.reduce((a, r) => a + (r.body || 0), 0);
      return h('section.meet',
        h('header.meet-h', h('b', rows[0].zavod || 'Bez názvu'), h('span', [dmy(rows[0].datum), rows[0].misto].filter(Boolean).join(' · ')),
          multi.length >= 2 ? h('strong', `Σ ${fmt(sum)} b.`, h('small', ` ${multi.length}/10`)) : null),
        rows.map(r => h('button.res', { type: 'button', on: { click: () => editResult(r) } },
          h('span.res-d', disc(r.disciplina)?.label || r.disciplina, isPbResult(r) ? h('span.res-pb', 'PB') : null,
            r.poznamka ? h('small.res-note', r.poznamka) : null),
          h('span.res-v', r.vykon_txt || formatPerf(r.disciplina, r.vykon), r.rucne ? h('small', ' r.') : null,
            r.vitr != null ? h('small', ` ${r.vitr > 0 ? '+' : ''}${fmt(r.vitr, 1)}`) : null),
          h('span.res-p', r.poradi ? `${r.poradi}.` : ''),
          h('span.res-b', r.body ?? points(r.disciplina, r.vykon, { hand: !!r.rucne }) ?? ''))));
    }),
  ];
}

function editResult(existing) {
  const r = existing ? { ...existing } : { id: `z-${Date.now().toString(36)}`, datum: today(), disciplina: '100' };
  const meets = [...new Set(store.rows('zavody').map(x => x.zavod).filter(Boolean))];
  const perf = h('input.text-in.perf-in', { value: r.vykon != null ? formatPerf(r.disciplina, r.vykon) : '', inputmode: 'decimal', placeholder: 'výkon' });
  const preview = h('div.perf-preview');
  const handBox = h('label.check', h('input', { type: 'checkbox', checked: !!r.rucne, on: { change: e => { r.rucne = e.target.checked ? 1 : 0; upd(); } } }), 'ruční čas');
  const windBox = field('Vítr (m/s)', numField({ value: r.vitr, decimal: true, unit: 'm/s', onInput: v => (r.vitr = v) }));

  function upd() {
    const d = disc(r.disciplina);
    r.vykon = parsePerf(r.disciplina, perf.value);
    r.body = r.vykon != null && d.wa ? points(r.disciplina, r.vykon, { hand: !!r.rucne }) : null;
    const pb = pbOf(r.disciplina);
    const isPB = r.vykon != null && (!existing || existing.vykon !== r.vykon) && better(r.disciplina, r.vykon, pb.pb);
    preview.replaceChildren(
      h('b', r.vykon == null ? (perf.value ? 'neplatný zápis' : '–') : formatPerf(r.disciplina, r.vykon)),
      r.body != null ? h('span', `${r.body} b.`) : null,
      isPB ? h('em', pb.pb != null ? 'nový PB' : 'první zápis') : pb.pb != null ? h('small', `PB ${formatPerf(r.disciplina, pb.pb)}`) : null);
    handBox.hidden = d.kind !== 'time' || !d.hand;
    windBox.hidden = !WIND.includes(r.disciplina);
    perf.placeholder = d.kind === 'time' ? 'např. 10,95 nebo 4:35,20' : d.kind === 'points' ? 'body' : 'm, např. 7,12';
  }
  perf.addEventListener('input', upd);

  const sheet = openSheet({ title: existing ? 'Upravit výsledek' : 'Nový výsledek', full: true, body: [
    field('Datum', h('input.text-in', { type: 'date', value: r.datum, on: { change: e => (r.datum = e.target.value) } })),
    field('Závod', h('div', h('input.text-in', { value: r.zavod || '', list: 'meets', placeholder: 'např. MČR vícebojů', on: { input: e => (r.zavod = e.target.value) } }),
      h('datalist#meets', meets.map(m => h('option', { value: m }))))),
    field('Místo', h('input.text-in', { value: r.misto || '', placeholder: 'město / stadion', on: { input: e => (r.misto = e.target.value) } })),
    field('Disciplína', h('select.sel', { on: { change: e => { r.disciplina = e.target.value; upd(); } } },
      DISCIPLINES.map(d => h('option', { value: d.id, selected: d.id === r.disciplina }, d.label)))),
    field('Výkon', h('div', perf, preview, handBox)),
    windBox,
    field('Pořadí', numField({ value: r.poradi, onInput: v => (r.poradi = v) })),
    field('Poznámka', h('input.text-in', { value: r.poznamka || '', on: { input: e => (r.poznamka = e.target.value) } })),
    h('div.sheet-actions',
      h('button.btn-primary', { on: { click: save } }, 'Uložit'),
      existing ? h('button.btn-ghost', { on: { click: remove } }, 'Smazat') : null),
  ] });
  upd();

  async function remove() {
    sheet.close();
    await store.deleteRow('zavody', existing.id);
    // pokud byl smazaný výsledek zdrojem PB, vrátit PB na nejlepší zbylý výsledek
    const pbRow = store.row('pb', existing.disciplina);
    if (pbRow && pbRow.pb === existing.vykon && pbRow.pb_datum === existing.datum) {
      const next = best(existing.disciplina);
      await store.saveRow('pb', { ...pbRow, pb: next?.vykon ?? null, pb_datum: next?.datum ?? null });
    }
  }

  async function save() {
    if (r.vykon == null) { perf.focus(); perf.classList.add('shake'); setTimeout(() => perf.classList.remove('shake'), 400); return; }
    const d = disc(r.disciplina);
    const prev = pbOf(r.disciplina);
    const isPB = better(r.disciplina, r.vykon, prev.pb) && (!existing || existing.vykon !== r.vykon);
    r.vykon_txt = formatPerf(r.disciplina, r.vykon);
    sheet.close();
    await store.saveRow('zavody', r);
    if (isPB) {
      await store.saveRow('pb', { ...(store.row('pb', r.disciplina) || { disciplina: r.disciplina }), pb: r.vykon, pb_datum: r.datum });
      const diff = prev.pb != null ? Math.abs(r.vykon - prev.pb) : null;
      celebratePB({
        discipline: d.label,
        value: formatPerf(r.disciplina, r.vykon),
        previous: prev.pb != null ? formatPerf(r.disciplina, prev.pb) : null,
        delta: diff != null ? `${d.kind === 'time' ? '−' : '+'}${fmt(diff, d.kind === 'points' ? 0 : 2)}` : null,
        points: r.body,
        bg: d.kind === 'time' ? 4 : d.kind === 'points' ? 8 : 10,
      });
    }
  }
}

// ---------------------------------------------------------------- Testy
function viewTests() {
  const tests = allTests();
  const cats = Object.keys(TEST_CATEGORIES).filter(c => tests.some(t => t.cat === c));
  const asym = [['CMJ', 'cmj_l', 'cmj_p'], ['RSI', 'rsi_l', 'rsi_p'], ['Hamstring', 'ham_iso_l', 'ham_iso_p'], ['SL drop jump', 'sldj_h_l', 'sldj_h_p'], ['Flexe kyčle', 'hipflex_rfd_l', 'hipflex_rfd_p']]
    .map(([l, a, b]) => [l, asymmetry(a, b)]).filter(([, v]) => v != null);

  return [
    asym.length ? h('section.asym.pad', h('h3.sect', 'Asymetrie L/P (poslední měření)'),
      h('div.asym-row', asym.map(([l, v]) => h('div', h('b', { 'data-warn': String(Math.abs(v) > 10) }, `${v > 0 ? '+' : '−'}${fmt(Math.abs(v), 0)} %`), h('span', l),
        h('small', v < 0 ? 'levá slabší' : v > 0 ? 'pravá slabší' : 'vyrovnané'))))) : null,
    ...cats.map(c => h('section.tests',
      h('h3.sect.pad', TEST_CATEGORIES[c]),
      tests.filter(t => t.cat === c).map(t => {
        const vals = testValues(t.id);
        const last = vals.at(-1);
        const bestV = vals.length ? (t.lower ? Math.min : Math.max)(...vals.map(v => v.hodnota)) : null;
        return h('button.test-row', { type: 'button', on: { click: () => editTest(t) } },
          h('span.tn', t.name, h('small', last ? `${dmy(last.datum)} · ${vals.length}×` : 'bez měření')),
          sparkline(vals.map(v => v.hodnota), { lower: t.lower }),
          h('span.tv', last ? fmtVal(last.hodnota) : '–', h('small', t.unit),
            bestV != null && vals.length > 1 ? h('em', `nej ${fmtVal(bestV)}`) : null));
      }))),
    h('div.pad', h('button.btn-ghost', { on: { click: newTest } }, '+ Vlastní test')),
  ];
}

const fmtVal = v => fmt(v, Number.isInteger(v) ? 0 : 2);

function editTest(t) {
  const vals = testValues(t.id).reverse();
  const r = { id: `t-${Date.now().toString(36)}`, datum: today(), test: t.id, kategorie: t.cat, jednotka: t.unit };
  const sheet = openSheet({ title: t.name, full: true, body: [
    field('Datum', h('input.text-in', { type: 'date', value: r.datum, on: { change: e => (r.datum = e.target.value) } })),
    field(`Hodnota${t.unit ? ` (${t.unit})` : ''}`, numField({ decimal: true, unit: t.unit, onInput: v => (r.hodnota = v) }), t.lower ? 'menší = lepší' : 'větší = lepší'),
    field('Poznámka', h('input.text-in', { placeholder: t.id === 'forcedecks' ? 'metrika, např. peak power' : '', on: { input: e => (r.poznamka = e.target.value) } })),
    h('div.sheet-actions', h('button.btn-primary', { on: { click: async () => {
      if (r.hodnota == null) return;
      sheet.close();
      await store.saveRow('testy', r);
    } } }, 'Uložit měření')),
    vals.length ? h('h3.sect', { style: { marginTop: '22px' } }, 'Historie') : null,
    h('div.hist', vals.map(v => h('div.hist-row', h('span', dmy(v.datum)), h('b', fmtVal(v.hodnota)), h('small', v.poznamka || ''),
      h('button.btn-x', { 'aria-label': 'Smazat měření', on: { click: async e => { await store.deleteRow('testy', v.id); e.target.closest('.hist-row').remove(); } } }, '×')))),
  ] });
}

function newTest() {
  const t = { id: `v_${Date.now().toString(36)}`, name: '', unit: '', lower: false, cat: 'vlastni' };
  const sheet = openSheet({ title: 'Vlastní test', body: [
    field('Název', h('input.text-in', { placeholder: 'např. Odrazy 5× L', on: { input: e => (t.name = e.target.value) } })),
    field('Jednotka', h('input.text-in', { placeholder: 'cm, s, kg…', on: { input: e => (t.unit = e.target.value) } })),
    h('label.check', h('input', { type: 'checkbox', on: { change: e => (t.lower = e.target.checked) } }), 'menší hodnota je lepší (čas)'),
    h('div.sheet-actions', h('button.btn-primary', { on: { click: async () => {
      if (!t.name.trim()) return;
      const s = store.getSettings();
      await store.saveSettings({ customTests: [...(s.customTests || []), t] });
      sheet.close();
    } } }, 'Přidat test')),
  ] });
}

// ---------------------------------------------------------------- Tělo
function viewBody() {
  const rows = store.rows('miry').sort((a, b) => b.datum.localeCompare(a.datum));
  const last = k => rows.find(r => r[k] != null);
  const rhr = store.wellnessAll().filter(w => w.rhr != null).sort((a, b) => b.datum.localeCompare(a.datum))[0];
  const tile = (label, row, k, unit, d = 1) => h('div.tile', h('small', label), h('b', row ? fmt(row[k], d) : '–', h('i', unit)),
    h('span', row ? dmy(row.datum) : ''));
  return [
    h('div.tiles.pad',
      tile('Váha', last('vaha'), 'vaha', 'kg'),
      tile('% tuku', last('tuk_pct'), 'tuk_pct', '%'),
      tile('Výška', last('vyska'), 'vyska', 'cm', 0),
      tile('Klidový tep', last('rhr') || rhr, 'rhr', 'bpm', 0)),
    h('div.pad', h('button.btn-primary', { on: { click: () => editBody(rows[0]) } }, '+ Měření')),
    rows.length ? h('div.hist.pad', h('div.hist-row.head', h('span', 'Datum'), h('span', 'kg'), h('span', '% tuku'), h('span', 'tep')),
      rows.map(r => h('button.hist-row', { type: 'button', on: { click: () => editBody(r, r) } },
        h('span', dmy(r.datum)), h('b', fmt(r.vaha, 1)), h('span', fmt(r.tuk_pct, 1)), h('span', fmt(r.rhr))))) : null,
  ];
}

/** @param prev poslední měření (předvyplní výšku a nápovědy) · @param existing upravovaný řádek */
function editBody(prev, existing) {
  const r = existing ? { ...existing } : { datum: today(), vyska: prev?.vyska ?? null };
  const sheet = openSheet({ title: existing ? `Míry ${dmy(existing.datum)}` : 'Tělesné míry', full: true, body: [
    field('Datum', h('input.text-in', { type: 'date', value: r.datum, on: { change: e => (r.datum = e.target.value) } })),
    field('Váha', numField({ decimal: true, unit: 'kg', value: r.vaha, placeholder: prev?.vaha ?? '', onInput: v => (r.vaha = v) })),
    field('% tuku', numField({ decimal: true, unit: '%', value: r.tuk_pct, placeholder: prev?.tuk_pct ?? '', onInput: v => (r.tuk_pct = v) })),
    field('Výška', numField({ value: r.vyska, unit: 'cm', onInput: v => (r.vyska = v) })),
    field('Klidový tep', numField({ unit: 'bpm', value: r.rhr, placeholder: store.wellness(today())?.rhr ?? '', onInput: v => (r.rhr = v) })),
    h('div.sheet-actions',
      h('button.btn-primary', { on: { click: async () => {
        sheet.close();
        if (existing && existing.datum !== r.datum) await store.deleteRow('miry', existing.datum); // datum je klíč
        await store.saveRow('miry', r);
      } } }, 'Uložit'),
      existing ? h('button.btn-ghost', { on: { click: async () => { sheet.close(); await store.deleteRow('miry', existing.datum); } } }, 'Smazat') : null),
  ] });
}

