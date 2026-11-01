import { requireAuth } from '../core/auth.js';
import { mountShell } from '../core/shell.js';
import { $, $$, money, esc, toast } from '../core/utils.js';
import { cotizar, costoManoObraMin, costoEnergiaMin } from '../calculator.js';
import * as S from '../services/index.js';

await requireAuth();
await mountShell('cotizador');

const st = { cfg: null, inv: [], srv: [], editing: null, res: null };
let Q = '';
const m2 = (n) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 2 }).format(n || 0);
const TIPO = { arreglo_rapido: 'Arreglo', confeccion: 'Confección' };

/* ---------- Datos ---------- */
async function load() {
  try { [st.cfg, st.inv, st.srv] = await Promise.all([S.config.get(), S.inventario.list(), S.servicios.list()]); }
  catch (e) { toast(e.message, true); }
  $('#c-empty').hidden = st.inv.length > 0;
  list();
}

/* ---------- Insumos del formulario ---------- */
function addRow(id = '', qty = 1) {
  const r = document.createElement('div');
  r.className = 'row';
  r.innerHTML = `<select><option value="">Insumo…</option>${st.inv.map((i) => `<option value="${i.id}" ${i.id === id ? 'selected' : ''}>${esc(i.nombre)} · ${money(i.costo_unidad)}/${esc(i.unidad_medida)}</option>`).join('')}</select>
    <input type="number" min="0" step="any" value="${qty}"><button type="button" class="btn ghost sm" title="Quitar">✕</button>`;
  r.querySelector('button').onclick = () => { r.remove(); calc(); };
  $('#c-rows').append(r);
}
const input = () => ({
  minutos: Math.round(Number($('#c-min').value) || 0),
  margenPct: Number($('#c-margen').value) || 0,
  insumos: $$('#c-rows .row').map((r) => ({ insumo_id: r.children[0].value, cantidad: Number(r.children[1].value) || 0 })).filter((i) => i.insumo_id),
});

/* ---------- Cálculo ---------- */
function calc() {
  const el = $('#c-res');
  st.res = null;
  if (!st.cfg) { el.innerHTML = '<div class="empty">Define primero tus <a class="lnk" href="config.html">costos base</a> para calcular.</div>'; return; }
  try {
    const q = input();
    st.res = cotizar(q, st.cfg, st.inv);
    const d = st.res.desglose;
    const cm = costoManoObraMin(st.cfg.sueldo_base, st.cfg.horas_mes), em = costoEnergiaMin(st.cfg.potencia_maquina_w, st.cfg.precio_kwh);
    el.innerHTML = `<div><span>Materiales</span><span>${money(d.materiales)}</span></div>
      <div><span>Mano de obra (${q.minutos} min)</span><span>${money(d.manoObra)}</span></div>
      <div><span>Energía</span><span>${money(d.energia)}</span></div>
      <div class="rate">Tarifas: mano de obra ${m2(cm)}/min · energía ${m2(em)}/min</div>
      <div><span>Costo neto</span><span>${money(st.res.costo_neto)}</span></div>
      <div><span>Ganancia (${q.margenPct}%)</span><span class="pos">${money(st.res.ganancia)}</span></div>
      <div class="tot"><span>Precio final</span><span>${money(st.res.precio_final)}</span></div>`;
  } catch (e) { el.innerHTML = `<div class="empty neg">${esc(e.message)}</div>`; }
}

/* ---------- Edición / guardado ---------- */
function setEditing(s) {
  st.editing = s?.id || null;
  $('#c-editing').hidden = !s;
  $('#c-editing').textContent = s ? `Editando: ${s.nombre}` : '';
  $('#c-save').textContent = s ? 'Actualizar servicio' : 'Guardar servicio';
}
function reset() {
  setEditing(null);
  $('#c-nombre').value = ''; $('#c-tipo').value = 'arreglo_rapido'; $('#c-min').value = 30; $('#c-margen').value = 30;
  $('#c-rows').innerHTML = ''; calc();
}
function fill(s) {
  setEditing(s);
  $('#c-nombre').value = s.nombre; $('#c-tipo').value = s.tipo; $('#c-min').value = s.minutos_estimados; $('#c-margen').value = s.margen_ganancia_pct;
  $('#c-rows').innerHTML = '';
  (s.insumos_usados || []).filter((i) => st.inv.some((x) => x.id === i.insumo_id)).forEach((i) => addRow(i.insumo_id, i.cantidad));
  calc(); scrollTo({ top: 0, behavior: 'smooth' });
}
async function save() {
  const nombre = $('#c-nombre').value.trim();
  calc();
  if (!nombre) return toast('Ponle un nombre al servicio', true);
  if (!st.res) return toast('Revisa los datos de la cotización', true);
  const q = input();
  const row = { tipo: $('#c-tipo').value, nombre, minutos_estimados: q.minutos, insumos_usados: q.insumos, margen_ganancia_pct: q.margenPct, costo_neto: st.res.costo_neto, precio_final: st.res.precio_final };
  try {
    const s = st.editing ? await S.servicios.update(st.editing, row) : await S.servicios.create(row);
    setEditing(s); toast('Servicio guardado'); await load();
  } catch (e) { toast(e.message, true); }
}

/* ---------- Lista de servicios guardados ---------- */
function list() {
  const rows = st.srv.filter((s) => !Q || JSON.stringify(s).toLowerCase().includes(Q));
  $('#c-list').innerHTML = rows.length
    ? `<table class="tbl"><thead><tr><th>Servicio</th><th>Tipo</th><th>Minutos</th><th>Costo neto</th><th>Precio final</th><th></th></tr></thead><tbody>${rows.map((s) =>
      `<tr><td>${esc(s.nombre)}</td><td><span class="tag">${TIPO[s.tipo] || s.tipo}</span></td><td>${s.minutos_estimados}</td><td>${money(s.costo_neto)}</td><td class="pos">${money(s.precio_final)}</td>
      <td class="act"><button class="btn ghost sm" data-load="${s.id}">Cargar</button><button class="btn bad sm" data-del="${s.id}">Eliminar</button></td></tr>`).join('')}</tbody></table>`
    : `<div class="empty">${st.srv.length ? 'Sin resultados' : 'Aún no hay servicios guardados.'}</div>`;
}

/* ---------- Eventos ---------- */
await load();
calc();
$('#c-add').onclick = () => addRow();
$('#c-new').onclick = reset;
$('#c-save').onclick = save;
['#c-min', '#c-margen'].forEach((s) => $(s).addEventListener('input', calc));
$('#c-rows').addEventListener('input', calc);
$('#c-list').addEventListener('click', async (e) => {
  const l = e.target.closest('[data-load]'), d = e.target.closest('[data-del]');
  if (l) fill(st.srv.find((s) => s.id === l.dataset.load));
  else if (d && confirm('¿Eliminar este servicio?')) {
    try { await S.servicios.remove(d.dataset.del); if (st.editing === d.dataset.del) reset(); toast('Eliminado'); await load(); }
    catch (err) { toast(/foreign key|23503/i.test(err.message) ? 'No se puede eliminar: tiene pedidos asociados' : err.message, true); }
  }
});
document.addEventListener('shell:search', (e) => { Q = e.detail; list(); });