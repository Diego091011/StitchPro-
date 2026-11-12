import { cotizar } from '../calculator.js';
import { money, moneyU, esc } from './utils.js';

export const PRENDAS = ['Pantalón', 'Camisa', 'Blusa', 'Vestido', 'Falda', 'Chaqueta', 'Abrigo', 'Short', 'Bata', 'Capa', 'Falda larga', 'Otra'];
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
export function recetaEditor({ item = null, inv, cfg, prendas = [], maq = [] }) {
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
        <label>Margen de ganancia %<input name="margen" type="number" min="0" step="any" required value="${item?.margen_ganancia_pct ?? cfg?.margen_defecto ?? 30}"></label>
      </div>
      <h4 class="sec" style="margin-top:16px">Materiales usados (cantidad en la unidad de uso)</h4>
      <div id="mrows"></div>
      <button type="button" class="btn ghost sm" id="madd">+ Agregar material</button>
      ${inv.length ? '' : '<p class="hint" style="margin-top:8px">No hay insumos: créalos primero en Inventario.</p>'}
      <h4 class="sec" style="margin-top:16px">Máquinas usadas (minutos en cada una)</h4>
      <div id="krows"></div>
      <button type="button" class="btn ghost sm" id="kadd">+ Agregar máquina</button>
      <p class="hint" style="margin-top:6px">${maq.length ? 'Sin máquinas se usa la potencia general de Configuración.' : 'No hay máquinas: créalas en Configuración. Mientras tanto se usa la potencia general.'}</p>
      <label style="margin-top:14px">Notas<textarea name="notas" rows="2">${esc(item?.notas)}</textarea></label>
      <div class="preview rpv" id="rpv"></div>
      <div class="modal-act"><button type="button" class="btn ghost" data-x>Cancelar</button><button class="btn green">Guardar receta</button></div></form>`;
    document.body.append(d);
    const f = d.querySelector('form'), rows = d.querySelector('#mrows'), krows = d.querySelector('#krows');
    f.tipo.value = item?.tipo || 'arreglo_rapido';
    let res = null, out = null;

    const mats = () => [...rows.children].map((r) => ({ insumo_id: r.children[0].value, cantidad: Number(r.children[1].value) || 0 })).filter((m) => m.insumo_id && m.cantidad > 0);
    const usos = () => [...krows.children].map((r) => ({ maquina_id: r.children[0].value, minutos: Number(r.children[1].value) || 0 })).filter((u) => u.maquina_id && u.minutos > 0);
    const input = () => ({ minutos: Math.round(Number(f.minutos.value) || 0), margenPct: Number(f.margen.value) || 0, insumos: mats(), maquinas: usos() });

    function update() {
      [...rows.children].forEach((r) => {
        const it = inv.find((i) => i.id === r.children[0].value), q = Number(r.children[1].value) || 0;
        r.children[2].textContent = it?.unidad_medida || '';
        r.children[3].textContent = it ? moneyU(it.costo_unidad * q) : '—';
      });
      [...krows.children].forEach((r) => { const m = maq.find((x) => x.id === r.children[0].value); r.children[3].textContent = m ? `${m.potencia_w} W` : '—'; });
      const pv = d.querySelector('#rpv');
      try {
        res = cotizar(input(), cfg || NOCFG, inv, maq);
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
    function addK(id = '', q = 30) {
      const r = document.createElement('div');
      r.className = 'mrow';
      r.innerHTML = `<select><option value="">Máquina…</option>${maq.map((m) => `<option value="${m.id}" ${m.id === id ? 'selected' : ''}>${esc(m.nombre)}</option>`).join('')}</select><input type="number" min="0" step="any" value="${q}"><small>min</small><b></b><button type="button" class="btn ghost sm" title="Quitar">✕</button>`;
      r.querySelector('button').onclick = () => { r.remove(); update(); };
      krows.append(r);
    }
    (item?.maquinas || []).filter((u) => maq.some((m) => m.id === u.maquina_id)).forEach((u) => addK(u.maquina_id, u.minutos));
    d.querySelector('#kadd').onclick = () => { if (!maq.length) return; addK(); update(); };
    (item?.insumos_usados || []).filter((m) => inv.some((i) => i.id === m.insumo_id)).forEach((m) => addRow(m.insumo_id, m.cantidad));
    d.querySelector('#madd').onclick = () => { addRow(); update(); };
    f.addEventListener('input', update);
    update();

    d.querySelector('[data-x]').onclick = () => d.close();
    f.onsubmit = (e) => {
      e.preventDefault();
      if (!f.reportValidity() || !res) return;
      const q = input();
      out = { tipo: f.tipo.value, nombre: f.nombre.value.trim(), prenda: f.prenda.value.trim() || null, minutos_estimados: q.minutos, insumos_usados: q.insumos, maquinas: q.maquinas,
        margen_ganancia_pct: q.margenPct, costo_neto: res.costo_neto, precio_final: res.precio_final, notas: f.notas.value.trim() || null };
      d.close();
    };
    d.addEventListener('close', () => { d.remove(); resolve(out); });
    d.showModal();
  });
}