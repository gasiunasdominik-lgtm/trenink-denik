// Spodní panel (bottom sheet) pro formuláře. Zavírá se tažením dolů, tapnutím mimo nebo Esc.
import { h } from './dom.js';

export function openSheet({ title, body, full = false }) {
  const panel = h('section.sheet' + (full ? '.full' : ''), { role: 'dialog', 'aria-modal': 'true', 'aria-label': title },
    h('div.sheet-grip'),
    h('header.sheet-head', h('h2', title), h('button.sheet-x', { 'aria-label': 'Zavřít', on: { click: () => close() } }, 'Zavřít')),
    h('div.sheet-body', body),
  );
  const scrim = h('div.scrim', { on: { click: () => close() } });
  document.body.append(scrim, panel);
  document.body.classList.add('sheet-open');
  requestAnimationFrame(() => { scrim.classList.add('in'); panel.classList.add('in'); });

  // tažení dolů za hlavičku
  let y0 = null, dy = 0;
  const head = panel.querySelector('.sheet-grip').parentElement;
  head.addEventListener('touchstart', e => { y0 = e.touches[0].clientY; panel.style.transition = 'none'; }, { passive: true });
  head.addEventListener('touchmove', e => {
    if (y0 == null || panel.querySelector('.sheet-body').scrollTop > 0) return;
    dy = Math.max(0, e.touches[0].clientY - y0);
    panel.style.transform = `translateY(${dy}px)`;
  }, { passive: true });
  head.addEventListener('touchend', () => {
    panel.style.transition = '';
    if (dy > 110) close(); else panel.style.transform = '';
    y0 = null; dy = 0;
  });

  const onKey = e => e.key === 'Escape' && close();
  document.addEventListener('keydown', onKey);

  function close() {
    document.removeEventListener('keydown', onKey);
    panel.style.transform = '';
    panel.classList.remove('in');
    scrim.classList.remove('in');
    document.body.classList.remove('sheet-open');
    setTimeout(() => { panel.remove(); scrim.remove(); }, 260);
  }
  return { close, panel };
}
