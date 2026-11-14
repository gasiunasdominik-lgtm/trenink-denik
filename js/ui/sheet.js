// Spodní panel (bottom sheet) pro formuláře. Zavírá se tažením dolů za úchyt/hlavičku, tapnutím mimo nebo Esc.
// guard() → true = formulář má neuložené změny; zavření gestem/mimo/Esc/✕ se pak nejdřív zeptá.
import { h } from './dom.js';

export function openSheet({ title, body, full = false, guard = null }) {
  const grip = h('div.sheet-grip');
  const head = h('header.sheet-head', h('h2', title), h('button.sheet-x', { 'aria-label': 'Zavřít', on: { click: () => dismiss() } }, 'Zavřít'));
  const panel = h('section.sheet' + (full ? '.full' : ''), { role: 'dialog', 'aria-modal': 'true', 'aria-label': title },
    grip, head, h('div.sheet-body', body),
  );
  const scrim = h('div.scrim', { on: { click: () => dismiss() } });
  document.body.append(scrim, panel);
  document.body.classList.add('sheet-open');
  requestAnimationFrame(() => { scrim.classList.add('in'); panel.classList.add('in'); });

  // tažení dolů jen za úchyt a hlavičku – scrollování obsahu panel nikdy nezavře
  let y0 = null, dy = 0;
  const onStart = e => { if (e.target.closest('.sheet-x')) return; y0 = e.touches[0].clientY; dy = 0; panel.style.transition = 'none'; };
  const onMove = e => {
    if (y0 == null) return;
    dy = Math.max(0, e.touches[0].clientY - y0);
    panel.style.transform = `translateY(${dy}px)`;
  };
  const onEnd = () => {
    if (y0 == null) return;
    panel.style.transition = '';
    const pulled = dy > 110;
    y0 = null; dy = 0;
    if (!pulled || !dismiss()) panel.style.transform = '';
  };
  for (const el of [grip, head]) {
    el.addEventListener('touchstart', onStart, { passive: true });
    el.addEventListener('touchmove', onMove, { passive: true });
    el.addEventListener('touchend', onEnd);
    el.addEventListener('touchcancel', onEnd);
  }

  const onKey = e => e.key === 'Escape' && dismiss();
  document.addEventListener('keydown', onKey);

  /** zavření uživatelem: s neuloženými změnami se zeptá. Vrací true, když se zavřelo. */
  function dismiss() {
    if (guard?.() && !confirm('Zavřít bez uložení? Zapsané údaje se ztratí.')) return false;
    close();
    return true;
  }

  function close() {
    document.removeEventListener('keydown', onKey);
    panel.style.transform = '';
    panel.classList.remove('in');
    scrim.classList.remove('in');
    document.body.classList.remove('sheet-open');
    setTimeout(() => { panel.remove(); scrim.remove(); }, 260);
  }
  return { close, dismiss, panel };
}
