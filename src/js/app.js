import * as S from './services/index.js';
import { cotizar, costoEnergiaMin } from './calculator.js';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const money = (n) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n || 0);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const date = (d) => (d ? new Date(d).toLocaleDateString('es-CO') : '—');

const st = { cfg: null, inventario: [], clientes: [], servicios: [], pedidos: [] };
let toastT;
const toast = (m, err) => { const t = $('#toast'); t.textContent = m; t.className = 'on' + (err ? ' err' : ''); clearTimeout(toastT); toastT = setTimeout(() => (t.className = ''), 2800); };
const safe = (fn) => async (...a) => { try { return await fn(...a); } catch (e) { toast(e.message || 'Error', true); } };

/* ---------- Esquemas CRUD (UI generada) ---------- */
const opts = (arr, v, l) => arr.map((x) => [x[v], x[l]]);
const SCHEMA = {
  inventario: {
    title: 'Insumo', svc: S.inventario,
    cols: [['nombre', 'Nombre'], ['categoria', 'Categoría'], ['unidad_medida', 'Unidad'], ['costo_unidad', 'Costo', money], ['stock_actual', 'Stock', (v) => `<span class="${v <= 0 ? 'low' : ''}">${v}</span>`]],
    fields: () => [
      { k: 'nombre', l: 'Nombre', req: 1, full: 1 },
      { k: 'categoria', l: 'Categoría', t: 'select', o: ['tela', 'hilo', 'boton', 'cierre', 'otro'] },
      { k: 'unidad_medida', l: 'Unidad (metro, unidad…)', req: 1 },
      { k: 'costo_unidad', l: 'Costo por unidad', t: 'number' },
      { k: 'stock_actual', l: 'Stock actual', t: 'number' },
    ],
  },
  clientes: {
    title: 'Cliente', svc: S.clientes,
    cols: [['nombre_completo', 'Nombre'], ['telefono', 'Teléfono'], ['medidas', 'Medidas', (m) => Object.entries(m || {}).map(([k, v]) => `${k}: ${v}`).join(' · ') || '—']],
    fields: () => [
      { k: 'nombre_completo', l: 'Nombre completo', req: 1, full: 1 },
      { k: 'telefono', l: 'Teléfono' },
      ...['busto', 'cintura', 'cadera', 'largo_talle'].map((m) => ({ k: 'm.' + m, l: m.replace('_', ' ') + ' (cm)', t: 'number' })),
      { k: 'notas', l: 'Notas', t: 'textarea', full: 1 },
    ],
  },
  pedidos: {
    title: 'Pedido', svc: S.pedidos,
    cols: [['num', '# Orden', (n) => ord(n)], ['clientes', 'Cliente', (c) => esc(c?.nombre_completo)], ['servicios', 'Prenda', (x) => esc(x?.nombre)], ['estado', 'Estado', (e) => pill(e)], ['fecha_ingreso', 'Fecha', date], ['fecha_entrega', 'Entrega', date], ['total_cobrado', 'Total', money], ['pagado', 'Pago', (p) => (p ? '✅' : '⏳')]],
    fields: () => [
      { k: 'cliente_id', l: 'Cliente', t: 'select', o: opts(st.clientes, 'id', 'nombre_completo'), req: 1 },
      { k: 'servicio_id', l: 'Servicio', t: 'select', o: opts(st.servicios, 'id', 'nombre'), req: 1 },
      { k: 'estado', l: 'Estado', t: 'select', o: ['pendiente', 'en_proceso', 'listo', 'entregado'] },
      { k: 'fecha_entrega', l: 'Fecha de entrega', t: 'date' },
      { k: 'total_cobrado', l: 'Total a cobrar', t: 'number' },
      { k: 'pagado', l: 'Pagado', t: 'checkbox' },
    ],
  },
};

