import { cotizar } from '../calculator.js';
import { money, moneyU, esc } from './utils.js';

export const PRENDAS = ['Pantalón', 'Camisa', 'Blusa', 'Vestido', 'Falda', 'Chaqueta', 'Abrigo', 'Short', 'Otra'];
export const NOCFG = { sueldo_base: 0, horas_mes: 160, precio_kwh: 0, potencia_maquina_w: 0 };

/** <optgroup> de insumos agrupados por categoría. */
export const insumoOptions = (inv, sel = '') => {
  const g = {};
  inv.forEach((i) => (g[i.categoria] ||= []).push(i));
  return Object.entries(g).map(([c, items]) => `<optgroup label="${esc(c)}">${items.map((i) =>
    `<option value="${i.id}" ${i.id === sel ? 'selected' : ''}>${esc(i.nombre)} · ${moneyU(i.costo_unidad)}/${esc(i.unidad_medida)}</option>`).join('')}</optgroup>`).join('');
};

/**
 * Editor de receta (arreglo o prenda con sus materiales) con precio en vivo.
 * Devuelve el payload listo para guardar en `servicios`, o null si se cancela.
 */
export function recetaEditor({ item = null, inv, cfg, prendas = [] }) {
  return new Promise((resolve) => {
    const d = document.createElement('dialog');
    d.className = 'wide';
    const lista = [...new Set([...PRENDAS, ...prendas])];
    d.innerHTML = `<form method="dialog"><h3>${item?.id ? 'Editar' : 'Nueva'} receta</h3>
      ${cfg ? '' : '<div class="warn">Aún no defines tus costos base: mano de obra y energía cuentan como $0.</div>'}
      <div class="form">
        <label class="full">Nombre<input name="nombre" required placeholder="Ej. Ajuste de cintura · Vestido de gala" value="${esc(item?.nombre)}"></label>
        <label>Tipo<select name="tipo"><option value="arreglo_rapido">Arreglo</option><option value="confeccion">Prenda nueva</option></select></label>
        <label>Tipo de prenda<input name="prenda" list="prendas-dl" placeholder="Pantalón, Falda…" value="${esc(item?.prenda)}"><datalist id="prendas-dl">${lista.map((p) => `<option value="${esc(p)}">`).join('')}</datalist></label>
        <label>Tiempo estimado (minutos)<input name="minutos" type="number" min="0" step="1" required value="${item?.minutos_estimados ?? 30}"></label>
        <label>Margen de ganancia %<input name="margen" type="number" min="0" step="any" required value="${item?.margen_ganancia_pct ?? 30}"></label>
      </div>
      <h4 class="sec" style="margin-top:16px">Materiales usados (cantidad en la unidad de uso)</h4>
      <div id="mrows"></div>
      <button type="button" class="btn ghost sm" id="madd">+ Agregar material</button>
      ${inv.length ? '' : '<p class="hint" style="margin-top:8px">No hay insumos: créalos primero en Inventario.</p>'}
      <label style="margin-top:14px">Notas<textarea name="notas" rows="2">${esc(item?.notas)}</textarea></label>
      <div class="preview rpv" id="rpv"></div>
      <div class="modal-act"><button type="button" class="btn ghost" data-x>Cancelar</button><button class="btn green">Guardar receta</button></div></form>`;
    document.body.append(d);
    const f = d.querySelector('form'), rows = d.querySelector('#mrows');
    f.tipo.value = item?.tipo || 'arreglo_rapido';
    let res = null, out = null;

    const mats = () => [...rows.children].map((r) => ({ insumo_id: r.children[0].value, cantidad: Number(r.children[1].value) || 0 })).filter((m) => m.insumo_id && m.cantidad > 0);
    const input = () => ({ minutos: Math.round(Number(f.minutos.value) || 0), margenPct: Number(f.margen.value) || 0, insumos: mats() });

    function update() {
      [...rows.children].forEach((r) => {
        const it = inv.find((i) => i.id === r.children[0].value), q = Number(r.children[1].value) || 0;
        r.children[2].textContent = it?.unidad_medida || '';
        r.children[3].textContent = it ? moneyU(it.costo_unidad * q) : '—';
      });
      const pv = d.querySelector('#rpv');
      try {
        res = cotizar(input(), cfg || NOCFG, inv);
        const x = res.desglose;
        pv.innerHTML = `<div><span>Materiales</span><span>${money(x.materiales)}</span></div><div><span>Mano de obra</span><span>${money(x.manoObra)}</span></div><div><span>Energía</span><span>${money(x.energia)}</span></div>
          <div><span>Costo neto</span><span>${money(res.costo_neto)}</span></div><div class="tot"><span>Precio final</span><span>${money(res.precio_final)}</span></div>`;
      } catch (e) { res = null; pv.textContent = e.message; }
    }
    function addRow(id = '', q = 1) {
      const r = document.createElement('div');
      r.className = 'mrow';
      r.innerHTML = `<select><option value="">Material…</option>${insumoOptions(inv, id)}</select><input type="number" min="0" step="any" value="${q}"><small></small><b></b><button type="button" class="btn ghost sm" title="Quitar">✕</button>`;
      r.querySelector('button').onclick = () => { r.remove(); update(); };
      rows.append(r);
    }
    (item?.insumos_usados || []).filter((m) => inv.some((i) => i.id === m.insumo_id)).forEach((m) => addRow(m.insumo_id, m.cantidad));
    d.querySelector('#madd').onclick = () => { addRow(); update(); };
    f.addEventListener('input', update);
    update();

    d.querySelector('[data-x]').onclick = () => d.close();
    f.onsubmit = (e) => {
      e.preventDefault();
      if (!f.reportValidity() || !res) return;
      const q = input();
      out = { tipo: f.tipo.value, nombre: f.nombre.value.trim(), prenda: f.prenda.value.trim() || null, minutos_estimados: q.minutos, insumos_usados: q.insumos,
        margen_ganancia_pct: q.margenPct, costo_neto: res.costo_neto, precio_final: res.precio_final, notas: f.notas.value.trim() || null };
      d.close();
    };
    d.addEventListener('close', () => { d.remove(); resolve(out); });
    d.showModal();
  });
}