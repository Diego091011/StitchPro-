import { requireAuth } from '../core/auth.js';
import { mountShell } from '../core/shell.js';
import { ordenEditor } from '../core/orden.js';
import { imprimirRecibo, whatsappUrl, itemsDe, abonado, saldo } from '../core/recibo.js';
import { $, money, esc, toast } from '../core/utils.js';
import * as S from '../services/index.js';

await requireAuth();
await mountShell('pedidos');

const ESTADOS = [['pendiente', 'Pendiente'], ['en_proceso', 'En proceso'], ['listo', 'Listo'], ['entregado', 'Entregado']];
const METODOS = ['Efectivo', 'Nequi', 'Daviplata', 'Transferencia', 'Tarjeta', 'Otro'];
const st = { ped: [], cli: [], srv: [], inv: [], cfg: null, maq: [] };
let Q = '', filtro = 'todas';
const match = (r) => !Q || JSON.stringify(r).toLowerCase().includes(Q);
const ord = (n) => '#' + String(n).padStart(5, '0');
const day = (d) => (d ? new Date(d).toLocaleDateString('es-CO') : '—');
const pedido = (id) => st.ped.find((p) => p.id === id);
const taller = () => ({ taller: st.cfg?.nombre_taller || 'StitchPro', telefono: st.cfg?.telefono_taller || '', direccion: st.cfg?.direccion_taller || '', pie: st.cfg?.pie_recibo || '' });

async function load() {
  try { [st.ped, st.cli, st.srv, st.inv, st.cfg, st.maq] = await Promise.all([S.pedidos.list(), S.clientes.list(), S.servicios.list(), S.inventario.list(), S.config.get(), S.maquinas.list()]); }
  catch (e) { toast(e.message, true); }
  [...st.ped].sort((a, b) => a.fecha_ingreso.localeCompare(b.fecha_ingreso)).forEach((p, i) => (p.num = i + 1));
  render();
}

function render() {
  const sum = (a, fn) => a.reduce((t, p) => t + fn(p), 0);
  $('#stats').innerHTML = [['Activas', st.ped.filter((p) => ['pendiente', 'en_proceso'].includes(p.estado)).length], ['Listas para entregar', st.ped.filter((p) => p.estado === 'listo').length],
    ['Por cobrar', money(sum(st.ped, saldo))], ['Cobrado', money(sum(st.ped, abonado))]].map(([l, v]) => `<div class="card stat"><small>${l}</small><b>${v}</b></div>`).join('');
  $('#filtros').innerHTML = [['todas', 'Todas'], ...ESTADOS].map(([k, l]) => `<button class="chip ${k === filtro ? 'on' : ''}" data-f="${k}">${l}</button>`).join('');
  $('#aviso').hidden = st.cli.length > 0;
  $('#aviso').innerHTML = 'Para crear órdenes necesitas registrar primero un cliente en <a class="lnk" href="clientes.html">Clientes</a>.';

  const list = st.ped.filter((p) => (filtro === 'todas' || p.estado === filtro) && match(p));
  $('#table').innerHTML = list.length
    ? `<table class="tbl"><thead><tr><th># Orden</th><th>Cliente</th><th>Servicios</th><th>Estado</th><th>Entrega</th><th>Total</th><th>Pagos</th><th></th></tr></thead><tbody>${list.map((p) => {
      const its = itemsDe(p), ab = abonado(p), tot = Number(p.total_cobrado), wa = whatsappUrl(p, { num: ord(p.num), ...taller() });
      return `<tr><td>${ord(p.num)}</td><td>${esc(p.clientes?.nombre_completo)}</td>
        <td>${esc(its.slice(0, 2).map((i) => (i.cantidad > 1 ? `${i.cantidad}× ` : '') + i.nombre).join(', '))}${its.length > 2 ? ` <small class="hint">+${its.length - 2}</small>` : ''}</td>
        <td><select class="est ${p.estado}" data-est="${p.id}">${ESTADOS.map(([k, l]) => `<option value="${k}" ${k === p.estado ? 'selected' : ''}>${l}</option>`).join('')}</select></td>
        <td>${day(p.fecha_entrega)}</td><td>${money(tot)}</td>
        <td>${p.pagado ? '<span class="paid">Pagado ✓</span>' : `${money(ab)} <small class="hint">de ${money(tot)}</small><div class="prog"><i style="width:${tot ? Math.min(100, (ab / tot) * 100) : 0}%"></i></div>`}</td>
        <td class="act"><button class="btn ghost sm" data-pay="${p.id}">Abonos</button><button class="btn ghost sm" data-rec="${p.id}">Recibo</button>${wa ? `<a class="btn ghost sm" href="${wa}" target="_blank" rel="noopener">WhatsApp</a>` : ''}<button class="btn ghost sm" data-edit="${p.id}">Editar</button><button class="btn bad sm" data-del="${p.id}">Eliminar</button></td></tr>`;
    }).join('')}</tbody></table>`
    : `<div class="empty">${st.ped.length ? 'Sin resultados' : 'Aún no hay órdenes. Crea la primera.'}</div>`;
}