/* ---------- Tablas ---------- */
let Q = '';
const match = (r) => !Q || JSON.stringify(r).toLowerCase().includes(Q);
function renderTable(name) {
  if (name === 'pedidos') numerar();
  const { cols, title } = SCHEMA[name], rows = st[name].filter(match), el = $('#t-' + name);
  if (!rows.length) return (el.innerHTML = `<div class="empty">${Q ? 'Sin resultados' : `Sin registros. Crea el primer ${title.toLowerCase()}.`}</div>`);
  el.innerHTML = `<table class="tbl"><thead><tr>${cols.map((c) => `<th>${c[1]}</th>`).join('')}<th></th></tr></thead><tbody>${rows.map((r) =>
    `<tr>${cols.map(([k, , f]) => `<td>${f ? f(r[k], r) : esc(r[k])}</td>`).join('')}<td class="act"><button class="btn ghost sm" data-edit="${name}:${r.id}">✎</button><button class="btn bad sm" data-del="${name}:${r.id}">✕</button></td></tr>`).join('')}</tbody></table>`;
}

/* ---------- Modal genérico ---------- */
function openForm(name, row) {
  const { fields, title, svc } = SCHEMA[name], f = $('#m-form');
  const val = (k) => (k.startsWith('m.') ? row?.medidas?.[k.slice(2)] : row?.[k]) ?? '';
  f.innerHTML = `<h3>${row ? 'Editar' : 'Nuevo'} ${title.toLowerCase()}</h3><div class="form">${fields().map((x) => {
    const v = val(x.k), cls = x.full ? 'full' : '';
    if (x.t === 'select') return `<label class="${cls}">${x.l}<select name="${x.k}" ${x.req ? 'required' : ''}>${x.req ? '<option value="">Seleccionar…</option>' : ''}${x.o.map((o) => { const [ov, ol] = Array.isArray(o) ? o : [o, o]; return `<option value="${esc(ov)}" ${ov === v ? 'selected' : ''}>${esc(ol)}</option>`; }).join('')}</select></label>`;
    if (x.t === 'textarea') return `<label class="${cls}">${x.l}<textarea name="${x.k}" rows="3">${esc(v)}</textarea></label>`;
    if (x.t === 'checkbox') return `<label class="${cls}" style="flex-direction:row;align-items:center"><input type="checkbox" name="${x.k}" ${v ? 'checked' : ''}> ${x.l}</label>`;
    return `<label class="${cls}">${x.l}<input name="${x.k}" type="${x.t || 'text'}" ${x.t === 'number' ? 'step="any" min="0"' : ''} value="${esc(x.t === 'date' && v ? String(v).slice(0, 10) : v)}" ${x.req ? 'required' : ''}></label>`;
  }).join('')}</div><div style="display:flex;gap:8px;justify-content:flex-end;margin-top:16px"><button type="button" class="btn ghost" id="m-x">Cancelar</button><button class="btn">Guardar</button></div>`;
  $('#m-x').onclick = () => $('#modal').close();
  f.onsubmit = safe(async (e) => {
    e.preventDefault();
    const fd = new FormData(f), out = {}, med = { ...(row?.medidas || {}) };
    fields().forEach((x) => {
      let v = x.t === 'checkbox' ? fd.has(x.k) : fd.get(x.k);
      if (x.t === 'number') v = v === '' ? null : Number(v);
      if (x.t === 'date' && !v) v = null;
      if (x.k.startsWith('m.')) { v === null ? delete med[x.k.slice(2)] : (med[x.k.slice(2)] = v); } else out[x.k] = v;
    });
    if (name === 'clientes') out.medidas = med;
    if (name === 'pedidos' && !row && !out.total_cobrado) out.total_cobrado = st.servicios.find((s) => s.id === out.servicio_id)?.precio_final ?? 0;
    row ? await svc.update(row.id, out) : await svc.create(out);
    $('#modal').close(); toast('Guardado'); await load(name);
  });
  $('#modal').showModal();
}

