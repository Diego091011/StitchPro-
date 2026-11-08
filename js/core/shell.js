import { getSession } from './auth.js';
import { SPRITE, ic } from './icons.js';
import { $, esc, toast } from './utils.js';
import { infoModal } from './modal.js';
import { applyTheme, getTheme, toggleTheme } from './theme.js';
import { notificaciones } from './notificaciones.js';
import { abrirPerfil, confirmarSalida } from './perfil.js';
import { decorar } from './decor.js';
import * as S from '../services/index.js';

// [id, página, icono, etiqueta, disponible]
const NAV = [
  ['dashboard', 'dashboard.html', 'grid', 'Dashboard', true],
  ['pedidos', 'pedidos.html', 'clip', 'Órdenes', true],
  ['catalogo', 'catalogo.html', 'layers', 'Catálogo', true],
  ['clientes', 'clientes.html', 'users', 'Clientes', true],
  ['inventario', 'inventario.html', 'box', 'Inventario', true],
  ['reportes', 'reportes.html', 'trend', 'Reportes', true],
  ['asistente', 'asistente.html', 'sparkle', 'Asistente', true],
  ['config', 'config.html', 'set', 'Configuración', true],
];
let notifs = [];

/* ---------- Instalación (PWA) ---------- */
const enElectron = /Electron/i.test(navigator.userAgent);
const instalada = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
let aviso = null; // evento beforeinstallprompt (Chrome, Edge, Android)
if (!enElectron) {
  document.head.insertAdjacentHTML('beforeend', '<link rel="manifest" href="manifest.webmanifest"><meta name="theme-color" content="#7c3aed"><link rel="apple-touch-icon" href="assets/icons/icon-180.png"><meta name="apple-mobile-web-app-capable" content="yes">');
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
  addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); aviso = e; });
  addEventListener('appinstalled', () => { aviso = null; const b = document.querySelector('#install'); if (b) b.hidden = true; toast('StitchPro instalada'); });
}
function guiaInstalar() {
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent), android = /android/i.test(navigator.userAgent);
  const pasos = ios ? '<li>Abre esta página en <b>Safari</b>.</li><li>Toca el botón <b>Compartir</b> (cuadro con flecha).</li><li>Elige <b>Añadir a pantalla de inicio</b>.</li>'
    : android ? '<li>Abre el menú <b>⋮</b> del navegador.</li><li>Elige <b>Instalar aplicación</b> o <b>Añadir a pantalla de inicio</b>.</li>'
    : '<li>En <b>Chrome o Edge</b>, busca el icono de instalar en la barra de direcciones, o abre el menú <b>⋮</b> → <b>Instalar StitchPro</b>.</li><li>Firefox y Safari de escritorio no permiten instalarla; usa Chrome o Edge.</li>';
  infoModal({ title: 'Instalar StitchPro', html: `<ol style="padding-left:20px;display:grid;gap:8px;color:var(--tx)">${pasos}</ol><p style="margin-top:12px">La instalación solo está disponible cuando la app se abre desde una dirección segura (https) o desde localhost.</p>` });
}
async function instalar() {
  if (!aviso) return guiaInstalar();
  aviso.prompt();
  await aviso.userChoice;
  aviso = null;
}

function pintarNotifs() {
  const n = notifs.length, b = $('#bell-n');
  b.hidden = !n; b.textContent = n > 9 ? '9+' : n;
  $('#notif-list').innerHTML = n
    ? notifs.map((x) => `<a class="ni ${x.c}" href="${x.href}">${ic(x.icon)}<div><b>${esc(x.t)}</b><small>${esc(x.d)}</small></div></a>`).join('')
    : `<div class="empty">${ic('sparkle')}<br>Todo al día</div>`;
}
async function refrescar() { try { notifs = await notificaciones(); } catch { notifs = []; } pintarNotifs(); }
/** Las páginas pueden pedir que se recalculen los avisos tras cambiar datos. */
export const setBell = () => refrescar();

function pintarTema() { $('#theme').innerHTML = ic(getTheme() === 'dark' ? 'sun' : 'moon'); $('#theme').title = getTheme() === 'dark' ? 'Modo claro' : 'Modo oscuro'; }

/** Monta sidebar + barra superior alrededor de <main id="page"> y muestra la página. */
export async function mountShell(active) {
  applyTheme();
  // Garantiza los estilos comunes (modales, tablas, botones) aunque la página no los enlace
  ['base', 'layout', 'components'].forEach((n) => {
    if (!document.querySelector(`link[href*="${n}.css"]`)) document.head.insertAdjacentHTML('beforeend', `<link rel="stylesheet" href="assets/css/${n}.css">`);
  });
  const nav = NAV.map(([id, href, icon, label]) => `<a class="nav ${id === active ? 'on' : ''}" href="${href}">${ic(icon)}${label}</a>`).join('');
  document.body.classList.add('app');
  document.body.insertAdjacentHTML('afterbegin', `${SPRITE}
    <aside class="sidebar">
      <div class="logo">${ic('dress')}<div class="brand">Stitch<span>Pro</span></div><small>Gestiona · Cose · Crece</small></div>
      ${nav}
      <div class="promo">Tu taller,<br>más organizado</div>
      <button class="me" id="me-btn" title="Ver perfil"><div class="av" id="av">·</div><div><b id="me">—</b><small id="me-sub">Administrador</small></div></button>
      <button class="nav" id="logout">${ic('out')}Cerrar sesión</button>
    </aside>
    <div class="shell"><header class="top">
      <label class="search">${ic('find')}<input id="search" placeholder="Buscar órdenes, clientes…"></label>
      <button class="tb" id="install" title="Instalar app" hidden>${ic('download')}</button>
      <button class="tb" id="theme"></button>
      <button class="tb bell" id="bell" title="Notificaciones">${ic('bell')}<span id="bell-n" hidden>0</span></button>
      <button class="tb av" id="av2" title="Perfil">·</button>
      <div class="notif" id="notif" hidden><div class="notif-h">Notificaciones</div><div id="notif-list"></div></div>
    </header></div>`);
  $('.shell').append($('#page'));

  $('#logout').onclick = confirmarSalida;
  $('#me-btn').onclick = $('#av2').onclick = abrirPerfil;
  $('#theme').onclick = () => { toggleTheme(); pintarTema(); };
  $('#install').hidden = enElectron || instalada();
  $('#install').onclick = instalar;
  $('#bell').onclick = (e) => { e.stopPropagation(); const p = $('#notif'); p.hidden = !p.hidden; if (!p.hidden) refrescar(); };
  document.addEventListener('click', (e) => { if (!e.target.closest('#notif')) $('#notif').hidden = true; });
  $('#search').addEventListener('input', (e) => document.dispatchEvent(new CustomEvent('shell:search', { detail: e.target.value.trim().toLowerCase() })));
  pintarTema();

  const s = await getSession(), inicial = s.user.email[0].toUpperCase();
  $('#me').textContent = s.user.email; $('#av').textContent = $('#av2').textContent = inicial;
  decorar();
  document.addEventListener('taller:change', (e) => { $('#me-sub').textContent = e.detail || 'Administrador'; });
  S.config.get().then((c) => { if (c?.nombre_taller) $('#me-sub').textContent = c.nombre_taller; }).catch(() => {});
  document.body.classList.add('ready');
  refrescar();
}