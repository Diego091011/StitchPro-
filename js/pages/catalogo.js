import { requireAuth } from '../core/auth.js';
import { mountShell } from '../core/shell.js';
import { recetaEditor, NOCFG } from '../core/receta.js';
import { cotizar } from '../calculator.js';
import { $, money, esc, toast } from '../core/utils.js';
import * as S from '../services/index.js';

await requireAuth();
await mountShell('catalogo');

const st = { cfg: null, inv: [], srv: [] };
let Q = '', filtro = 'todos';
const TIPO = { arreglo_rapido: 'Arreglo', confeccion: 'Prenda nueva' };
const match = (r) => !Q || JSON.stringify(r).toLowerCase().includes(Q);

async function load() {
  try { [st.cfg, st.inv, st.srv] = await Promise.all([S.config.get(), S.inventario.list(), S.servicios.list()]); }
  catch (e) { toast(e.message, true); }
  render();
}

/** Precio recalculado con los costos actuales de inventario y configuración. */
function vivo(s) {
  try { return cotizar({ minutos: s.minutos_estimados, margenPct: s.margen_ganancia_pct, insumos: s.insumos_usados || [] }, st.cfg || NOCFG, st.inv); }
  catch { return null; }
}

function render() {
  const n = (t) => st.srv.filter((s) => s.tipo === t).length;
  $('#stats').innerHTML = [['Recetas', st.srv.length], ['Arreglos', n('arreglo_rapido')], ['Prendas nuevas', n('confeccion')]]
    .map(([l, v]) => `<div class="card stat"><small>${l}</small><b>${v}</b></div>`).join('');
  $('#filtros').innerHTML = [['todos', 'Todos'], ['arreglo_rapido', 'Arreglos'], ['confeccion', 'Prendas nuevas']]
    .map(([k, l]) => `<button class="chip ${k === filtro ? 'on' : ''}" data-f="${k}">${l}</button>`).join('');

  const list = st.srv.filter((s) => (filtro === 'todos' || s.tipo === filtro) && match(s));
  $('#table').innerHTML = list.length
    ? `<table class="tbl"><thead><tr><th>Nombre</th><th>Prenda</th><th>Tipo</th><th>Tiempo</th><th>Materiales</th><th>Precio</th><th></th></tr></thead><tbody>${list.map((s) => {
      const v = vivo(s), nm = (s.insumos_usados || []).length;
      return `<tr><td>${esc(s.nombre)}</td><td>${esc(s.prenda || '—')}</td><td><span class="tag">${TIPO[s.tipo] || s.tipo}</span></td><td>${s.minutos_estimados} min</td>
        <td>${nm} ${v ? `· ${money(v.desglose.materiales)}` : '<span class="low">· revisar insumos</span>'}</td>
        <td class="pos">${v ? money(v.precio_final) : '—'}</td>
        <td class="act"><button class="btn ghost sm" data-edit="${s.id}">Editar</button><button class="btn ghost sm" data-dup="${s.id}">Duplicar</button><button class="btn bad sm" data-del="${s.id}">Eliminar</button></td></tr>`;
    }).join('')}</tbody></table>`
    : `<div class="empty">${st.srv.length ? 'Sin resultados' : 'Aún no hay recetas. Crea tu primer arreglo o prenda.'}</div>`;
}

async function editar(item, esNuevo) {
  const prendas = [...new Set(st.srv.map((s) => s.prenda).filter(Boolean))];
  const v = await recetaEditor({ item, inv: st.inv, cfg: st.cfg, prendas });
  if (!v) return;
  try { esNuevo ? await S.servicios.create(v) : await S.servicios.update(item.id, v); toast('Receta guardada'); await load(); }
  catch (e) { toast(e.message, true); }
}

$('#new').onclick = () => editar(null, true);
$('#page').addEventListener('click', async (e) => {
  const f = e.target.closest('[data-f]'), ed = e.target.closest('[data-edit]'), dup = e.target.closest('[data-dup]'), del = e.target.closest('[data-del]');
  if (f) { filtro = f.dataset.f; render(); }
  else if (ed) editar(st.srv.find((s) => s.id === ed.dataset.edit), false);
  else if (dup) { const s = st.srv.find((x) => x.id === dup.dataset.dup); editar({ ...s, id: null, nombre: `${s.nombre} (copia)` }, true); }
  else if (del && confirm('¿Eliminar esta receta?')) {
    try { await S.servicios.remove(del.dataset.del); toast('Eliminada'); await load(); }
    catch (err) { toast(/foreign key|23503/i.test(err.message) ? 'No se puede eliminar: tiene órdenes asociadas' : err.message, true); }
  }
});
document.addEventListener('shell:search', (e) => { Q = e.detail; render(); });
load();