/* ---------- Carga de datos ---------- */
async function load(name) {
  if (name === 'servicios') st.servicios = await S.servicios.list();
  else { st[name] = await S[name].list(); if (SCHEMA[name]) renderTable(name); }
  if (name === 'inventario') qRows();
  if (name === 'clientes') qClientes();
  dash();
}
const loadAll = safe(async () => {
  [st.cfg, st.inventario, st.clientes, st.servicios, st.pedidos] = await Promise.all([S.config.get(), S.inventario.list(), S.clientes.list(), S.servicios.list(), S.pedidos.list()]);
  ['inventario', 'clientes', 'pedidos'].forEach(renderTable);
  cfgFill(); qClientes(); qRows(); quote(); dash();
});

/* ---------- Dashboard ---------- */
const ICON = (n) => `<svg class="i"><use href="#i-${n}"/></svg>`;
const ESTADO = { pendiente: 'Pendiente', en_proceso: 'En Proceso', listo: 'Listo', entregado: 'Entregado' };
const pill = (e) => `<span class="pill ${e}"><i></i>${ESTADO[e] || e}</span>`;
const ord = (n) => '#' + String(n || 0).padStart(5, '0');
const mk = (d) => d.getFullYear() * 12 + d.getMonth();
function numerar() { [...st.pedidos].sort((a, b) => a.fecha_ingreso.localeCompare(b.fecha_ingreso)).forEach((p, i) => (p.num = i + 1)); }
const serie = (fn) => [5, 4, 3, 2, 1, 0].map((o) => st.pedidos.filter((p) => mk(new Date(p.fecha_ingreso)) === mk(new Date()) - o).reduce((a, p) => a + fn(p), 0));
const delta = (d, goodUp = true) => {
  const cur = d[5], prev = d[4];
  if (!prev) return 'Sin mes anterior';
  const p = ((cur - prev) / prev) * 100, up = p >= 0;
  return `<span class="${up === goodUp ? 'pos' : 'neg'}">${up ? '↑ +' : '↓ '}${p.toFixed(1)}%</span> vs mes anterior`;
};
function spark(c, d, col) {
  const r = devicePixelRatio || 1, w = (c.width = c.clientWidth * r), h = (c.height = c.clientHeight * r), x = c.getContext('2d');
  if (!w) return;
  const max = Math.max(...d, 1), min = Math.min(...d, 0);
  const pts = d.map((v, i) => [(i / (d.length - 1)) * w, h - 6 * r - ((v - min) / (max - min || 1)) * (h - 16 * r)]);
  x.beginPath(); x.moveTo(...pts[0]);
  pts.slice(1).forEach(([px, py], i) => { const [qx, qy] = pts[i]; x.quadraticCurveTo(qx, qy, (qx + px) / 2, (qy + py) / 2); });
  x.lineTo(...pts.at(-1));
  x.strokeStyle = col; x.lineWidth = 2 * r; x.shadowColor = col; x.shadowBlur = 10 * r; x.stroke();
  x.shadowBlur = 0; x.lineTo(w, h); x.lineTo(0, h); x.closePath();
  const g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, col + '40'); g.addColorStop(1, col + '00'); x.fillStyle = g; x.fill();
}
function dash() {
  numerar();
  const eMin = st.cfg ? costoEnergiaMin(st.cfg.potencia_maquina_w, st.cfg.precio_kwh) : 0;
  const sU = serie((p) => (p.pagado ? Number(p.total_cobrado) - Number(p.servicios?.costo_neto || 0) : 0));
  const sA = serie(() => 1);
  const sE = serie((p) => (p.servicios?.minutos_estimados || 0) * eMin);
  const activas = st.pedidos.filter((p) => ['pendiente', 'en_proceso'].includes(p.estado)).length;
  const nuevas = st.pedidos.filter((p) => Date.now() - new Date(p.fecha_ingreso) < 7 * 864e5).length;
  const kpi = (c, ic, l, v, sub, id) => `<div class="card kpi" style="--c:${c}">${ICON(ic)}<div><small>${l}</small><b>${v}</b><span class="sub">${sub}</span></div><canvas id="${id}"></canvas></div>`;
  $('#kpis').innerHTML = kpi('#22e58f', 'trend', 'Utilidad Neta Mensual', money(sU[5]), delta(sU), 'k1') + kpi('#8b5cf6', 'hanger', 'Órdenes Activas', activas, `<span class="pos">↑ +${nuevas}</span> nuevas (7 días)`, 'k2') + kpi('#22d3ee', 'bolt', 'Costo Energía Eléctrica', money(sE[5]), delta(sE, false), 'k3');
  spark($('#k1'), sU, '#22e58f'); spark($('#k2'), sA, '#8b5cf6'); spark($('#k3'), sE, '#22d3ee');
  const rec = st.pedidos.filter(match).slice(0, 5);
  $('#recientes').innerHTML = rec.length ? `<table class="tbl"><thead><tr><th># Orden</th><th>Cliente</th><th>Prenda</th><th>Tipo</th><th>Fecha</th><th>Estado</th><th>Total</th><th></th></tr></thead><tbody>${rec.map((p) =>
    `<tr><td>${ord(p.num)}</td><td>${esc(p.clientes?.nombre_completo)}</td><td>${esc(p.servicios?.nombre)}</td><td>${p.servicios?.tipo === 'confeccion' ? 'Confección' : 'Arreglo'}</td><td>${date(p.fecha_ingreso)}</td><td>${pill(p.estado)}</td><td>${money(p.total_cobrado)}</td><td class="act"><button class="btn ghost sm" data-edit="pedidos:${p.id}">⋮</button></td></tr>`).join('')}</tbody></table>` : `<div class="empty">${Q ? 'Sin resultados' : 'Aún no hay órdenes. Crea la primera en Órdenes.'}</div>`;
  const listos = st.pedidos.filter((p) => p.estado === 'listo').length, bn = $('#bell-n');
  bn.hidden = !listos; bn.textContent = listos;
  dqChips(); dqPrice();
}

