// Tartanová pozadí horní části obrazovky DNES. Varianta se volí podle typu dnešního tréninku (plan.bgFor).
// Souřadnice v boxu 390 × 372. Varianta 1 (ovál s tmavým vnitřkem) je vyřazená.

const W = '#f5f2ea', BG = '#0d0d0c';
const line = (d, w = 2.2, extra = '') => `<path d="${d}" fill="none" stroke="${W}" stroke-width="${w}" ${extra}/>`;
const label = (x, y, t, size, anchor = 'middle', wdth = 62) =>
  `<text x="${x}" y="${y}" fill="${W}" font-family="Archivo" font-weight="900" font-size="${size}" text-anchor="${anchor}" style="font-variation-settings:'wdth' ${wdth}">${t}</text>`;

const VARIANTS = {
  2: () => // schodovitý start
    [168, 209, 250, 291, 332, 373].map(y => line(`M0 ${y} H390`)).join('') +
    [0, 1, 2, 3, 4].map(k => line(`M${206 + k * 36} ${168 + k * 41} v41`, 5)).join('') +
    [1, 2, 3, 4, 5].map((n, k) => label(224 + k * 36, 198 + k * 41, n, 24)).join(''),

  3: () => // diagonála
    [-140, -80, -20, 40, 100, 160, 220].map(o => line(`M-40 ${300 + o} L430 ${40 + o}`)).join('') +
    line('M300 196 L404 384', 8) + line('M313 190 L417 378', 2.2, 'stroke-dasharray="6 6"'),

  4: () => // cíl zhora
    [0, 65, 130, 195, 260, 325, 390].map(x => line(`M${x} 0 V372`)).join('') +
    line('M0 152 H390', 9) +
    [1, 2, 3, 4, 5, 6].map((n, k) => label(32 + k * 65, 140, n, 34)).join(''),

  5: () => // překážky
    [168, 209, 250, 291, 332, 373].map(y => line(`M0 ${y} H390`)).join('') +
    [0, 1, 2, 3, 4].flatMap(k => [258, 344].map(x => {
      const y = 168 + k * 41;
      return line(`M${x} ${y + 5} v31`, 7) +
        `<path d="M${x} ${y + 5} v31" fill="none" stroke="${BG}" stroke-width="7" stroke-dasharray="5 5"/>` +
        line(`M${x} ${y + 6} h-18 M${x} ${y + 35} h-18`, 2);
    })).join(''),

  6: () => { // sektor vrhu
    const cx = 34, cy = 360, a1 = -22.5 * Math.PI / 180, a2 = -57.4 * Math.PI / 180, L = 700;
    const p = (a, r) => `${cx + Math.cos(a) * r} ${cy + Math.sin(a) * r}`;
    const ray = a => line(`M${p(a, 36)} L${p(a, L)}`, 3);
    const arc = (r, m) => line(`M${p(a1, r)} A${r} ${r} 0 0 0 ${p(a2, r)}`, 1.6, 'stroke-dasharray="4 6"') +
      label(cx + Math.cos(a1) * r + 6, cy + Math.sin(a1) * r + 14, `${m} m`, 13, 'start');
    return ray(a1) + ray(a2) + arc(150, 12) + arc(240, 14) + arc(330, 16) +
      `<circle cx="${cx}" cy="${cy}" r="34" fill="none" stroke="${W}" stroke-width="4"/>` +
      line(`M${p(a1 - 0.2, 34)} A34 34 0 0 0 ${p(a2 + 0.2, 34)}`, 10);
  },

  7: () => // rozběh dálky / tyče
    `<rect x="318" y="208" width="90" height="92" fill="#2a211a"/>` +
    line('M0 208 H390') + line('M0 300 H390') +
    `<rect x="292" y="208" width="18" height="92" fill="${W}"/><rect x="310" y="208" width="6" height="92" fill="#e8d9a8"/>` +
    [60, 120, 180, 240].map(x => line(`M${x} 292 v8`, 3)).join('') +
    [222, 238, 254, 270, 286].map(y => `<path d="M322 ${y} H404" stroke="#4a3a2c" stroke-width="2"/>`).join(''),

  8: () => // desetiboj
    ['100 m', 'DÁLKA', 'KOULE', 'VÝŠKA', '400 m', '110 m PŘ.', 'DISK', 'TYČ', 'OŠTĚP', '1500 m'].map((d, k) => {
      const y = 190 + k * 18;
      return line(`M0 ${y} H390`, k === 5 ? 5 : 1.6) + label(378, y + 13, d, 10, 'end', 70);
    }).join('') + line('M0 370 H390', 1.6),

  9: () => // výška
    `<rect x="292" y="206" width="110" height="112" fill="#232322"/>` +
    line('M284 200 V324', 3) + `<rect x="279" y="194" width="10" height="10" fill="${W}"/><rect x="279" y="320" width="10" height="10" fill="${W}"/>` +
    line('M120 372 C 200 372, 250 330, 278 268', 2.4, 'stroke-dasharray="2 9" stroke-linecap="round"') +
    [[150, 370], [205, 360], [245, 328]].map(([x, y]) => line(`M${x - 6} ${y - 6} l12 12 M${x + 6} ${y - 6} l-12 12`, 2.4)).join(''),

  10: () => // jedna dráha
    line('M0 196 H390', 4) + line('M0 340 H390', 4) + line('M318 196 V340', 7) +
    `<path d="M352 252 l16 16 l-16 16" fill="none" stroke="${W}" stroke-width="5"/>`,

  11: () => // štafeta
    [196, 232, 268, 304, 340, 376].map(y => line(`M0 ${y} H390`)).join('') +
    [0, 1, 2, 3, 4].map(k => {
      const y = 196 + k * 36, x = 236 + k * 22;
      return line(`M${x} ${y + 4} v28`, 3) + line(`M${x + 60} ${y + 4} v28`, 2, 'stroke-dasharray="4 4"') +
        `<path d="M${x + 6} ${y + 2} l10 0 l-5 8 Z M${x + 6} ${y + 34} l10 0 l-5 -8 Z" fill="${W}"/>`;
    }).join(''),

  12: () => { // oštěp
    const cx = 320, cy = 320, r = 80, a = 14.48 * Math.PI / 180, L = 400;
    const top = cy - Math.sqrt(r * r - 400);
    const ray = s => line(`M${cx + Math.sin(s * a) * r} ${cy - Math.cos(a) * r} L${cx + Math.sin(s * a) * L} ${cy - Math.cos(a) * L}`, 2.4);
    return line(`M300 372 V${top}`) + line(`M340 372 V${top}`) +
      line(`M${cx - Math.sin(a) * r} ${cy - Math.cos(a) * r} A${r} ${r} 0 0 1 ${cx + Math.sin(a) * r} ${cy - Math.cos(a) * r}`, 6) +
      ray(-1) + ray(1) + [300, 330, 360].map(y => line(`M296 ${y} h-8 M344 ${y} h8`, 2)).join('');
  },
};

export const VARIANT_NAMES = {
  2: 'Schodovitý start', 3: 'Diagonála', 4: 'Cíl zhora', 5: 'Překážky', 6: 'Sektor vrhu', 7: 'Rozběh',
  8: 'Desetiboj', 9: 'Výška', 10: 'Jedna dráha', 11: 'Štafeta', 12: 'Oštěp',
};

const GRAIN = `<filter id="grain"><feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="3" stitchTiles="stitch"/>` +
  `<feColorMatrix values="0 0 0 0 .35  0 0 0 0 .1  0 0 0 0 .05  0 0 0 1.1 -.2"/></filter>`;

export function trackSvg(v) {
  const draw = VARIANTS[v] || VARIANTS[10];
  return `<svg class="track-svg" viewBox="0 0 390 372" preserveAspectRatio="xMidYMax slice" aria-hidden="true">` +
    `<defs>${GRAIN}</defs><rect width="390" height="372" fill="var(--tartan)"/>${draw()}` +
    `<rect width="390" height="372" filter="url(#grain)" opacity=".55" style="mix-blend-mode:multiply"/></svg>`;
}
