import { requireAuth } from '../core/auth.js';
import { mountShell, setBell } from '../core/shell.js';
import { $, money, moneyU, date, esc, toast } from '../core/utils.js';
import { insumoOptions } from '../core/receta.js';
import { ic } from '../core/icons.js';
import { spark } from '../core/charts.js';
import { cotizar, costoEnergiaMin } from '../calculator.js';
import * as S from '../services/index.js';

await requireAuth();
await mountShell('dashboard');

const col = (v) => getComputedStyle(document.documentElement).getPropertyValue(v).trim();
const st = { cfg: null, inv: [], ped: [], srv: [], cli: [], maq: [] };
let Q = '';
const ESTADO = { pendiente: 'Pendiente', en_proceso: 'En Proceso', listo: 'Listo', entregado: 'Entregado' };
const pill = (e) => `<span class="pill ${e}"><i></i>${ESTADO[e] || e}</span>`;
const ord = (n) => '#' + String(n || 0).padStart(5, '0');
const itemsOf = (p) => (p.items?.length ? p.items : p.servicios ? [{ nombre: p.servicios.nombre, tipo: p.servicios.tipo, cantidad: 1, minutos: p.servicios.minutos_estimados, costo_neto: p.servicios.costo_neto }] : []);
const costoDe = (p) => itemsOf(p).reduce((a, i) => a + (i.cantidad || 1) * Number(i.costo_neto || 0), 0);
const minsDe = (p) => itemsOf(p).reduce((a, i) => a + (i.cantidad || 1) * Number(i.minutos || 0), 0);
const energiaDe = (p, eMin) => itemsOf(p).reduce((a, i) => a + (i.cantidad || 1) * (i.energia != null ? Number(i.energia) : Number(i.minutos || 0) * eMin), 0);
const mk = (d) => d.getFullYear() * 12 + d.getMonth();
const match = (r) => !Q || JSON.stringify(r).toLowerCase().includes(Q);

/* ---------- Datos ---------- */
async function load() {
  try { [st.cfg, st.inv, st.ped, st.srv, st.cli, st.maq] = await Promise.all([S.config.get(), S.inventario.list(), S.pedidos.list(), S.servicios.list(), S.clientes.list(), S.maquinas.list()]); }
  catch (e) { toast(e.message, true); }
  [...st.ped].sort((a, b) => a.fecha_ingreso.localeCompare(b.fecha_ingreso)).forEach((p, i) => (p.num = i + 1));
  kpis(); recientes(); catalogo(); price();
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
  const sU = serie((p) => (p.pagado ? Number(p.total_cobrado) - costoDe(p) : 0));
  const sA = serie(() => 1);
  const sE = serie((p) => energiaDe(p, eMin));
  const activas = st.ped.filter((p) => ['pendiente', 'en_proceso'].includes(p.estado)).length;
  const nuevas = st.ped.filter((p) => Date.now() - new Date(p.fecha_ingreso) < 7 * 864e5).length;
  const [cG, cP, cC] = [col('--ok'), col('--ac'), col('--ac2')];
  const card = (c, icon, l, v, sub, id) => `<div class="card kpi" style="--c:${c}">${ic(icon)}<div><small>${l}</small><b>${v}</b><span class="sub">${sub}</span></div><canvas id="${id}"></canvas></div>`;
  $('#kpis').innerHTML = card(cG, 'trend', 'Utilidad Neta Mensual', money(sU[5]), delta(sU), 'k1')
    + card(cP, 'hanger', 'Órdenes Activas', activas, `<span class="pos">↑ +${nuevas}</span> nuevas (7 días)`, 'k2')
    + card(cC, 'bolt', 'Costo Energía Eléctrica', money(sE[5]), delta(sE, false), 'k3');
  spark($('#k1'), sU, cG); spark($('#k2'), sA, cP); spark($('#k3'), sE, cC);
}

