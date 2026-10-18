// Vstupní bod: start úložiště, synchronizace, směrování mezi záložkami.
import { h, mount, $ } from './ui/dom.js';
import * as store from './data/store.js';
import * as sync from './data/sync.js';
import { today, addDays, dm, dowShort } from './lib/dates.js';
import { renderToday } from './views/today.js';
import { renderWeek } from './views/week.js';
import { renderSettings } from './views/settings.js';
import { renderPerformance } from './views/performance.js';
import { renderCharts } from './views/charts.js';
import { tap } from './ui/haptics.js';

const TABS = [
  { id: 'dnes', label: 'Dnes' },
  { id: 'tyden', label: 'Týden' },
  { id: 'vykon', label: 'Výkon' },
  { id: 'grafy', label: 'Grafy' },
];

const ui = { tab: 'dnes', day: today(), weekAnchor: today() };
let current = null;

function route() {
  const id = location.hash.slice(1) || 'dnes';
  const mods = store.getSettings().modules;
  ui.tab = [...TABS.filter(t => mods[t.id] !== false).map(t => t.id), 'nastaveni'].includes(id) ? id : 'dnes';
  render();
}

function go(tab) {
  tap();
  if (tab === 'dnes' && ui.tab === 'dnes') ui.day = today();
  if (location.hash.slice(1) === tab) render(); else location.hash = tab;
}

function view() {
  switch (ui.tab) {
    case 'dnes': {
      const v = renderToday(ui.day, { onDay: d => { ui.day = d; render(); } });
      if (ui.day !== today()) {
        v.prepend(h('button.back-today', { on: { click: () => { ui.day = today(); render(); } } },
          `${dowShort(ui.day)} ${dm(ui.day)} · zpět na dnes`));
      }
      return v;
    }
    case 'tyden':
      return renderWeek(ui.weekAnchor, {
        onDay: d => { ui.day = d; location.hash = 'dnes'; },
        onShift: n => { ui.weekAnchor = addDays(ui.weekAnchor, n); render(); },
      });
    case 'nastaveni':
      return renderSettings();
    case 'vykon':
      return renderPerformance(render);
    case 'grafy':
      return renderCharts(render);
  }
}

function render() {
  const main = $('#main');
  const keepScroll = current?.dataset.tab === ui.tab ? main.scrollTop : 0;
  current?.cleanup?.();
  current = view();
  current.dataset.tab = ui.tab;
  mount(main, current);
  main.scrollTop = keepScroll;
  document.querySelectorAll('.tabbar [data-tab]').forEach(b => b.setAttribute('aria-current', String(b.dataset.tab === ui.tab)));
  paintTabbar();
  const dev = store.getDevice();
  $('.tabbar .gear').classList.toggle('needs-setup', !(dev.apiUrl && dev.token));
}

/** Vypnuté moduly (Nastavení → Moduly) zmizí z lišty. */
function paintTabbar() {
  const mods = store.getSettings().modules;
  const bar = $('.tabbar');
  let n = 0;
  TABS.forEach(t => { const on = mods[t.id] !== false; bar.querySelector(`[data-tab="${t.id}"]`).hidden = !on; n += on; });
  bar.style.gridTemplateColumns = `repeat(${n}, 1fr) 56px`;
}

function tabbar() {
  return h('nav.tabbar', { 'aria-label': 'Hlavní navigace' },
    TABS.map(t => h('button', { type: 'button', 'data-tab': t.id, on: { click: () => go(t.id) } }, t.label)),
    h('button.gear', { type: 'button', 'data-tab': 'nastaveni', 'aria-label': 'Nastavení', on: { click: () => go('nastaveni') } },
      h('span', { html: '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path fill="currentColor" d="M19.4 13a7.6 7.6 0 0 0 0-2l2-1.6-2-3.4-2.4 1a7.3 7.3 0 0 0-1.7-1L15 3.5h-4l-.4 2.5a7.3 7.3 0 0 0-1.7 1l-2.4-1-2 3.4L6.6 11a7.6 7.6 0 0 0 0 2l-2 1.6 2 3.4 2.4-1c.5.4 1.1.7 1.7 1l.4 2.5h4l.4-2.5c.6-.3 1.2-.6 1.7-1l2.4 1 2-3.4zM13 15.5a3.5 3.5 0 1 1 0-7 3.5 3.5 0 0 1 0 7z" transform="translate(-1 0)"/></svg>' })));
}

async function boot() {
  await store.init();
  mount($('#app'), h('main#main'), tabbar());
  addEventListener('hashchange', route);
  // překreslit při změně dat; nastavení si obsluhuje změny samo
  store.subscribe(() => {
    if (ui.tab !== 'nastaveni') render();
    else { const dev = store.getDevice(); $('.tabbar .gear').classList.toggle('needs-setup', !(dev.apiUrl && dev.token)); paintTabbar(); }
  });
  // o půlnoci / po návratu do appky přepnout „dnes“
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && ui.tab === 'dnes' && ui.day < today()) { ui.day = today(); render(); }
  });
  route();
  sync.start();
  // na localhostu bez SW, ať se při vývoji neservíruje stará verze z cache
  if ('serviceWorker' in navigator && location.hostname !== 'localhost') navigator.serviceWorker.register('./sw.js');
}

boot();
