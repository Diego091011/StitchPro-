export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => [...r.querySelectorAll(s)];
export const money = (n) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n || 0);
export const date = (d) => (d ? new Date(d).toLocaleDateString('es-CO') : '—');
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

let t;
export function toast(msg, err = false) {
  let el = $('#toast');
  if (!el) { el = document.createElement('div'); el.id = 'toast'; document.body.append(el); }
  el.textContent = msg; el.className = 'on' + (err ? ' err' : '');
  clearTimeout(t); t = setTimeout(() => (el.className = ''), 2800);
}

/** Dinero para costos unitarios pequeños (ej. $0,42 por yarda): más decimales cuando el valor es bajo. */
export const moneyU = (n) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: n >= 1000 ? 0 : n >= 10 ? 2 : 4 }).format(n || 0);