import { requireAuth } from '../core/auth.js';
import { mountShell } from '../core/shell.js';
import { formModal, infoModal } from '../core/modal.js';
import { $, esc, toast } from '../core/utils.js';
import { estimador } from '../core/estimador.js';
import * as S from '../services/index.js';

await requireAuth();
await mountShell('clientes');

/* Medidas agrupadas: [grupo, [[clave_en_jsonb, etiqueta], ...]] */
const GRUPOS = [
  ['Torso y busto', [['busto', 'Contorno de busto'], ['radio_busto', 'Radio de busto'], ['separacion_busto', 'Separación de busto'], ['altura_busto', 'Altura de busto'], ['ancho_torax', 'Ancho de tórax'], ['ancho_pecho', 'Ancho de pecho'], ['ancho_espalda', 'Ancho de espalda'], ['hombro', 'Hombro'], ['costado', 'Costado'], ['escote', 'Escote'], ['cuello', 'Contorno de cuello']]],
  ['Cintura y cadera', [['cintura', 'Contorno de cintura'], ['cadera', 'Contorno de cadera'], ['altura_cadera', 'Altura de cadera']]],
  ['Talles', [['talle_delantero', 'Talle frente'], ['talle_centro_delantero', 'Talle centro delantero'], ['talle_centro_posterior', 'Centro frente'], ['largo_talle', 'Centro atrás'], ['talle_atras', 'Talle atrás'], ['largo_talle_posterior', 'Largo de talle posterior']]],
  ['Largos', [['estatura', 'Estatura'], ['largo_blusa', 'Largo de blusa'], ['largo_falda', 'Largo de falda'], ['largo_pantalon', 'Largo de pantalón'], ['largo_falda_larga', 'Largo de falda larga total'], ['largo_chaqueta', 'Largo de chaqueta'], ['largo_bata', 'Largo de bata'], ['largo_capa', 'Largo de capa'], ['largo_abrigo', 'Largo de abrigo']]],
  ['Brazo y manga', [['contorno_brazo', 'Contorno de manga'], ['largo_interno_manga', 'Largo interno de manga']]],
  ['Tiro y ciza', [['tiro', 'Tiro'], ['ciza_delantero', 'Ciza delantero'], ['ciza_posterior', 'Ciza posterior']]],
  ['Contornos y anchos', [['ancho_bota', 'Contorno de bota'], ['contorno_rodilla', 'Contorno de rodilla'], ['contorno_puno', 'Contorno de puño'], ['contorno_ciza', 'Contorno de ciza']]],
];
const MED = GRUPOS.flatMap(([, items]) => items);
const RESUMEN = ['busto', 'cintura', 'cadera'];

/* Se toman completas pero se usan divididas: ancho/contorno → mitad (½) · contornos de cuerpo → cuarta (¼) */
const MITAD = ['contorno_brazo', 'contorno_puno', 'ancho_espalda', 'ancho_pecho', 'separacion_busto', 'ancho_torax'];
const CUARTA = ['cuello', 'busto', 'cintura', 'cadera', 'contorno_rodilla', 'ancho_bota'];
const f2 = (x) => new Intl.NumberFormat('es-CO', { maximumFractionDigits: 2 }).format(x);
const frac = (k, v) => (MITAD.includes(k) ? { s: '½', v: v / 2 } : CUARTA.includes(k) ? { s: '¼', v: v / 4 } : null);

const FIELDS = [
  { k: 'nombre_completo', l: 'Nombre completo', req: 1, full: 1 },
  { k: 'telefono', l: 'Teléfono / WhatsApp', full: 1 },
  ...GRUPOS.flatMap(([g, items]) => [{ t: 'section', l: `${g} (cm)` }, ...items.map(([k, l]) => ({ k: 'm_' + k, l, t: 'number' }))]),
  { t: 'section', l: 'Notas' },
  { k: 'notas', l: 'Notas', t: 'textarea', full: 1 },
];

let rows = [], inv = [], cfg = null, maq = [], Q = '';
const match = (r) => !Q || JSON.stringify(r).toLowerCase().includes(Q);
const wa = (t) => { const d = String(t || '').replace(/\D/g, ''); return d ? `https://wa.me/${d.length === 10 ? '57' + d : d}` : ''; };
const count = (r) => MED.filter(([k]) => r.medidas?.[k] != null).length;

async function load() {
  try { [rows, inv, cfg, maq] = await Promise.all([S.clientes.list(), S.inventario.list(), S.config.get(), S.maquinas.list()]); } catch (e) { toast(e.message, true); }
  render();
}

