// Výběr zaměření a disciplín jednotky. Cíl: jakoukoli aktivitu zařadit na 1–3 ťuknutí.
// „Naposledy“ = nedávné kombinace (jedno ťuknutí vyplní vše), pak zaměření po skupinách (víc najednou,
// první vybrané = hlavní → u.typ) a volitelně disciplíny (víc najednou).
import { h } from './dom.js';
import { tap } from './haptics.js';
import { TYPES, TYPE_GROUPS, UNIT_DISC } from '../config.js';

const list = s => String(s || '').split(',').map(x => x.trim()).filter(Boolean);

/** Zaměření a disciplíny jednotky v novém tvaru (staré typy jako „dalka“ se převedou na technika + dálka). */
export function focusOf(u) {
  const t = TYPES[u.typ];
  let foci = list(u.zamereni);
  if (!foci.length && u.typ) foci = [t?.legacy || u.typ];
  foci = foci.map(f => TYPES[f]?.legacy || f);
  const disc = list(u.discipliny);
  if (!disc.length && t?.disc) disc.push(...t.disc);
  return { foci: [...new Set(foci)], disc };
}

const discLabel = id => (UNIT_DISC.find(d => d[0] === id) || [id, id])[1];

/** Krátký popis: „Rychlostní vytrvalost + Síla · Dálka, Výška“. */
export function focusLabel(u) {
  const { foci, disc } = focusOf(u);
  const a = foci.map(f => TYPES[f]?.label || f).join(' + ');
  return [a, disc.map(discLabel).join(', ')].filter(Boolean).join(' · ');
}

/** Nedávné odlišné kombinace (zaměření + disciplíny), nejnovější první. */
function recent(units, n = 6) {
  const seen = new Set(), out = [];
  for (const x of [...units].filter(x => x.min > 0 && x.typ).sort((a, b) => b.datum.localeCompare(a.datum) || b.id.localeCompare(a.id))) {
    const { foci, disc } = focusOf(x);
    const key = foci.join(',') + '|' + disc.join(',');
    if (seen.has(key)) continue;
    seen.add(key); out.push({ foci, disc, nazev: x.nazev });
    if (out.length >= n) break;
  }
  return out;
}

/**
 * @param u jednotka (mění se u.typ, u.zamereni, u.discipliny)
 * @param units dřívější jednotky pro „Naposledy“
 * @param onChange() po každé změně
 * @returns { el, refresh() } – refresh po vnější změně u (např. převzetí z minulého zápisu)
 */
export function typePicker(u, units, onChange = () => {}) {
  let { foci, disc } = focusOf(u);
  const el = h('div.tpick');

  const write = () => {
    u.typ = foci[0] || '';
    u.zamereni = foci.length > 1 ? foci.join(',') : '';
    u.discipliny = disc.join(',');
    onChange();
  };
  const chip = (label, pressed, onClick, extra) =>
    h('button.qchip', { type: 'button', 'aria-pressed': String(pressed), on: { click: () => { tap(); onClick(); draw(); write(); } } }, label, extra);

  function draw() {
    const rec = recent(units);
    const recRow = rec.length ? h('div.tp-sec',
      h('div.tp-h', 'Naposledy'),
      h('div.chips.quick', rec.map(r => chip(
        [r.foci.map(f => TYPES[f]?.label || f).join(' + '), r.disc.map(discLabel).join(', ')].filter(Boolean).join(' · '),
        r.foci.join() === foci.join() && r.disc.join() === disc.join(),
        () => { foci = [...r.foci]; disc = [...r.disc]; },
      )))) : null;

    const groups = TYPE_GROUPS.map(([g, title]) => h('div.tp-sec',
      h('div.tp-h', title),
      h('div.chips.quick', Object.entries(TYPES).filter(([, t]) => t.group === g).map(([k, t]) => {
        const i = foci.indexOf(k);
        return chip(t.label, i >= 0, () => { foci = i >= 0 ? foci.filter(f => f !== k) : [...foci, k]; },
          i === 0 && foci.length > 1 ? h('small.tp-main', 'hlavní') : null);
      }))));

    const main = TYPES[foci[0]];
    const hint = h('div.tp-hint', main ? (main.hint ? `${main.label}: ${main.hint}` : main.label) : 'Ťukni, co jsi trénoval. Víc zaměření = první je hlavní.');

    const discRow = h('div.tp-sec',
      h('div.tp-h', 'Disciplíny ', h('small', foci.some(f => f === 'technika' || f === 'multi' || f === 'zavod') ? '' : '(nepovinné)')),
      h('div.chips.quick', UNIT_DISC.map(([id, label]) => {
        const on = disc.includes(id);
        return chip(label, on, () => { disc = on ? disc.filter(d => d !== id) : [...disc, id]; });
      })));

    el.replaceChildren(...[recRow, ...groups, hint, discRow].filter(Boolean));
  }
  draw();
  return { el, refresh() { ({ foci, disc } = focusOf(u)); draw(); } };
}
