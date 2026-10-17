// Haptika. Android: Vibration API. iOS Safari (18+) Vibration API nemá – haptickou odezvu
// vyvolá přepnutí nativního <input type="checkbox" switch>, proto skrytý přepínač.

let sw;
function iosTick() {
  if (!sw) {
    const label = document.createElement('label');
    label.setAttribute('aria-hidden', 'true');
    label.style.cssText = 'position:fixed;left:-100px;top:0;opacity:0;pointer-events:none';
    sw = document.createElement('input');
    sw.type = 'checkbox';
    sw.setAttribute('switch', '');
    label.append(sw);
    document.body.append(label);
  }
  sw.parentElement.click();
}

export function tap() {
  if (navigator.vibrate) navigator.vibrate(8);
  else iosTick();
}

export function success() {
  if (navigator.vibrate) navigator.vibrate([10, 50, 18]);
  else { iosTick(); setTimeout(iosTick, 90); }
}