/* ---------- Cotizador rápido (dashboard) ---------- */
const PRENDAS = ['Pantalón', 'Camisa', 'Vestido', 'Falda', 'Chaqueta', 'Otra'];
const ALT = { arreglo_rapido: ['Ajuste de cintura', 'Bota / dobladillo', 'Cambio de cierre', 'Ajuste de largo', 'Ajuste de costados'], confeccion: ['Confección completa', 'Prenda a medida', 'Diseño especial'] };
const dq = { tipo: 'arreglo_rapido', mats: new Set(), res: null };
const dqAlt = () => ($('#dq-alt').innerHTML = ALT[dq.tipo].map((a) => `<option>${a}</option>`).join(''));
const dqIn = () => ({ minutos: Math.round(Number($('#dq-horas').value) * 60), margenPct: Number($('#dq-margen').value) || 0, insumos: [...dq.mats].map((id) => ({ insumo_id: id, cantidad: 1 })) });
function dqChips() {
  dq.mats.forEach((id) => !st.inventario.some((i) => i.id === id) && dq.mats.delete(id));
  $('#dq-mats').innerHTML = st.inventario.slice(0, 8).map((i) => `<button type="button" class="chip ${dq.mats.has(i.id) ? 'on' : ''}" data-mat="${i.id}">${esc(i.nombre)} ${money(i.costo_unidad)}</button>`).join('') + '<button type="button" class="chip add" id="dq-add">+ Agregar</button>';
}
function dqPrice() {
  $('#dq-hlbl').textContent = $('#dq-horas').value + ' h';
  dq.res = null; $('#dq-precio').textContent = '—';
  if (!st.cfg) return;
  try { dq.res = cotizar(dqIn(), st.cfg, st.inventario); $('#dq-precio').textContent = money(dq.res.precio_final); } catch (e) { toast(e.message, true); }
}
$('#dq-prenda').innerHTML = PRENDAS.map((p) => `<option>${p}</option>`).join(''); dqAlt();
['#dq-horas', '#dq-margen'].forEach((x) => $(x).addEventListener('input', dqPrice));
$('#dq-save').onclick = safe(async () => {
  dqPrice(); if (!dq.res) return toast('Configura tus costos en Configuración primero', true);
  const q = dqIn();
  await S.servicios.create({ tipo: dq.tipo, nombre: `${$('#dq-prenda').value} · ${$('#dq-alt').value}`, minutos_estimados: q.minutos, insumos_usados: q.insumos, margen_ganancia_pct: q.margenPct, costo_neto: dq.res.costo_neto, precio_final: dq.res.precio_final });
  await load('servicios'); toast('Servicio guardado');
});
document.addEventListener('click', (e) => {
  const t = e.target, b = t.closest('[data-tipo]'), m = t.closest('[data-mat]'), g = t.closest('[data-go]');
  if (b) { dq.tipo = b.dataset.tipo; $$('[data-tipo]').forEach((x) => x.classList.toggle('on', x === b)); dqAlt(); }
  else if (m) { dq.mats.has(m.dataset.mat) ? dq.mats.delete(m.dataset.mat) : dq.mats.add(m.dataset.mat); dqChips(); dqPrice(); }
  else if (t.closest('#dq-add')) openForm('inventario');
  else if (g) go(g.dataset.go);
  else if (t.closest('#bell')) go('pedidos');
  else if (t.closest('#dq-calc')) { dqPrice(); const p = $('#dq-precio'); p.classList.remove('pop'); void p.offsetWidth; p.classList.add('pop'); }
});
$('#search').addEventListener('input', (e) => { Q = e.target.value.trim().toLowerCase(); ['inventario', 'clientes', 'pedidos'].forEach(renderTable); dash(); });

