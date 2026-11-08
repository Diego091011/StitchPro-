import { requireAuth } from '../core/auth.js';
import { mountShell } from '../core/shell.js';
import { formModal } from '../core/modal.js';
import { $, money, moneyU, esc, toast } from '../core/utils.js';
import * as S from '../services/index.js';

await requireAuth();
await mountShell('inventario');

const DEFAULT_CATS = ['Telas', 'Hilos', 'Botones', 'Cierres', 'Agujas', 'Elásticos', 'Otros'];
const USO = [['yarda', 'Yarda'], ['metro', 'Metro'], ['cm', 'Centímetro'], ['unidad', 'Unidad'], ['par', 'Par'], ['gramo', 'Gramo']];
const COMPRA = [['cono', 'Cono'], ['rollo', 'Rollo'], ['metro', 'Metro'], ['yarda', 'Yarda'], ['carretel', 'Carretel'], ['unidad', 'Unidad'], ['paquete', 'Paquete'], ['caja', 'Caja']];
const lbl = (arr, k) => arr.find(([v]) => v === k)?.[1] || k;
const DEFAULTS = { unidad_compra: 'cono', unidad_medida: 'yarda', precio_compra: '', cantidad_por_compra: '', stock_actual: 0, stock_minimo: 0 };
const low = (r) => Number(r.stock_minimo) > 0 && Number(r.stock_actual) > 0 && Number(r.stock_actual) <= Number(r.stock_minimo);

let rows = [], cats = [], Q = '', cat = 'Todas';
const match = (r) => !Q || JSON.stringify(r).toLowerCase().includes(Q);
const n2 = (n) => new Intl.NumberFormat('es-CO', { maximumFractionDigits: 2 }).format(n);

async function load() {
  try {
    cats = await S.categorias.list();
    if (!cats.length) cats = await S.categorias.seed(DEFAULT_CATS).catch(() => S.categorias.list());
    rows = await S.inventario.list();
  } catch (e) { toast(e.message, true); }
  render();
}

function render() {
  const valor = rows.reduce((a, r) => a + Number(r.stock_actual) * Number(r.costo_unidad), 0);
  const sinStock = rows.filter((r) => Number(r.stock_actual) <= 0).length, bajo = rows.filter(low).length;
  $('#stats').innerHTML = [['Insumos', rows.length], ['Valor del inventario', money(valor)], ['Sin stock', `<span class="${sinStock ? 'low' : ''}">${sinStock}</span>`], ['Stock bajo', `<span class="${bajo ? 'low' : ''}">${bajo}</span>`]]
    .map(([l, v]) => `<div class="card stat"><small>${l}</small><b>${v}</b></div>`).join('');
  $('#cats').innerHTML = ['Todas', ...cats.map((c) => c.nombre)].map((c) => `<button class="chip ${c === cat ? 'on' : ''}" data-cat="${esc(c)}">${esc(c)}</button>`).join('');

  const list = rows.filter((r) => (cat === 'Todas' || r.categoria === cat) && match(r));
  $('#table').innerHTML = list.length
    ? `<table class="tbl"><thead><tr><th>Nombre</th><th>Categoría</th><th>Compra</th><th>Costo por uso</th><th>Stock</th><th></th></tr></thead><tbody>${list.map((r) => {
      const s = Number(r.stock_actual), c = Number(r.cantidad_por_compra) || 1;
      return `<tr><td>${esc(r.nombre)}</td><td><span class="tag">${esc(r.categoria)}</span></td>
        <td>${money(r.precio_compra)} / ${lbl(COMPRA, r.unidad_compra)}<br><small class="hint">${n2(c)} ${esc(r.unidad_medida)} por ${lbl(COMPRA, r.unidad_compra).toLowerCase()}</small></td>
        <td class="pos">${moneyU(r.costo_unidad)} / ${esc(r.unidad_medida)}</td>
        <td class="${s <= 0 || low(r) ? 'low' : ''}">${n2(s)} ${esc(r.unidad_medida)}<br><small class="hint">≈ ${n2(s / c)} ${lbl(COMPRA, r.unidad_compra).toLowerCase()}${s <= 0 ? ' · sin stock' : low(r) ? ` · stock bajo (mín. ${n2(r.stock_minimo)})` : ''}</small></td>
        <td class="act"><button class="btn ghost sm" data-stock="${r.id}">+ Stock</button><button class="btn ghost sm" data-edit="${r.id}">Editar</button><button class="btn bad sm" data-del="${r.id}">Eliminar</button></td></tr>`;
    }).join('')}</tbody></table>`
    : `<div class="empty">${rows.length ? 'Sin resultados' : 'Aún no tienes insumos. Agrega el primero.'}</div>`;
}

