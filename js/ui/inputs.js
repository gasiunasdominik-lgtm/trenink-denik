// Ovládací prvky stavěné na palec: velké stupnice, krokovač, číselné pole.
import { h } from './dom.js';
import { tap } from './haptics.js';

/** Řada tlačítek from..to. onPick(value). */
export function scale({ from = 1, to = 5, value, onPick, labels }) {
  const wrap = h('div.scale', { style: { gridTemplateColumns: `repeat(${Math.min(to - from + 1, 5)}, 1fr)` } });
  for (let v = from; v <= to; v++) {
    const b = h('button.scale-btn', { type: 'button', 'aria-pressed': String(v === value) },
      h('b', v), labels?.[v] ? h('small', labels[v]) : null);
    b.addEventListener('click', () => {
      wrap.querySelectorAll('.scale-btn').forEach(x => x.setAttribute('aria-pressed', 'false'));
      b.setAttribute('aria-pressed', 'true');
      tap();
      onPick(v);
    });
    wrap.append(b);
  }
  return wrap;
}

/** Krokovač s velkým číslem: − 90 + */
export function stepper({ value = 0, step = 5, min = 0, max = 999, unit = '', decimals = 0, format, onChange }) {
  let v = value;
  const out = h('output.step-val');
  const render = () => { out.textContent = format ? format(v) : v.toLocaleString('cs-CZ', { minimumFractionDigits: decimals, maximumFractionDigits: decimals }); };
  const bump = d => { v = Math.min(max, Math.max(min, +(v + d).toFixed(2))); render(); tap(); onChange(v); };
  render();
  return h('div.stepper',
    h('button.step-btn', { type: 'button', 'aria-label': 'Méně', on: { click: () => bump(-step) } }, '−'),
    h('div.step-mid', out, unit ? h('span.step-unit', unit) : null),
    h('button.step-btn', { type: 'button', 'aria-label': 'Více', on: { click: () => bump(step) } }, '+'),
  );
}

/** Číselné pole s numerickou klávesnicí. */
export function numField({ value, placeholder = '', unit = '', onInput, decimal = false }) {
  const inp = h('input.num-in', {
    type: 'text', inputmode: decimal ? 'decimal' : 'numeric', placeholder, value: value ?? '',
    autocomplete: 'off', enterkeyhint: 'next',
  });
  inp.addEventListener('input', () => {
    const t = inp.value.replace(',', '.').trim();
    onInput(t === '' ? null : Number(t));
  });
  return h('label.num-field', inp, unit ? h('span.num-unit', unit) : null);
}

export function field(label, control, hint) {
  return h('div.field', h('div.field-l', label, hint ? h('small', hint) : null), control);
}