/* ---------- Config ---------- */
function cfgFill() {
  const c = st.cfg || { sueldo_base: 0, horas_mes: 160, precio_kwh: 950, potencia_maquina_w: 500 }, f = $('#cfg-form');
  ['sueldo_base', 'horas_mes', 'precio_kwh', 'potencia_maquina_w'].forEach((k) => (f.elements[k].value = c[k]));
  $('#cfg-info').textContent = st.cfg ? '' : 'Aún no configurado: guarda tus costos base.';
}
$('#cfg-form').onsubmit = safe(async (e) => {
  e.preventDefault();
  const fd = new FormData(e.target);
  st.cfg = await S.config.save(Object.fromEntries([...fd].map(([k, v]) => [k, Number(v)])));
  toast('Costos guardados'); quote();
});

/* ---------- Cotizador ---------- */
const qClientes = () => ($('#q-cli').innerHTML = '<option value="">— Sin cliente —</option>' + st.clientes.map((c) => `<option value="${c.id}">${esc(c.nombre_completo)}</option>`).join(''));
function qRow(sel = '', qty = 1) {
  const d = document.createElement('div'); d.className = 'row';
  d.innerHTML = `<select>${'<option value="">Insumo…</option>' + st.inventario.map((i) => `<option value="${i.id}" ${i.id === sel ? 'selected' : ''}>${esc(i.nombre)} (${money(i.costo_unidad)}/${esc(i.unidad_medida)})</option>`).join('')}</select><input type="number" min="0" step="any" value="${qty}"><button class="btn bad sm" type="button">✕</button>`;
  d.querySelector('button').onclick = () => { d.remove(); quote(); };
  $('#q-rows').append(d);
}
const qRows = () => { const keep = $$('#q-rows .row').map((r) => [r.children[0].value, r.children[1].value]); $('#q-rows').innerHTML = ''; keep.forEach(([s, q]) => qRow(s, q)); };
function qData() {
  return {
    minutos: Number($('#q-min').value) || 0, margenPct: Number($('#q-margen').value) || 0,
    insumos: $$('#q-rows .row').map((r) => ({ insumo_id: r.children[0].value, cantidad: Number(r.children[1].value) || 0 })).filter((i) => i.insumo_id),
  };
}
let lastQ = null;
function quote() {
  const el = $('#q-res');
  if (!st.cfg) { lastQ = null; return (el.innerHTML = '<div class="empty">Configura primero tus costos base (⚙ Costos).</div>'); }
  try {
    lastQ = cotizar(qData(), st.cfg, st.inventario);
    const d = lastQ.desglose;
    el.innerHTML = `<div><span>Materiales</span><span>${money(d.materiales)}</span></div><div><span>Mano de obra</span><span>${money(d.manoObra)}</span></div><div><span>Energía</span><span>${money(d.energia)}</span></div><div><span>Costo neto</span><span>${money(lastQ.costo_neto)}</span></div><div><span>Ganancia</span><span style="color:var(--ok)">${money(lastQ.ganancia)}</span></div><div class="tot"><span>Precio final</span><span>${money(lastQ.precio_final)}</span></div>`;
  } catch (e) { lastQ = null; el.innerHTML = `<div class="empty low">${esc(e.message)}</div>`; }
}
const qSave = (order) => safe(async () => {
  const nombre = $('#q-nombre').value.trim(); quote();
  if (!nombre || !lastQ) return toast('Completa nombre y datos válidos', true);
  const q = qData();
  const srv = await S.servicios.create({ tipo: $('#q-tipo').value, nombre, minutos_estimados: q.minutos, insumos_usados: q.insumos, margen_ganancia_pct: q.margenPct, costo_neto: lastQ.costo_neto, precio_final: lastQ.precio_final });
  if (order) {
    const cid = $('#q-cli').value; if (!cid) { toast('Servicio guardado. Elige un cliente para el pedido', true); return load('servicios'); }
    await S.pedidos.create({ cliente_id: cid, servicio_id: srv.id, total_cobrado: lastQ.precio_final });
    await load('pedidos');
  }
  await load('servicios'); toast(order ? 'Pedido creado' : 'Servicio guardado');
});
$('#q-add').onclick = () => qRow();
$('#q-save').onclick = qSave(false); $('#q-order').onclick = qSave(true);
['#q-min', '#q-margen'].forEach((s) => $(s).addEventListener('input', quote));
$('#q-rows').addEventListener('input', quote);

