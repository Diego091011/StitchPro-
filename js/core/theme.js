const KEY = 'stitchpro-theme';
export const getTheme = () => { try { return localStorage.getItem(KEY) || 'dark'; } catch { return 'dark'; } };
export const applyTheme = (t = getTheme()) => { document.documentElement.dataset.theme = t; };
export function setTheme(t) {
  try { localStorage.setItem(KEY, t); } catch { /* sin almacenamiento */ }
  applyTheme(t);
  document.dispatchEvent(new CustomEvent('theme:change', { detail: t }));
}
export const toggleTheme = () => setTheme(getTheme() === 'dark' ? 'light' : 'dark');