/* ---------- Estado (el inventario se ajusta solo en la base de datos) ---------- */
async function setEstado(id, estado) {
  const antes = pedido(id).stock_descontado;
  try {
    await S.pedidos.update(id, { estado }); await load();
    const ahora = pedido(id).stock_descontado;
    if (!antes && ahora) toast('Materiales descontados del inventario');
    else if (antes && !ahora) toast('Materiales devueltos al inventario');
  } catch (e) { toast(e.message, true); load(); }
}

/* ---------- Crear / editar ---------- */
async function editar(row) {
  if (!st.cli.length) return toast('Primero registra un cliente', true);
  const v = await ordenEditor({ orden: row, cli: st.cli, srv: st.srv, inv: st.inv, cfg: st.cfg, maq: st.maq });
  if (!v) return;
  try { row ? await S.pedidos.update(row.id, v) : await S.pedidos.create(v); toast('Orden guardada'); await load(); }
  catch (e) { toast(e.message, true); }
}

/* ---------- Abonos ---------- */
function abonos(id) {
  const d = document.createElement('dialog');
  document.body.append(d);
  const draw = () => {
    const p = pedido(id); if (!p) return d.close();
    const s = saldo(p);
    d.innerHTML = `<h3>Abonos · ${ord(p.num)} · ${esc(p.clientes?.nombre_completo)}</h3>
      <div class="rpv"><div><span>Total</span><span>${money(p.total_cobrado)}</span></div><div><span>Abonado</span><span>${money(abonado(p))}</span></div><div class="tot"><span>Saldo</span><span>${money(s)}</span></div></div>
      <div style="margin:14px 0">${[...(p.pagos || [])].sort((a, b) => b.fecha.localeCompare(a.fecha)).map((x) => `<div class="catrow"><span>${money(x.monto)} · ${esc(x.metodo)} <small class="hint">${day(x.fecha)}${x.nota ? ' · ' + esc(x.nota) : ''}</small></span><button class="btn bad sm" data-delp="${x.id}">✕</button></div>`).join('') || '<div class="empty">Sin abonos todavía</div>'}</div>
      ${s > 0 ? `<div class="form"><label>Monto<input id="pm" type="number" min="1" step="any" value="${s}"></label><label>Método<select id="pt">${METODOS.map((m) => `<option>${m}</option>`).join('')}</select></label><label class="full">Nota (opcional)<input id="pn"></label></div>` : '<p class="paid">Orden pagada por completo ✓</p>'}
      <div class="modal-act"><button class="btn ghost" data-x>Cerrar</button>${s > 0 ? '<button class="btn green" id="padd">Registrar abono</button>' : ''}</div>`;
    d.querySelector('[data-x]').onclick = () => d.close();
    d.querySelectorAll('[data-delp]').forEach((b) => (b.onclick = async () => {
      if (!confirm('¿Eliminar este abono?')) return;
      try { await S.pagos.remove(b.dataset.delp); await load(); draw(); } catch (e) { toast(e.message, true); }
    }));
    d.querySelector('#padd')?.addEventListener('click', async () => {
      const monto = Number(d.querySelector('#pm').value);
      if (!(monto > 0)) return toast('Ingresa un monto válido', true);
      if (monto > s) return toast(`El abono supera el saldo (${money(s)})`, true);
      try { await S.pagos.create({ pedido_id: id, monto, metodo: d.querySelector('#pt').value, nota: d.querySelector('#pn').value.trim() || null }); toast('Abono registrado'); await load(); draw(); }
      catch (e) { toast(e.message, true); }
    });
  };
  draw();
  d.addEventListener('close', () => d.remove());
  d.showModal();
}

/* ---------- Eventos ---------- */
$('#new').onclick = () => editar(null);
$('#page').addEventListener('click', async (e) => {
  const g = (a) => e.target.closest(`[data-${a}]`)?.dataset[a];
  if (g('f')) { filtro = g('f'); render(); }
  else if (g('pay')) abonos(g('pay'));
  else if (g('rec')) { const p = pedido(g('rec')); if (!imprimirRecibo(p, { num: ord(p.num), ...taller() })) toast('Permite las ventanas emergentes para ver el recibo', true); }
  else if (g('edit')) editar(pedido(g('edit')));
  else if (g('del') && confirm('¿Eliminar esta orden? Si ya descontó materiales, se devolverán al inventario.')) {
    try { await S.pedidos.remove(g('del')); toast('Orden eliminada'); await load(); } catch (err) { toast(err.message, true); }
  }
});
$('#page').addEventListener('change', (e) => { const s = e.target.closest('[data-est]'); if (s) setEstado(s.dataset.est, s.value); });
document.addEventListener('shell:search', (e) => { Q = e.detail; render(); });
load();