/* ---------- Órdenes recientes ---------- */
function recientes() {
  const rows = st.ped.filter(match).slice(0, 5);
  $('#recientes').innerHTML = rows.length
    ? `<table class="tbl"><thead><tr><th># Orden</th><th>Cliente</th><th>Prenda</th><th>Tipo</th><th>Fecha</th><th>Estado</th><th>Total</th></tr></thead><tbody>${rows.map((p) =>
      `<tr><td>${ord(p.num)}</td><td>${esc(p.clientes?.nombre_completo)}</td><td>${esc(itemsOf(p).map((i) => i.nombre).join(', '))}</td><td>${itemsOf(p).some((i) => i.tipo === 'confeccion') ? 'Confección' : 'Arreglo'}</td><td>${date(p.fecha_ingreso)}</td><td>${pill(p.estado)}</td><td>${money(p.total_cobrado)}</td></tr>`).join('')}</tbody></table>`
    : `<div class="empty">${Q ? 'Sin resultados' : 'Aún no hay órdenes registradas.'}</div>`;
}

/* ---------- Cotización rápida (usa el catálogo) ---------- */
const dq = { tipo: 'arreglo_rapido', item: null, mats: [], res: null, maq: [], base: 0 };
const label = (s) => `${s.nombre}${s.prenda ? ' · ' + s.prenda : ''}`;
const lista = () => st.srv.filter((s) => s.tipo === dq.tipo && (!$('#dq-prenda').value || s.prenda === $('#dq-prenda').value));
const dur = (m) => (m >= 60 ? `${Math.floor(m / 60)} h${m % 60 ? ' ' + (m % 60) + ' min' : ''}` : `${m} min`);

function catalogo() {
  const prendas = [...new Set(st.srv.filter((s) => s.tipo === dq.tipo).map((s) => s.prenda).filter(Boolean))].sort();
  const sel = $('#dq-prenda').value;
  $('#dq-prenda').innerHTML = '<option value="">Todas</option>' + prendas.map((p) => `<option ${p === sel ? 'selected' : ''}>${esc(p)}</option>`).join('');
  $('#dq-list').innerHTML = lista().map((s) => `<option value="${esc(label(s))}">`).join('');
  $('#dq-addmat').innerHTML = '<option value="">Agregar material…</option>' + insumoOptions(st.inv);
  $('#dq-cli').innerHTML = '<option value="">Cliente (para crear orden)…</option>' + st.cli.map((c) => `<option value="${c.id}">${esc(c.nombre_completo)}</option>`).join('');
  if (dq.item && !st.srv.some((s) => s.id === dq.item.id)) dq.item = null;
  if (!dq.item && st.cfg) $('#dq-margen').value = st.cfg.margen_defecto ?? 30;
  drawMats();
}
function drawMats() {
  dq.mats = dq.mats.filter((m) => st.inv.some((i) => i.id === m.insumo_id));
  $('#dq-mats').innerHTML = dq.mats.length ? dq.mats.map((m, i) => {
    const it = st.inv.find((x) => x.id === m.insumo_id);
    return `<div class="mrow"><span>${esc(it.nombre)}</span><input type="number" min="0" step="any" value="${m.cantidad}" data-mi="${i}"><small>${esc(it.unidad_medida)}</small><b>${moneyU(it.costo_unidad * m.cantidad)}</b><button type="button" class="btn ghost sm" data-mrm="${i}">✕</button></div>`;
  }).join('') : '<span class="hint">Sin materiales. Elige un servicio del catálogo o agrega los que uses.</span>';
}
function pick(s) {
  dq.item = s;
  $('#dq-min').value = Math.min(600, Math.max(1, s.minutos_estimados)); $('#dq-margen').value = s.margen_ganancia_pct;
  dq.mats = (s.insumos_usados || []).map((m) => ({ ...m }));
  dq.maq = (s.maquinas || []).map((m) => ({ ...m })); dq.base = s.minutos_estimados;
  drawMats(); price();
}
function price() {
  const min = Number($('#dq-min').value);
  $('#dq-hlbl').textContent = dur(min);
  $('#dq-hint').innerHTML = !st.cfg ? 'Para calcular, define tus <a href="config.html">costos base en Configuración</a>.'
    : !st.srv.length ? 'Crea tus arreglos y prendas en el <a href="catalogo.html">Catálogo</a> para cotizar al instante.' : '';
  dq.res = null; $('#dq-precio').textContent = '—'; $('#dq-desg').textContent = '';
  if (!st.cfg) return;
  try {
    const maquinas = dq.maq.map((u) => ({ ...u, minutos: (u.minutos * min) / (dq.base || min) }));
    dq.res = cotizar({ minutos: min, margenPct: Number($('#dq-margen').value) || 0, insumos: dq.mats, maquinas }, st.cfg, st.inv, st.maq);
    const d = dq.res.desglose;
    $('#dq-precio').textContent = money(dq.res.precio_final);
    $('#dq-desg').textContent = `Materiales ${money(d.materiales)} · Mano de obra ${money(d.manoObra)} · Energía ${money(d.energia)}`;
  } catch (e) { toast(e.message, true); }
}

