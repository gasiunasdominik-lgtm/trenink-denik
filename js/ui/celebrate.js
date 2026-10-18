// PB moment: celoobrazovkový tartan, obří „PB“, razítko OSOBNÍ REKORD. Zavírá se ťuknutím.
import { h } from './dom.js';
import { success } from './haptics.js';
import { trackSvg } from './track-bg.js';

export function celebratePB({ discipline, value, previous, delta, points, bg = 4 }) {
  const el = h('div.pb-moment', { role: 'dialog', 'aria-label': `Osobní rekord ${discipline}` },
    h('div.track-bg', { html: trackSvg(bg) }),
    h('div.pb-inner',
      h('div.pb-disc', discipline),
      h('div.pb-big', 'PB'),
      h('div.pb-val', value),
      h('div.pb-meta', [previous ? `dosud ${previous}` : 'první zápis', delta, points != null ? `${points} b.` : null].filter(Boolean).join(' · ')),
      h('span.pb-stamp', 'Osobní rekord')),
    h('div.pb-close', 'ťukni pro zavření'),
  );
  document.body.append(el);
  requestAnimationFrame(() => el.classList.add('in'));
  success();
  setTimeout(success, 420);
  el.addEventListener('click', () => {
    el.classList.remove('in');
    setTimeout(() => el.remove(), 260);
  });
}