/* ---------- Crear / editar ---------- */
async function edit(row) {
  const nombresCat = cats.map((c) => c.nombre);
  if (row && !nombresCat.includes(row.categoria)) nombresCat.push(row.categoria);
  const fields = [
    { k: 'nombre', l: 'Nombre', req: 1, full: 1 },
    { k: 'categoria', l: 'Categoría', t: 'select', o: nombresCat, full: 1 },
    { t: 'section', l: 'Cómo lo compras' },
    { k: 'unidad_compra', l: 'Unidad de compra', t: 'select', o: COMPRA },
    { k: 'precio_compra', l: 'Precio por unidad de compra', t: 'number', req: 1 },
    { t: 'section', l: 'Cómo lo usas' },
    { k: 'unidad_medida', l: 'Unidad de uso', t: 'select', o: USO },
    { k: 'cantidad_por_compra', l: 'Contenido por compra (ej. 5000 yardas por cono; 1 si compras por metro)', t: 'number', req: 1 },
    { t: 'section', l: 'Existencias' },
    { k: 'stock_actual', l: 'Stock actual (en unidad de uso)', t: 'number' },
    { k: 'stock_minimo', l: 'Stock mínimo (avisar al llegar a este nivel)', t: 'number' },
    { k: 'notas', l: 'Notas', t: 'textarea', full: 1 },
  ];
  const preview = (v) => {
    const c = v.precio_compra / v.cantidad_por_compra;
    return v.precio_compra != null && v.cantidad_por_compra > 0 ? `Costo por <b>${lbl(USO, v.unidad_medida).toLowerCase()}</b>: <b>${moneyU(c)}</b>` : 'Ingresa el precio y el contenido para ver el costo por unidad de uso.';
  };
  const v = await formModal({ title: row ? 'Editar insumo' : 'Nuevo insumo', fields, values: row || { ...DEFAULTS, categoria: nombresCat[0] }, preview });
  if (!v) return;
  if (!(v.cantidad_por_compra > 0)) return toast('El contenido por compra debe ser mayor que 0', true);
  const out = { ...v, stock_minimo: v.stock_minimo ?? 0, nombre: v.nombre.trim(), notas: v.notas?.trim() || null, costo_unidad: Math.round((v.precio_compra / v.cantidad_por_compra) * 1e6) / 1e6 };
  try { row ? await S.inventario.update(row.id, out) : await S.inventario.create(out); toast('Guardado'); await load(); }
  catch (e) { toast(e.message, true); }
}

async function addStock(row) {
  const u = lbl(COMPRA, row.unidad_compra).toLowerCase();
  const n = Number(String(prompt(`¿Cuántos ${u}s compraste de "${row.nombre}"?`, '1') || '').replace(',', '.'));
  if (!(n > 0)) return;
  try { await S.inventario.update(row.id, { stock_actual: Number(row.stock_actual) + n * Number(row.cantidad_por_compra) }); toast('Stock actualizado'); await load(); }
  catch (e) { toast(e.message, true); }
}

/* ---------- Categorías ---------- */
function categorias() {
  const d = document.createElement('dialog');
  const draw = () => {
    d.innerHTML = `<h3>Categorías</h3>${cats.map((c) => `<div class="catrow"><span>${esc(c.nombre)} <small class="hint">· ${rows.filter((r) => r.categoria === c.nombre).length} insumos</small></span><button class="btn bad sm" data-delcat="${c.id}">Eliminar</button></div>`).join('') || '<div class="empty">Sin categorías</div>'}
      <div class="catadd"><input id="cat-new" placeholder="Nueva categoría (ej. Entretelas)"><button class="btn green" id="cat-add">Agregar</button></div>
      <div class="modal-act"><button class="btn ghost" data-x>Cerrar</button></div>`;
    d.querySelector('[data-x]').onclick = () => d.close();
    d.querySelector('#cat-add').onclick = async () => {
      const nombre = d.querySelector('#cat-new').value.trim(); if (!nombre) return;
      try { await S.categorias.create({ nombre }); cats = await S.categorias.list(); draw(); } catch (e) { toast(/duplicate|unique/i.test(e.message) ? 'Esa categoría ya existe' : e.message, true); }
    };
    d.querySelectorAll('[data-delcat]').forEach((b) => (b.onclick = async () => {
      const c = cats.find((x) => x.id === b.dataset.delcat);
      if (rows.some((r) => r.categoria === c.nombre) && !confirm(`Hay insumos en "${c.nombre}". Seguirán existiendo, pero sin esta categoría en la lista. ¿Eliminar?`)) return;
      try { await S.categorias.remove(c.id); cats = await S.categorias.list(); draw(); } catch (e) { toast(e.message, true); }
    }));
  };
  draw(); document.body.append(d);
  d.addEventListener('close', () => { d.remove(); if (cat !== 'Todas' && !cats.some((c) => c.nombre === cat)) cat = 'Todas'; render(); });
  d.showModal();
}

/* ---------- Eventos ---------- */
$('#new').onclick = () => edit();
$('#cats-btn').onclick = categorias;
$('#page').addEventListener('click', async (e) => {
  const c = e.target.closest('[data-cat]'), ed = e.target.closest('[data-edit]'), st = e.target.closest('[data-stock]'), del = e.target.closest('[data-del]');
  if (c) { cat = c.dataset.cat; render(); }
  else if (ed) edit(rows.find((r) => r.id === ed.dataset.edit));
  else if (st) addStock(rows.find((r) => r.id === st.dataset.stock));
  else if (del && confirm('¿Eliminar este insumo?')) {
    try { await S.inventario.remove(del.dataset.del); toast('Eliminado'); await load(); } catch (err) { toast(err.message, true); }
  }
});
document.addEventListener('shell:search', (e) => { Q = e.detail; render(); });
load();