/* ---------- Navegación y eventos ---------- */
function go(v) { $$('.view').forEach((x) => x.classList.toggle('on', x.id === 'v-' + v)); $$('.nav[data-view]').forEach((x) => x.classList.toggle('on', x.dataset.view === v)); if (v === 'dashboard') dash(); }
$$('.nav[data-view]').forEach((b) => (b.onclick = () => go(b.dataset.view)));
document.addEventListener('click', safe(async (e) => {
  const t = e.target.closest('[data-new],[data-edit],[data-del]'); if (!t) return;
  if (t.dataset.new) return openForm(t.dataset.new);
  const [n, id] = (t.dataset.edit || t.dataset.del).split(':');
  if (t.dataset.edit) return openForm(n, st[n].find((r) => r.id === id));
  if (confirm('¿Eliminar este registro?')) { await SCHEMA[n].svc.remove(id); toast('Eliminado'); await load(n); }
}));
addEventListener('resize', dash);

/* ---------- Auth ---------- */
let booted = false;
const showAuth = (on) => $('#auth').classList.toggle('on', on);
$('#auth-form').onsubmit = safe(async (e) => {
  e.preventDefault();
  const fd = new FormData(e.target), up = e.submitter?.value === 'up';
  const r = await (up ? S.auth.signUp : S.auth.signIn)(fd.get('email'), fd.get('password'));
  if (up && !r.session) toast('Cuenta creada. Confirma tu correo e ingresa.');
});
$('#logout').onclick = () => S.auth.signOut();
S.auth.onChange((s) => {
  showAuth(!s);
  if (s) { $('#me').textContent = s.user.email; $('#av').textContent = s.user.email[0].toUpperCase(); }
  if (s && !booted) { booted = true; loadAll(); S.realtime(['pedidos', 'inventario'], (t) => load(t)); }
  if (!s) { booted = false; location.reload(); }
});
S.auth.session().then((s) => showAuth(!s));
