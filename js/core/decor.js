import { ic } from './icons.js';

/** Añade iconos a botones según su atributo data-* (sin tocar el HTML de cada página). */
const MAP = [
  ['[data-edit]', 'edit'], ['[data-del],[data-delp],[data-delcat]', 'trash'], ['[data-pay]', 'money'], ['[data-rec]', 'print'],
  ['[data-calc]', 'ruler'], ['[data-stock]', 'plus'], ['[data-ver]', 'eye'], ['[data-dup]', 'layers'],
  ['#new', 'plus'], ['#cats-btn', 'tag'], ['#export', 'download'], ['#madd,#e-add,#dq-addbtn', 'plus'], ['a[href*="wa.me"]', 'chat'],
];
const SOLO_X = '[data-rm],[data-mrm],[data-delp]';

function aplicar() {
  MAP.forEach(([sel, icon]) => document.querySelectorAll(sel).forEach((el) => {
    if (el.dataset.ic) return;
    el.dataset.ic = '1';
    if (el.matches(SOLO_X) && el.textContent.trim() === '✕') el.innerHTML = ic(el.matches('[data-delp]') ? 'trash' : 'x');
    else el.insertAdjacentHTML('afterbegin', ic(icon));
  }));
  document.querySelectorAll(SOLO_X).forEach((el) => { if (!el.dataset.ic && el.textContent.trim() === '✕') { el.dataset.ic = '1'; el.innerHTML = ic('x'); } });
}
let pendiente = false;
export function decorar() {
  const run = () => { pendiente = false; aplicar(); };
  new MutationObserver(() => { if (!pendiente) { pendiente = true; requestAnimationFrame(run); } }).observe(document.body, { childList: true, subtree: true });
  aplicar();
}