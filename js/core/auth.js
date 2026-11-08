import { sb } from './supabaseClient.js';

const halt = () => new Promise(() => {}); // detiene el módulo que lo espera tras redirigir

export const getSession = async () => (await sb.auth.getSession()).data.session;

/** Páginas protegidas: sin sesión → login. */
export async function requireAuth() {
  const s = await getSession();
  if (!s) { location.replace('login.html'); await halt(); }
  return s;
}
/** Login: con sesión → dashboard. */
export async function redirectIfAuth() {
  if (await getSession()) { location.replace('dashboard.html'); await halt(); }
}
const unwrap = ({ data, error }) => { if (error) throw error; return data; };
export const signIn = async (email, password) => unwrap(await sb.auth.signInWithPassword({ email, password }));
export const signUp = async (email, password) => unwrap(await sb.auth.signUp({ email, password }));
export const getUser = async () => (await sb.auth.getUser()).data.user;
export async function changePassword(password) { const { error } = await sb.auth.updateUser({ password }); if (error) throw error; }
export async function signOut() { await sb.auth.signOut(); location.replace('login.html'); }

export function friendly(e) {
  const m = e?.message || '';
  if (/Invalid login/i.test(m)) return 'Correo o contraseña incorrectos.';
  if (/not confirmed/i.test(m)) return 'Confirma tu correo antes de ingresar.';
  if (/already registered/i.test(m)) return 'Ese correo ya tiene cuenta. Usa "Ingresar".';
  if (/rate limit/i.test(m)) return 'Demasiados intentos. Espera un momento.';
  return m || 'Ocurrió un error.';
}