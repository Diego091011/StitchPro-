import { requireAuth } from '../core/auth.js';
import { mountShell, setBell } from '../core/shell.js';
import { $, $$, money, date, esc, toast } from '../core/utils.js';
import { ic } from '../core/icons.js';
import { spark } from '../core/charts.js';
import { cotizar, costoEnergiaMin } from '../calculator.js';
import * as S from '../services/index.js';

await requireAuth();
await mountShell('dashboard');

const st = { cfg: null, inv: [], ped: [] };
let Q = '';
const ESTADO = { pendiente: 'Pendiente', en_proceso: 'En Proceso', listo: 'Listo', entregado: 'Entregado' };
const pill = (e) => `<span class="pill ${e}"><i></i>${ESTADO[e] || e}</span>`;
const ord = (n) => '#' + String(n || 0).padStart(5, '0');
const mk = (d) => d.getFullYear() * 12 + d.getMonth();
const match = (r) => !Q || JSON.stringify(r).toLowerCase().includes(Q);

/* ---------- Datos ---------- */
async function load() {
  try { [st.cfg, st.inv, st.ped] = await Promise.all([S.config.get(), S.inventario.list(), S.pedidos.list()]); }
  catch (e) { toast(e.message, true); }
  [...st.ped].sort((a, b) => a.fecha_ingreso.localeCompare(b.fecha_ingreso)).forEach((p, i) => (p.num = i + 1));
  kpis(); recientes(); chips(); price();
  setBell(st.ped.filter((p) => p.estado === 'listo').length);
}

/* ---------- KPIs ---------- */
const serie = (fn) => [5, 4, 3, 2, 1, 0].map((o) => st.ped.filter((p) => mk(new Date(p.fecha_ingreso)) === mk(new Date()) - o).reduce((a, p) => a + fn(p), 0));
function delta(d, goodUp = true) {
  const [cur, prev] = [d[5], d[4]];
  if (!prev) return 'Sin mes anterior';
  const p = ((cur - prev) / prev) * 100, up = p >= 0;
  return `<span class="${up === goodUp ? 'pos' : 'neg'}">${up ? '↑ +' : '↓ '}${p.toFixed(1)}%</span> vs mes anterior`;
}
function kpis() {
  const eMin = st.cfg ? costoEnergiaMin(st.cfg.potencia_maquina_w, st.cfg.precio_kwh) : 0;
  const sU = serie((p) => (p.pagado ? Number(p.total_cobrado) - Number(p.servicios?.costo_neto || 0) : 0));
  const sA = serie(() => 1);
  const sE = serie((p) => (p.servicios?.minutos_estimados || 0) * eMin);
  const activas = st.ped.filter((p) => ['pendiente', 'en_proceso'].includes(p.estado)).length;
  const nuevas = st.ped.filter((p) => Date.now() - new Date(p.fecha_ingreso) < 7 * 864e5).length;
  const card = (c, icon, l, v, sub, id) => `<div class="card kpi" style="--c:${c}">${ic(icon)}<div><small>${l}</small><b>${v}</b><span class="sub">${sub}</span></div><canvas id="${id}"></canvas></div>`;
  $('#kpis').innerHTML = card('#22e58f', 'trend', 'Utilidad Neta Mensual', money(sU[5]), delta(sU), 'k1')
    + card('#8b5cf6', 'hanger', 'Órdenes Activas', activas, `<span class="pos">↑ +${nuevas}</span> nuevas (7 días)`, 'k2')
    + card('#22d3ee', 'bolt', 'Costo Energía Eléctrica', money(sE[5]), delta(sE, false), 'k3');
  spark($('#k1'), sU, '#22e58f'); spark($('#k2'), sA, '#8b5cf6'); spark($('#k3'), sE, '#22d3ee');
}

