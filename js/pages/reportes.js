import { requireAuth } from '../core/auth.js';
import { mountShell } from '../core/shell.js';
import { saldo } from '../core/recibo.js';
import { spark } from '../core/charts.js';
import { ic } from '../core/icons.js';
import { $, money, moneyU, esc, toast } from '../core/utils.js';
import * as S from '../services/index.js';

await requireAuth();
await mountShell('reportes');

const col = (v) => getComputedStyle(document.documentElement).getPropertyValue(v).trim();
const st = { ped: [], inv: [] };
let meses = 6, R = null;

const itemsOf = (p) => (p.items?.length ? p.items : p.servicios ? [{ nombre: p.servicios.nombre, cantidad: 1, precio: p.total_cobrado, costo_neto: p.servicios.costo_neto, insumos: [] }] : []);
const costoDe = (p) => itemsOf(p).reduce((a, i) => a + (i.cantidad || 1) * Number(i.costo_neto || 0), 0);
const mk = (d) => d.getFullYear() * 12 + d.getMonth();
const n2 = (n) => new Intl.NumberFormat('es-CO', { maximumFractionDigits: 2 }).format(n);
const abrev = (n) => (n >= 1e6 ? (n / 1e6).toFixed(1) + 'M' : n >= 1e3 ? Math.round(n / 1e3) + 'k' : Math.round(n));

async function load() {
  try { [st.ped, st.inv] = await Promise.all([S.pedidos.list(), S.inventario.list()]); } catch (e) { toast(e.message, true); }
  calcular(); render();
}

/* ---------- Cálculo ---------- */
function calcular() {
  const hoy = new Date(), minPed = st.ped.length ? Math.min(...st.ped.map((p) => mk(new Date(p.fecha_ingreso)))) : mk(hoy);
  const n = meses || Math.min(24, mk(hoy) - minPed + 1), ini = mk(hoy) - n + 1;
  const keys = Array.from({ length: n }, (_, i) => ini + i);
  const z = () => keys.map(() => 0), idx = (d) => mk(new Date(d)) - ini;
  const ped = st.ped.filter((p) => idx(p.fecha_ingreso) >= 0);
  const ventas = z(), util = z(), cobrado = z(), porCobrar = z();
  ped.forEach((p) => {
    const i = idx(p.fecha_ingreso);
    ventas[i] += Number(p.total_cobrado); util[i] += Number(p.total_cobrado) - costoDe(p); porCobrar[i] += saldo(p);
  });
  st.ped.forEach((p) => (p.pagos || []).forEach((x) => { const i = idx(x.fecha); if (i >= 0) cobrado[i] += Number(x.monto); }));

  const srv = new Map(), cli = new Map(), mat = new Map();
  ped.forEach((p) => {
    const nom = p.clientes?.nombre_completo || '—', c = cli.get(nom) || { n: 0, v: 0 };
    c.n++; c.v += Number(p.total_cobrado); cli.set(nom, c);
    itemsOf(p).forEach((it) => {
      const q = it.cantidad || 1, s = srv.get(it.nombre) || { q: 0, v: 0 };
      s.q += q; s.v += q * Number(it.precio || 0); srv.set(it.nombre, s);
      (it.insumos || []).forEach((m) => mat.set(m.insumo_id, (mat.get(m.insumo_id) || 0) + q * Number(m.cantidad)));
    });
  });
  const sum = (a) => a.reduce((x, y) => x + y, 0);
  R = { keys, labels: keys.map((k) => new Date(Math.floor(k / 12), k % 12).toLocaleDateString('es-CO', { month: 'short' })), ventas, util, cobrado, porCobrar, n: ped.length,
    tot: { v: sum(ventas), u: sum(util), c: sum(cobrado), p: sum(porCobrar) }, srv: [...srv].sort((a, b) => b[1].v - a[1].v).slice(0, 8), cli: [...cli].sort((a, b) => b[1].v - a[1].v).slice(0, 8),
    mat: [...mat].map(([id, q]) => { const it = st.inv.find((i) => i.id === id); return it ? { nombre: it.nombre, unidad: it.unidad_medida, q, costo: q * Number(it.costo_unidad), stock: Number(it.stock_actual) } : null; }).filter(Boolean).sort((a, b) => b.costo - a.costo) };
}

/* ---------- Gráfico de barras (canvas) ---------- */
function barras(c, labels, series) {
  const r = devicePixelRatio || 1, w = (c.width = c.clientWidth * r), h = (c.height = c.clientHeight * r), x = c.getContext('2d');
  if (!w) return;
  const pl = 48 * r, pb = 26 * r, pt = 10 * r, max = Math.max(...series.flatMap((s) => s.data), 1), iw = w - pl, ih = h - pb - pt, gw = iw / labels.length, bw = Math.min(30 * r, (gw * 0.7) / series.length);
  x.font = `${11 * r}px system-ui`; x.strokeStyle = col('--glass-b'); x.lineWidth = 1;
  for (let i = 0; i <= 4; i++) {
    const y = pt + ih - (ih * i) / 4;
    x.beginPath(); x.moveTo(pl, y); x.lineTo(w, y); x.stroke();
    x.fillStyle = col('--mut'); x.textAlign = 'right'; x.fillText(abrev((max * i) / 4), pl - 6 * r, y + 4 * r);
  }
  labels.forEach((l, i) => {
    const cx = pl + gw * i + gw / 2;
    x.fillStyle = col('--mut'); x.textAlign = 'center'; x.fillText(l, cx, h - 8 * r);
    series.forEach((s, j) => {
      const bh = (ih * Math.max(s.data[i], 0)) / max, bx = cx - (bw * series.length) / 2 + bw * j;
      if (!bh) return;
      x.fillStyle = s.color; x.shadowColor = s.color; x.shadowBlur = 8 * r;
      x.beginPath(); x.roundRect(bx, pt + ih - bh, bw - 2 * r, bh, 4 * r); x.fill(); x.shadowBlur = 0;
    });
  });
}

