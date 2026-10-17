// Razítko HOTOVO: ťuknutí na tlačítko orazítkuje první nedokončený řádek.
export function wireStamp({ button, rows, make }) {
  button.addEventListener('click', () => {
    const row = [...document.querySelectorAll(rows)].find(r => !r.classList.contains('done'));
    if (!row) return;
    const now = new Date();
    const time = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    const s = make(time);
    s.classList.add('new');
    s.style.setProperty('--r', `${-12 + Math.random() * 8}deg`);
    row.appendChild(s);
    row.classList.add('done');
    navigator.vibrate?.([8, 40, 16]);
  });
}

export function el(html) {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstChild;
}
