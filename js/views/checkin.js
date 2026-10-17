// Ranní check-in: karty, které se odsouvají swipem. Stupnice se po výběru samy posunou dál.
import { h } from '../ui/dom.js';
import { scale, stepper, numField } from '../ui/inputs.js';
import { tap, success } from '../ui/haptics.js';
import * as store from '../data/store.js';
import { addDays, today, hm } from '../lib/dates.js';

const SUBJ = {
  unava:  { title: 'Únava',  lo: 'mrtvý',   hi: 'svěží' },
  svaly:  { title: 'Svaly',  lo: 'rozbité', hi: 'v pohodě' },
  nalada: { title: 'Nálada', lo: 'špatná',  hi: 'výborná' },
};

export function openCheckin(datum = today(), onDone = () => {}) {
  const s = store.getSettings();
  const on = s.checkinFields;
  const prev = store.wellness(addDays(datum, -1));
  const w = structuredClone(store.wellness(datum) || { datum, bolest: {} });
  w.bolest ||= {};

  const cards = [];
  if (on.hrv || on.rhr) cards.push(cardVitals());
  if (on.spanek_h || on.spanek_q) cards.push(cardSleep());
  for (const k of Object.keys(SUBJ)) if (on[k]) cards.push(cardScale(k));
  if (on.bolest) cards.push(cardPain());
  cards.push(cardSave());

  let i = 0;
  const track = h('div.ci-track', cards);
  const bar = h('div.ci-progress', cards.map(() => h('i')));
  const root = h('div.checkin', { role: 'dialog', 'aria-label': 'Ranní check-in' },
    h('header.ci-head',
      h('button.ci-close', { on: { click: close } }, 'Zavřít'),
      h('span.ci-title', 'Ranní check-in'),
      h('span.ci-count')),
    bar,
    h('div.ci-viewport', track),
    h('footer.ci-foot',
      h('button.ci-back', { on: { click: () => go(i - 1) } }, 'Zpět'),
      h('button.ci-next', { on: { click: () => go(i + 1) } }, 'Dál')),
  );
  document.body.append(root);
  requestAnimationFrame(() => root.classList.add('in'));
  go(0);
  swipe(root.querySelector('.ci-viewport'));

  function go(n) {
    i = Math.max(0, Math.min(cards.length - 1, n));
    track.style.transform = `translateX(${-i * 100}%)`;
    bar.querySelectorAll('i').forEach((el, k) => el.classList.toggle('on', k <= i));
    root.querySelector('.ci-count').textContent = `${i + 1}/${cards.length}`;
    root.querySelector('.ci-back').disabled = i === 0;
    root.querySelector('.ci-next').hidden = i === cards.length - 1;
    cards[i].querySelector('input')?.focus({ preventScroll: true });
  }
  const next = () => setTimeout(() => go(i + 1), 170);

  function swipe(el) {
    let x0 = null, dx = 0;
    el.addEventListener('touchstart', e => { x0 = e.touches[0].clientX; track.style.transition = 'none'; }, { passive: true });
    el.addEventListener('touchmove', e => {
      if (x0 == null) return;
      dx = e.touches[0].clientX - x0;
      track.style.transform = `translateX(calc(${-i * 100}% + ${dx}px))`;
    }, { passive: true });
    el.addEventListener('touchend', () => {
      track.style.transition = '';
      if (Math.abs(dx) > 60) { tap(); go(i + (dx < 0 ? 1 : -1)); } else go(i);
      x0 = null; dx = 0;
    });
  }

  function card(title, ...body) {
    return h('section.ci-card', h('h2.ci-h', title), ...body);
  }

  function cardVitals() {
    return card('Tělo ráno',
      on.hrv ? h('div.ci-row', h('span.ci-l', 'HRV', h('small', 'mySASY')),
        numField({ value: w.hrv, placeholder: prev?.hrv ?? '–', unit: 'ms', onInput: v => (w.hrv = v) })) : null,
      on.rhr ? h('div.ci-row', h('span.ci-l', 'Klidový tep'),
        numField({ value: w.rhr, placeholder: prev?.rhr ?? '–', unit: 'bpm', onInput: v => (w.rhr = v) })) : null,
    );
  }

  function cardSleep() {
    w.spanek_h ??= prev?.spanek_h ?? 7.5;
    return card('Spánek',
      on.spanek_h ? stepper({ value: w.spanek_h, step: 0.25, min: 0, max: 14, unit: 'h', format: hm, onChange: v => (w.spanek_h = v) }) : null,
      on.spanek_q ? h('div.ci-sub', h('span.ci-l', 'Kvalita'),
        scale({ from: 1, to: 5, value: w.spanek_q, labels: { 1: 'hrozná', 5: 'skvělá' }, onPick: v => { w.spanek_q = v; next(); } })) : null,
    );
  }

  function cardScale(k) {
    const m = SUBJ[k];
    return card(m.title,
      scale({ from: 1, to: 5, value: w[k], labels: { 1: m.lo, 5: m.hi }, onPick: v => { w[k] = v; next(); } }));
  }

  function cardPain() {
    const parts = [...new Set([...s.bodyParts, ...Object.keys(w.bolest)])];
    const grid = h('div.pain-grid');
    const chip = p => {
      const b = h('button.pain', { type: 'button' });
      const render = () => {
        const lvl = w.bolest[p] || 0;
        b.dataset.lvl = lvl;
        b.replaceChildren(h('span', p), h('b', lvl ? '●'.repeat(lvl) : ''));
      };
      b.addEventListener('click', () => {
        const lvl = ((w.bolest[p] || 0) + 1) % 4;
        if (lvl) w.bolest[p] = lvl; else delete w.bolest[p];
        tap(); render();
      });
      render();
      return b;
    };
    parts.forEach(p => grid.append(chip(p)));
    const custom = h('input.text-in', { placeholder: 'Jiná partie…', enterkeyhint: 'done' });
    custom.addEventListener('change', () => {
      const p = custom.value.trim();
      if (!p) return;
      w.bolest[p] = 1;
      grid.append(chip(p));
      custom.value = '';
    });
    return card('Bolest', h('p.ci-hint', 'Ťukni: 1× lehká, 2× střední, 3× silná, 4× zrušit.'), grid, custom);
  }

  function cardSave() {
    return card('Hotovo?',
      h('p.ci-hint', 'Uloží se do deníku a při připojení se pošle do Sheetu.'),
      h('button.btn-primary.ci-save', { on: { click: save } }, 'Uložit check-in'));
  }

  async function save() {
    w.cas = new Date().toTimeString().slice(0, 5);
    await store.saveWellness(w);
    success();
    close();
    onDone();
  }

  function close() {
    root.classList.remove('in');
    setTimeout(() => root.remove(), 250);
  }
}