/* ---------- Render ---------- */
const tabla = (cols, rows, vacio) => rows.length ? `<table class="tbl"><thead><tr>${cols.map((c) => `<th>${c}</th>`).join('')}</tr></thead><tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table>` : `<div class="empty">${vacio}</div>`;
const delta = (d) => { const [c, p] = [d.at(-1), d.at(-2)]; if (!p) return ''; const x = ((c - p) / p) * 100; return `<span class="${x >= 0 ? 'pos' : 'neg'}">${x >= 0 ? '↑ +' : '↓ '}${x.toFixed(1)}%</span> vs mes anterior`; };

function render() {
  const [cA, cG, cC, cW] = [col('--ac'), col('--ok'), col('--ac2'), col('--warn')];
  const card = (c, icon, l, v, sub, id) => `<div class="card kpi" style="--c:${c}">${ic(icon)}<div><small>${l}</small><b>${v}</b><span class="sub">${sub}</span></div><canvas id="${id}"></canvas></div>`;
  const t = R.tot, marg = t.v ? ((t.u / t.v) * 100).toFixed(1) : '0';
  $('#kpis').innerHTML = card(cA, 'trend', 'Ventas', money(t.v), `${R.n} órdenes · ${delta(R.ventas)}`, 'k1')
    + card(cG, 'sparkle', 'Utilidad estimada', money(t.u), `Margen real ${marg}%`, 'k2')
    + card(cC, 'money', 'Cobrado (abonos)', money(t.c), delta(R.cobrado), 'k3')
    + card(cW, 'clock', 'Por cobrar', money(t.p), 'Saldo de las órdenes del periodo', 'k4');
  [['k1', R.ventas, cA], ['k2', R.util.map((v) => Math.max(v, 0)), cG], ['k3', R.cobrado, cC], ['k4', R.porCobrar, cW]].forEach(([id, d, c]) => spark($('#' + id), d.length > 1 ? d : [0, ...d], c));

  const series = [{ name: 'Ventas', color: cA, data: R.ventas }, { name: 'Utilidad', color: cG, data: R.util }];
  $('#leg').innerHTML = series.map((s) => `<span style="color:${s.color}">●</span> ${s.name}`).join(' &nbsp; ');
  barras($('#ch'), R.labels, series);

  $('#t-srv').innerHTML = tabla(['Servicio', 'Cant.', 'Ingresos'], R.srv.map(([n, s]) => [esc(n), s.q, `<span class="pos">${money(s.v)}</span>`]), 'Sin ventas en el periodo');
  $('#t-cli').innerHTML = tabla(['Cliente', 'Órdenes', 'Total'], R.cli.map(([n, c]) => [esc(n), c.n, `<span class="pos">${money(c.v)}</span>`]), 'Sin ventas en el periodo');
  $('#t-mat').innerHTML = tabla(['Material', 'Consumo', 'Costo', 'Stock actual'], R.mat.map((m) => [esc(m.nombre), `${n2(m.q)} ${esc(m.unidad)}`, moneyU(m.costo), `<span class="${m.stock <= 0 ? 'low' : ''}">${n2(m.stock)} ${esc(m.unidad)}</span>`]), 'Sin consumo registrado en el periodo');
}

/* ---------- Eventos ---------- */
$('#per').addEventListener('click', (e) => {
  const b = e.target.closest('[data-m]'); if (!b) return;
  meses = Number(b.dataset.m);
  document.querySelectorAll('#per button').forEach((x) => x.classList.toggle('on', x === b));
  calcular(); render();
});
$('#csv').onclick = () => {
  const f = (v) => `"${String(v).replace(/"/g, '""')}"`;
  const l = [['Mes', 'Ventas', 'Utilidad', 'Cobrado', 'Por cobrar'], ...R.labels.map((m, i) => [m, R.ventas[i], R.util[i].toFixed(2), R.cobrado[i], R.porCobrar[i]]), [], ['Material', 'Consumo', 'Unidad', 'Costo'], ...R.mat.map((m) => [m.nombre, m.q.toFixed(2), m.unidad, m.costo.toFixed(2)])];
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob(['\ufeff' + l.map((r) => r.map(f).join(',')).join('\n')], { type: 'text/csv' }));
  a.download = `stitchpro-reporte-${new Date().toISOString().slice(0, 10)}.csv`; a.click(); URL.revokeObjectURL(a.href);
};
addEventListener('resize', () => R && render());
document.addEventListener('theme:change', () => R && render());
load();