/* ---------- Órdenes recientes ---------- */
function recientes() {
  const rows = st.ped.filter(match).slice(0, 5);
  $('#recientes').innerHTML = rows.length
    ? `<table class="tbl"><thead><tr><th># Orden</th><th>Cliente</th><th>Prenda</th><th>Tipo</th><th>Fecha</th><th>Estado</th><th>Total</th></tr></thead><tbody>${rows.map((p) =>
      `<tr><td>${ord(p.num)}</td><td>${esc(p.clientes?.nombre_completo)}</td><td>${esc(p.servicios?.nombre)}</td><td>${p.servicios?.tipo === 'confeccion' ? 'Confección' : 'Arreglo'}</td><td>${date(p.fecha_ingreso)}</td><td>${pill(p.estado)}</td><td>${money(p.total_cobrado)}</td></tr>`).join('')}</tbody></table>`
    : `<div class="empty">${Q ? 'Sin resultados' : 'Aún no hay órdenes registradas.'}</div>`;
}

/* ---------- Cotización rápida ---------- */
const PRENDAS = ['Pantalón', 'Camisa', 'Vestido', 'Falda', 'Chaqueta', 'Otra'];
const ALT = { arreglo_rapido: ['Ajuste de cintura', 'Bota / dobladillo', 'Cambio de cierre', 'Ajuste de largo', 'Ajuste de costados'], confeccion: ['Confección completa', 'Prenda a medida', 'Diseño especial'] };
const dq = { tipo: 'arreglo_rapido', mats: new Set(), res: null };
const altOptions = () => ($('#dq-alt').innerHTML = ALT[dq.tipo].map((a) => `<option>${a}</option>`).join(''));
const input = () => ({ minutos: Math.round(Number($('#dq-horas').value) * 60), margenPct: Number($('#dq-margen').value) || 0, insumos: [...dq.mats].map((id) => ({ insumo_id: id, cantidad: 1 })) });

function chips() {
  dq.mats.forEach((id) => !st.inv.some((i) => i.id === id) && dq.mats.delete(id));
  $('#dq-mats').innerHTML = st.inv.slice(0, 8).map((i) => `<button type="button" class="chip ${dq.mats.has(i.id) ? 'on' : ''}" data-mat="${i.id}">${esc(i.nombre)} ${money(i.costo_unidad)}</button>`).join('')
    || '<span class="hint">Aún no hay insumos (llegarán con el módulo Inventario).</span>';
}
function price() {
  $('#dq-hlbl').textContent = $('#dq-horas').value + ' h';
  $('#dq-hint').innerHTML = st.cfg ? '' : 'Para calcular, primero define tus <a href="config.html">costos base en Configuración</a>.';
  dq.res = null; $('#dq-precio').textContent = '—';
  if (!st.cfg) return;
  try { dq.res = cotizar(input(), st.cfg, st.inv); $('#dq-precio').textContent = money(dq.res.precio_final); }
  catch (e) { toast(e.message, true); }
}

$('#dq-prenda').innerHTML = PRENDAS.map((p) => `<option>${p}</option>`).join('');
altOptions();
['#dq-horas', '#dq-margen'].forEach((s) => $(s).addEventListener('input', price));
$('#page').addEventListener('click', (e) => {
  const tipo = e.target.closest('[data-tipo]'), mat = e.target.closest('[data-mat]');
  if (tipo) { dq.tipo = tipo.dataset.tipo; $$('[data-tipo]').forEach((x) => x.classList.toggle('on', x === tipo)); altOptions(); }
  else if (mat) { dq.mats.has(mat.dataset.mat) ? dq.mats.delete(mat.dataset.mat) : dq.mats.add(mat.dataset.mat); chips(); price(); }
});
$('#dq-calc').onclick = () => { price(); const b = $('#dq-precio'); b.classList.remove('pop'); void b.offsetWidth; b.classList.add('pop'); };
$('#dq-save').onclick = async () => {
  price(); if (!dq.res) return toast('Define primero tus costos base', true);
  const q = input();
  try {
    await S.servicios.create({ tipo: dq.tipo, nombre: `${$('#dq-prenda').value} · ${$('#dq-alt').value}`, minutos_estimados: q.minutos, insumos_usados: q.insumos, margen_ganancia_pct: q.margenPct, costo_neto: dq.res.costo_neto, precio_final: dq.res.precio_final });
    toast('Servicio guardado');
  } catch (e) { toast(e.message, true); }
};

/* ---------- Eventos globales ---------- */
document.addEventListener('shell:search', (e) => { Q = e.detail; recientes(); });
addEventListener('resize', kpis);
load();