$('#dq-buscar').addEventListener('change', (e) => { const s = lista().find((x) => label(x) === e.target.value); if (s) pick(s); });
$('#dq-prenda').addEventListener('change', () => { $('#dq-list').innerHTML = lista().map((s) => `<option value="${esc(label(s))}">`).join(''); $('#dq-buscar').value = ''; });
['#dq-min', '#dq-margen'].forEach((x) => $(x).addEventListener('input', price));
$('#dq-addbtn').onclick = () => {
  const id = $('#dq-addmat').value; if (!id) return;
  const ex = dq.mats.find((m) => m.insumo_id === id);
  ex ? (ex.cantidad += 1) : dq.mats.push({ insumo_id: id, cantidad: 1 });
  $('#dq-addmat').value = ''; drawMats(); price();
};
$('#dq-mats').addEventListener('input', (e) => {
  const i = e.target.dataset.mi; if (i == null) return;
  dq.mats[i].cantidad = Number(e.target.value) || 0;
  const it = st.inv.find((x) => x.id === dq.mats[i].insumo_id);
  e.target.closest('.mrow').querySelector('b').textContent = moneyU(it.costo_unidad * dq.mats[i].cantidad);
  price();
});
$('#dq-mats').addEventListener('click', (e) => { const b = e.target.closest('[data-mrm]'); if (b) { dq.mats.splice(Number(b.dataset.mrm), 1); drawMats(); price(); } });
$('#page').addEventListener('click', (e) => {
  const tipo = e.target.closest('[data-tipo]');
  if (!tipo) return;
  dq.tipo = tipo.dataset.tipo; dq.item = null; dq.maq = []; $('#dq-buscar').value = '';
  document.querySelectorAll('[data-tipo]').forEach((x) => x.classList.toggle('on', x === tipo));
  catalogo();
});
$('#dq-calc').onclick = () => { price(); const b = $('#dq-precio'); b.classList.remove('pop'); void b.offsetWidth; b.classList.add('pop'); };
$('#dq-order').onclick = async () => {
  price();
  if (!dq.res) return toast('Define primero tus costos base', true);
  if (!dq.item) return toast('Elige un servicio del catálogo', true);
  const cid = $('#dq-cli').value;
  if (!cid) return toast('Elige el cliente', true);
  try { await S.pedidos.create({ cliente_id: cid, servicio_id: dq.item.id, total_cobrado: dq.res.precio_final, items: [{ servicio_id: dq.item.id, nombre: dq.item.nombre, prenda: dq.item.prenda, tipo: dq.item.tipo, cantidad: 1, precio: dq.res.precio_final, minutos: Number($('#dq-min').value), costo_neto: dq.res.costo_neto, energia: dq.res.desglose.energia, insumos: dq.mats }] }); toast('Orden creada'); await load(); }
  catch (e) { toast(e.message, true); }
};

/* ---------- Eventos globales ---------- */
document.addEventListener('shell:search', (e) => { Q = e.detail; recientes(); });
addEventListener('resize', kpis);
document.addEventListener('theme:change', kpis);
load();