import { requireAuth } from '../core/auth.js';
import { mountShell } from '../core/shell.js';
import { formModal } from '../core/modal.js';
import { $, money, moneyU, esc, toast } from '../core/utils.js';
import { costoManoObraMin, costoEnergiaMin } from '../calculator.js';
import * as S from '../services/index.js';

await requireAuth();
await mountShell('config');

const NUM = ['sueldo_base', 'horas_mes', 'precio_kwh', 'potencia_maquina_w', 'margen_defecto', 'ancho_tela_cm', 'merma_pct', 'dias_entrega'];
const TXT = ['nombre_taller', 'telefono_taller', 'direccion_taller', 'pie_recibo'];
const DEFAULTS = { sueldo_base: 0, horas_mes: 160, precio_kwh: 950, potencia_maquina_w: 500, margen_defecto: 30, ancho_tela_cm: 150, merma_pct: 8, dias_entrega: 3 };
const form = $('#form');

/* ---------- Carga ---------- */
try {
  const c = { ...DEFAULTS, ...((await S.config.get()) || {}) };
  [...NUM, ...TXT].forEach((k) => (form.elements[k].value = c[k] ?? ''));
} catch (e) { toast(e.message, true); }

/* ---------- Vista previa de costos por minuto ---------- */
function preview() {
  const v = (k) => Number(form.elements[k].value) || 0;
  const el = $('#cpv');
  try {
    const cm = costoManoObraMin(v('sueldo_base'), v('horas_mes')), em = costoEnergiaMin(v('potencia_maquina_w'), v('precio_kwh'));
    el.innerHTML = `<div><span>Mano de obra</span><span><b>${moneyU(cm)}</b> / min · ${money(cm * 60)} / hora</span></div>
      <div><span>Energía de la máquina</span><span><b>${moneyU(em)}</b> / min · ${money(em * 60)} / hora</span></div>
      <div class="tot"><span>Un trabajo de 30 min cuesta en producción</span><span>${money(30 * (cm + em))}</span></div>`;
  } catch { el.textContent = 'Revisa los valores: las horas al mes deben ser mayores que 0.'; }
}
form.addEventListener('input', () => { preview(); pintarMaq(); });
preview();

/* ---------- Máquinas ---------- */
let maq = [];
function pintarMaq() {
  const kwh = Number(form.elements.precio_kwh.value) || 0;
  $('#maq').innerHTML = maq.length
    ? maq.map((m) => `<div class="catrow"><span>${esc(m.nombre)} <small class="hint">· ${m.potencia_w} W · ${moneyU(costoEnergiaMin(m.potencia_w, kwh))}/min</small></span><span class="act"><button type="button" class="btn ghost sm" data-edit="${m.id}">Editar</button><button type="button" class="btn bad sm" data-del="${m.id}">Eliminar</button></span></div>`).join('')
    : '<div class="empty">Aún no tienes máquinas. Agrega la primera (plana, fileteadora…).</div>';
}
async function cargarMaq() { try { maq = await S.maquinas.list(); } catch (e) { toast(e.message, true); } pintarMaq(); }
async function editarMaq(row) {
  const v = await formModal({ title: row ? 'Editar máquina' : 'Nueva máquina', fields: [{ k: 'nombre', l: 'Nombre', req: 1, full: 1 }, { k: 'potencia_w', l: 'Potencia (W)', t: 'number', req: 1 }], values: row || {} });
  if (!v) return;
  if (!(v.potencia_w > 0)) return toast('La potencia debe ser mayor que 0', true);
  const out = { nombre: v.nombre.trim(), potencia_w: Math.round(v.potencia_w) };
  try { row ? await S.maquinas.update(row.id, out) : await S.maquinas.create(out); toast('Máquina guardada'); await cargarMaq(); } catch (e) { toast(e.message, true); }
}
$('#maq-add').onclick = () => editarMaq();
$('#maq').addEventListener('click', async (e) => {
  const ed = e.target.closest('[data-edit]'), del = e.target.closest('[data-del]');
  if (ed) editarMaq(maq.find((m) => m.id === ed.dataset.edit));
  else if (del && confirm('¿Eliminar esta máquina? Las recetas que la usen volverán a usar la potencia general.')) {
    try { await S.maquinas.remove(del.dataset.del); toast('Eliminada'); await cargarMaq(); } catch (err) { toast(err.message, true); }
  }
});
cargarMaq();

/* ---------- Guardar ---------- */
form.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!form.reportValidity()) return;
  const row = {};
  NUM.forEach((k) => (row[k] = Number(form.elements[k].value)));
  TXT.forEach((k) => (row[k] = form.elements[k].value.trim() || null));
  try { await S.config.save(row); document.dispatchEvent(new CustomEvent('taller:change', { detail: row.nombre_taller })); toast('Configuración guardada'); }
  catch (err) { toast(err.message, true); }
});

/* ---------- Respaldo ---------- */
$('#export').onclick = async () => {
  try {
    const [config, inventario, categorias, clientes, servicios, pedidos, pagos, maquinas] = await Promise.all([S.config.get(), S.inventario.list(), S.categorias.list(), S.clientes.list(), S.servicios.list(), S.pedidos.list(), S.pagos.list(), S.maquinas.list()]);
    const blob = new Blob([JSON.stringify({ exportado: new Date().toISOString(), config, inventario, categorias, clientes, servicios, pedidos, pagos, maquinas }, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `stitchpro-respaldo-${new Date().toISOString().slice(0, 10)}.json`;
    a.click(); URL.revokeObjectURL(a.href);
    try { localStorage.setItem('stitchpro-backup', String(Date.now())); } catch { /* sin almacenamiento */ }
    toast('Respaldo descargado');
  } catch (e) { toast(e.message, true); }
};