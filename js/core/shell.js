import { signOut, getSession } from './auth.js';
import { SPRITE, ic } from './icons.js';
import { $ } from './utils.js';

// [id, página, icono, etiqueta, disponible]
const NAV = [
  ['dashboard', 'dashboard.html', 'home', 'Dashboard', true],
  ['catalogo', 'catalogo.html', 'hanger', 'Catálogo', true],
  ['cotizador', 'cotizador.html', 'calc', 'Cotizador', true],
  ['pedidos', 'pedidos.html', 'clip', 'Órdenes', true],
  ['inventario', 'inventario.html', 'box', 'Inventario', true],
  ['clientes', 'clientes.html', 'users', 'Clientes', true],
  ['config', 'config.html', 'set', 'Configuración', true],
];

/** Monta sidebar + barra superior alrededor de <main id="page"> y muestra la página. */
export async function mountShell(active) {
  const nav = NAV.map(([id, href, icon, label, ok]) => ok
    ? `<a class="nav ${id === active ? 'on' : ''}" href="${href}">${ic(icon)}${label}</a>`
    : `<span class="nav off" title="Próximamente">${ic(icon)}${label}<em>Pronto</em></span>`).join('');
  document.body.classList.add('app');
  document.body.insertAdjacentHTML('afterbegin', `${SPRITE}
    <aside class="sidebar">
      <div class="logo">${ic('dress')}<div class="brand">Stitch<span>Pro</span></div><small>Gestiona · Cose · Crece</small></div>
      ${nav}
      <div class="promo">Tu taller,<br>más organizado</div>
      <div class="me"><div class="av" id="av">·</div><div><b id="me">—</b><small>Administrador</small></div></div>
      <button class="nav" id="logout">${ic('out')}Cerrar sesión</button>
    </aside>
    <div class="shell"><header class="top">
      <label class="search">${ic('find')}<input id="search" placeholder="Buscar órdenes, clientes…"></label>
      <button class="bell" id="bell" title="Órdenes listas">${ic('bell')}<span id="bell-n" hidden>0</span></button>
    </header></div>`);
  $('.shell').append($('#page'));
  $('#logout').onclick = signOut;
  $('#bell').onclick = () => (location.href = 'pedidos.html');
  $('#search').addEventListener('input', (e) => document.dispatchEvent(new CustomEvent('shell:search', { detail: e.target.value.trim().toLowerCase() })));
  const s = await getSession();
  $('#me').textContent = s.user.email; $('#av').textContent = s.user.email[0].toUpperCase();
  document.body.classList.add('ready');
}
export function setBell(n) { const b = $('#bell-n'); b.hidden = !n; b.textContent = n; }