function render() {
  const list = rows.filter(match);
  $('#table').innerHTML = list.length
    ? `<table class="tbl"><thead><tr><th>Nombre</th><th>Teléfono</th><th>Medidas (cm)</th><th></th></tr></thead><tbody>${list.map((r) => {
      const n = count(r), clave = RESUMEN.filter((k) => r.medidas?.[k] != null).map((k) => `${k} ${r.medidas[k]}`).join(' · ');
      const link = wa(r.telefono);
      return `<tr><td>${esc(r.nombre_completo)}</td>
        <td>${esc(r.telefono || '—')} ${link ? `<a class="lnk" href="${link}" target="_blank" rel="noopener">WhatsApp</a>` : ''}</td>
        <td>${n ? `${clave || ''} <button class="btn ghost sm" data-ver="${r.id}">Ver las ${n}</button>` : '—'}</td>
        <td class="act"><button class="btn green sm" data-calc="${r.id}">Calcular prenda</button><button class="btn ghost sm" data-edit="${r.id}">Editar</button><button class="btn bad sm" data-del="${r.id}">Eliminar</button></td></tr>`;
    }).join('')}</tbody></table>`
    : `<div class="empty">${rows.length ? 'Sin resultados' : 'Aún no tienes clientes. Agrega el primero.'}</div>`;
}

function ver(r) {
  const html = GRUPOS.map(([g, items]) => {
    const has = items.filter(([k]) => r.medidas?.[k] != null);
    return has.length ? `<h4 class="sec">${g}</h4><div class="mgrid">${has.map(([k, l]) => { const f = frac(k, r.medidas[k]); return `<div><span>${l}</span><b>${r.medidas[k]} cm${f ? ` <small class="hint">· ${f.s} = ${f2(f.v)}</small>` : ''}</b></div>`; }).join('')}</div>` : '';
  }).join('') + (r.notas ? `<h4 class="sec">Notas</h4><p style="color:var(--tx)">${esc(r.notas)}</p>` : '');
  infoModal({ title: r.nombre_completo, html });
}

async function edit(row) {
  const values = { ...row, ...Object.fromEntries(MED.map(([k]) => ['m_' + k, row?.medidas?.[k]])) };
  const preview = (x) => {
    const fr = MED.map(([k, l]) => [l, x['m_' + k] != null ? frac(k, x['m_' + k]) : null]).filter(([, f]) => f);
    return fr.length ? `<div class="mgrid">${fr.map(([l, f]) => `<div><span>${l} (${f.s})</span><b>${f2(f.v)} cm</b></div>`).join('')}</div>` : 'Al escribir un contorno o ancho verás aquí su mitad (½) o su cuarta (¼).';
  };
  const v = await formModal({ title: row ? 'Editar cliente' : 'Nuevo cliente', fields: FIELDS, values, preview });
  if (!v) return;
  const medidas = { ...(row?.medidas || {}) };
  MED.forEach(([k]) => (v['m_' + k] == null ? delete medidas[k] : (medidas[k] = v['m_' + k])));
  const out = { nombre_completo: v.nombre_completo.trim(), telefono: v.telefono?.trim() || null, notas: v.notas?.trim() || null, medidas };
  try { row ? await S.clientes.update(row.id, out) : await S.clientes.create(out); toast('Guardado'); await load(); }
  catch (e) { toast(e.message, true); }
}

async function calcular(cliente) {
  if (!inv.length) return toast('Primero crea tus insumos (tela, hilo…) en Inventario', true);
  const v = await estimador({ cliente, inv, cfg, maq });
  if (!v) return;
  try {
    await S.pedidos.create({ cliente_id: cliente.id, servicio_id: null, estado: 'pendiente', total_cobrado: v.res.precio_final, notas: v.detalle,
      items: [{ servicio_id: null, nombre: v.nombre, prenda: v.prenda, tipo: 'confeccion', cantidad: 1, precio: v.res.precio_final, minutos: v.minutos, costo_neto: v.res.costo_neto, energia: v.res.desglose.energia, insumos: v.insumos }] });
    toast('Orden creada: ya la ves en Órdenes');
  } catch (e) { toast(e.message, true); }
}

$('#new').onclick = () => edit();
$('#page').addEventListener('click', async (e) => {
  const v = e.target.closest('[data-ver]'), ed = e.target.closest('[data-edit]'), del = e.target.closest('[data-del]'), calc = e.target.closest('[data-calc]');
  if (calc) calcular(rows.find((r) => r.id === calc.dataset.calc));
  else if (v) ver(rows.find((r) => r.id === v.dataset.ver));
  else if (ed) edit(rows.find((r) => r.id === ed.dataset.edit));
  else if (del && confirm('¿Eliminar este cliente?')) {
    try { await S.clientes.remove(del.dataset.del); toast('Eliminado'); await load(); }
    catch (err) { toast(/foreign key|23503/i.test(err.message) ? 'No se puede eliminar: tiene órdenes asociadas' : err.message, true); }
  }
});
document.addEventListener('shell:search', (e) => { Q = e.detail; render(); });
load();