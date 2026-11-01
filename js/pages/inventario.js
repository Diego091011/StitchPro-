import { requireAuth } from '../core/auth.js';
import { mountShell } from '../core/shell.js';
import { formModal } from '../core/modal.js';
import { $, money, esc, toast } from '../core/utils.js';
import * as S from '../services/index.js';

await requireAuth();
await mountShell('inventario');

const CATS = ['tela', 'hilo', 'boton', 'cierre', 'otro'];
const LABEL = { todas: 'Todas', tela: 'Telas', hilo: 'Hilos', boton: 'Botones', cierre: 'Cierres', otro: 'Otros' };
const FIELDS = [
  { k: 'nombre', l: 'Nombre', req: 1, full: 1 },
  { k: 'categoria', l: 'Categoría', t: 'select', o: CATS.map((c) => [c, LABEL[c]]) },
  { k: 'unidad_medida', l: 'Unidad (metro, unidad, carretel…)', req: 1 },
  { k: 'costo_unidad', l: 'Costo por unidad', t: 'number' },
  { k: 'stock_actual', l: 'Stock actual', t: 'number' },
];
const DEFAULTS = { categoria: 'otro', unidad_medida: 'unidad', costo_unidad: 0, stock_actual: 0 };

let rows = [], Q = '', cat = 'todas';
const match = (r) => !Q || JSON.stringify(r).toLowerCase().includes(Q);

async function load() {
  try { rows = await S.inventario.list(); } catch (e) { toast(e.message, true); }
  render();
}

function render() {
  const valor = rows.reduce((a, r) => a + Number(r.stock_actual) * Number(r.costo_unidad), 0);
  const sinStock = rows.filter((r) => Number(r.stock_actual) <= 0).length;
  $('#stats').innerHTML = [['Insumos', rows.length], ['Valor del inventario', money(valor)], ['Sin stock', `<span class="${sinStock ? 'low' : ''}">${sinStock}</span>`]]
    .map(([l, v]) => `<div class="card stat"><small>${l}</small><b>${v}</b></div>`).join('');
  $('#cats').innerHTML = Object.keys(LABEL).map((c) => `<button class="chip ${c === cat ? 'on' : ''}" data-cat="${c}">${LABEL[c]}</button>`).join('');

  const list = rows.filter((r) => (cat === 'todas' || r.categoria === cat) && match(r));
  $('#table').innerHTML = list.length
    ? `<table class="tbl"><thead><tr><th>Nombre</th><th>Categoría</th><th>Unidad</th><th>Costo</th><th>Stock</th><th></th></tr></thead><tbody>${list.map((r) => {
      const s = Number(r.stock_actual);
      return `<tr><td>${esc(r.nombre)}</td><td><span class="tag">${LABEL[r.categoria] || esc(r.categoria)}</span></td><td>${esc(r.unidad_medida)}</td><td>${money(r.costo_unidad)}</td>
        <td class="${s <= 0 ? 'low' : ''}">${s}${s <= 0 ? ' · sin stock' : ''}</td>
        <td class="act"><button class="btn ghost sm" data-edit="${r.id}">Editar</button><button class="btn bad sm" data-del="${r.id}">Eliminar</button></td></tr>`;
    }).join('')}</tbody></table>`
    : `<div class="empty">${rows.length ? 'Sin resultados' : 'Aún no tienes insumos. Agrega el primero.'}</div>`;
}

async function edit(row) {
  const v = await formModal({ title: row ? 'Editar insumo' : 'Nuevo insumo', fields: FIELDS, values: row || DEFAULTS });
  if (!v) return;
  try { row ? await S.inventario.update(row.id, v) : await S.inventario.create(v); toast('Guardado'); await load(); }
  catch (e) { toast(e.message, true); }
}

$('#new').onclick = () => edit();
$('#page').addEventListener('click', async (e) => {
  const c = e.target.closest('[data-cat]'), ed = e.target.closest('[data-edit]'), del = e.target.closest('[data-del]');
  if (c) { cat = c.dataset.cat; render(); }
  else if (ed) edit(rows.find((r) => r.id === ed.dataset.edit));
  else if (del && confirm('¿Eliminar este insumo?')) {
    try { await S.inventario.remove(del.dataset.del); toast('Eliminado'); await load(); } catch (err) { toast(err.message, true); }
  }
});
document.addEventListener('shell:search', (e) => { Q = e.detail; render(); });
load();