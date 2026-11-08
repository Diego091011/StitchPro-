import { getUser, signOut, changePassword, friendly } from './auth.js';
import { getTheme, setTheme } from './theme.js';
import { ic } from './icons.js';
import { $, esc, toast } from './utils.js';
import * as S from '../services/index.js';

const fecha = (d) => (d ? new Date(d).toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' }) : '—');
function ventana(html) {
  const d = document.createElement('dialog');
  d.innerHTML = html;
  document.body.append(d);
  d.addEventListener('close', () => d.remove());
  d.showModal();
  return d;
}

/** Confirmación antes de cerrar sesión (con acceso al perfil). */
export function confirmarSalida() {
  const d = ventana(`<h3>¿Cerrar sesión?</h3><p style="margin-bottom:6px">Tendrás que volver a ingresar con tu correo y contraseña.</p>
    <div class="modal-act"><button class="btn ghost" data-perfil>${ic('user')}Ver perfil</button><button class="btn ghost" data-x>Cancelar</button><button class="btn bad" data-ok>${ic('out')}Sí, cerrar sesión</button></div>`);
  d.querySelector('[data-x]').onclick = () => d.close();
  d.querySelector('[data-perfil]').onclick = () => { d.close(); abrirPerfil(); };
  d.querySelector('[data-ok]').onclick = () => signOut();
}

/** Perfil: datos de la cuenta, tema y cambio de contraseña. */
export async function abrirPerfil() {
  const [u, cfg] = await Promise.all([getUser(), S.config.get().catch(() => null)]);
  const d = ventana(`<div style="display:flex;gap:14px;align-items:center;margin-bottom:16px"><div class="av big">${esc(u.email[0].toUpperCase())}</div>
      <div><h3 style="margin:0" id="p-th">${esc(cfg?.nombre_taller || 'Mi taller')}</h3><p>${esc(u.email)} · Administrador</p></div></div>
    <div class="mgrid"><div><span>Cuenta creada</span><b>${fecha(u.created_at)}</b></div><div><span>Último ingreso</span><b>${fecha(u.last_sign_in_at)}</b></div></div>
    <h4 class="sec" style="margin-top:16px">Nombre del taller</h4>
    <div class="catadd" style="margin-top:0"><input id="p-taller" value="${esc(cfg?.nombre_taller || '')}" placeholder="Ej. Taller Moda y Costura"><button class="btn ghost" id="p-tsave">${ic('check')}Guardar</button></div>
    <p style="margin-top:6px">Aparece en tus recibos y en los mensajes de WhatsApp.</p>
    <h4 class="sec" style="margin-top:16px">Apariencia</h4>
    <div class="seg" id="p-tema"><button data-t="dark">${ic('moon')}Oscuro</button><button data-t="light">${ic('sun')}Claro</button></div>
    <h4 class="sec" style="margin-top:16px">Cambiar contraseña</h4>
    <div class="form"><label>Nueva contraseña<input id="p1" type="password" minlength="6" autocomplete="new-password"></label><label>Repetirla<input id="p2" type="password" minlength="6" autocomplete="new-password"></label></div>
    <div class="modal-act"><button class="btn ghost" data-x>Cerrar</button><button class="btn ghost" id="p-save">${ic('key')}Cambiar contraseña</button><button class="btn bad" id="p-out">${ic('out')}Cerrar sesión</button></div>`);
  const marcar = () => d.querySelectorAll('#p-tema button').forEach((b) => b.classList.toggle('on', b.dataset.t === getTheme()));
  d.querySelectorAll('#p-tema button').forEach((b) => (b.onclick = () => { setTheme(b.dataset.t); marcar(); }));
  marcar();
  d.querySelector('[data-x]').onclick = () => d.close();
  d.querySelector('#p-tsave').onclick = async () => {
    const n = $('#p-taller', d).value.trim();
    try {
      await S.config.save({ nombre_taller: n || null });
      $('#p-th', d).textContent = n || 'Mi taller';
      document.dispatchEvent(new CustomEvent('taller:change', { detail: n }));
      toast('Nombre del taller guardado');
    } catch (e) { toast(e.message, true); }
  };
  d.querySelector('#p-out').onclick = () => { d.close(); confirmarSalida(); };
  d.querySelector('#p-save').onclick = async () => {
    const a = $('#p1', d).value, b = $('#p2', d).value;
    if (a.length < 6) return toast('La contraseña debe tener al menos 6 caracteres', true);
    if (a !== b) return toast('Las contraseñas no coinciden', true);
    try { await changePassword(a); toast('Contraseña actualizada'); $('#p1', d).value = $('#p2', d).value = ''; }
    catch (e) { toast(friendly(e), true); }
  };
}