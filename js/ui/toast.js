// Krátké oznámení dole nad lištou, volitelně s akcí „Vrátit“.
import { h } from './dom.js';

let current;

export function toast(text, { action, onAction, ms = 5000 } = {}) {
  current?.remove();
  const el = h('div.toast', { role: 'status' }, h('span', text),
    action ? h('button', { type: 'button', on: { click: () => { el.remove(); onAction?.(); } } }, action) : null);
  document.body.append(el);
  current = el;
  requestAnimationFrame(() => el.classList.add('in'));
  setTimeout(() => { el.classList.remove('in'); setTimeout(() => el.remove(), 250); }, ms);
}
