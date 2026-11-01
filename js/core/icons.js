const P = {
  home: 'M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z M9 22V12h6v10',
  calc: 'M5 2h14a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1z M8 6h8 M8 11h.01 M12 11h.01 M16 11h.01 M8 15h.01 M12 15h.01 M16 15h.01',
  clip: 'M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2 M8 2h8v4H8z M8 12h8 M8 16h5',
  box: 'M21 16V8l-9-5-9 5v8l9 5z M3.3 7L12 12l8.7-5 M12 22V12',
  users: 'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2 M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8 M23 21v-2a4 4 0 0 0-3-3.9 M16 3.1a4 4 0 0 1 0 7.8',
  set: 'M4 21v-7 M4 10V3 M12 21v-9 M12 8V3 M20 21v-5 M20 12V3 M1 14h6 M9 8h6 M17 16h6',
  out: 'M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4 M16 17l5-5-5-5 M21 12H9',
  trend: 'M23 6l-9.5 9.5-5-5L1 18 M17 6h6v6',
  hanger: 'M12 7a2.5 2.5 0 1 0-2.5-2.5 M12 7v2.5L2.5 16.5a1 1 0 0 0 .6 1.8h17.8a1 1 0 0 0 .6-1.8L12 9.5',
  bolt: 'M13 2L3 14h9l-1 8 10-12h-9z',
  cut: 'M6 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6z M6 21a3 3 0 1 0 0-6 3 3 0 0 0 0 6z M20 4L8.1 15.9 M14.5 14.5L20 20 M8.1 8.1L12 12',
  bell: 'M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9 M13.7 21a2 2 0 0 1-3.4 0',
  find: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14z M21 21l-4.3-4.3',
};
const DRESS = '<symbol id="i-dress" viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="32" cy="4.5" r="2.2"/><path d="M32 6.7V11"/><path fill="currentColor" fill-opacity=".14" d="M32 11c-4 0-6 1.5-8 3.5L14 19c-1 1-1 2.5 0 4 2 3 4 5 4.5 9 .4 3-.5 5-2.5 8L13 46h38l-3-6c-2-3-2.9-5-2.5-8 .5-4 2.5-6 4.5-9 1-1.5 1-3 0-4L40 14.5C38 12.5 36 11 32 11z"/><path opacity=".6" d="M18.5 32Q32 35.5 45.5 32M25.5 18.5C24 27 24.500 36 21.500 46M38.500 18.500C40 27 39.500 36 42.500 46"/><path d="M32 46v11M32 57l-8.500 5M32 57l8.500 5"/></symbol>';
export const SPRITE = `<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs>${DRESS}${Object.entries(P).map(([k, d]) => `<symbol id="i-${k}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="${d}"/></symbol>`).join('')}</defs></svg>`;
export const ic = (n, cls = '') => `<svg class="i ${cls}"><use href="#i-${n}"/></svg>`;
