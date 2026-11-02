import { cotizar } from '../calculator.js';
import { NOCFG } from './receta.js';
import { money, esc, toast } from './utils.js';

const ESTADOS = [['pendiente', 'Pendiente'], ['en_proceso', 'En proceso'], ['listo', 'Listo'], ['entregado', 'Entregado']];
const toInput = (iso) => { if (!iso) return ''; const d = new Date(iso); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const toISO = (v) => (v ? new Date(`${v}T12:00:00`).toISOString() : null); // mediodía local: evita corrimiento de día

/**
 * Editor de órdenes con varios ítems del catálogo (o ítems libres).
 * Guarda una "foto" de cada ítem (precio, materiales, costo) para que cambios futuros no alteren la orden.
 */
export function ordenEditor({ orden = null, cli, srv, inv, cfg }) {
  return new Promise((resolve) => {
    const d = document.createElement('dialog');
    d.className = 'wide';
    const it = (orden?.items || []).map((x) => ({ ...x }));
    const sumItems = () => it.reduce((a, x) => a + x.cantidad * x.precio, 0);
    const desc0 = orden ? Math.max(0, sumItems() - Number(orden.total_cobrado)) : 0;
    const grupo = (t, l) => { const l2 = srv.filter((s) => s.tipo === t); return l2.length ? `<optgroup label="${l}">${l2.map((s) => `<option value="${s.id}">${esc(s.nombre)}${s.prenda ? ' · ' + esc(s.prenda) : ''}</option>`).join('')}</optgroup>` : ''; };

    d.innerHTML = `<form method="dialog"><h3>${orden ? 'Editar orden' : 'Nueva orden'}</h3>
      <div class="form">
        <label class="full">Cliente<select name="cliente" required><option value="">Selecciona…</option>${cli.map((c) => `<option value="${c.id}" ${c.id === orden?.cliente_id ? 'selected' : ''}>${esc(c.nombre_completo)}</option>`).join('')}</select></label>
        <label>Estado<select name="estado">${ESTADOS.map(([k, l]) => `<option value="${k}" ${k === (orden?.estado || 'pendiente') ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
        <label>Fecha de entrega<input name="entrega" type="date" value="${toInput(orden?.fecha_entrega)}"></label>
      </div>
      <h4 class="sec" style="margin-top:16px">Servicios de la orden</h4>
      <div id="orows"></div>
      <select id="oadd" style="margin-top:6px"><option value="">+ Agregar servicio del catálogo…</option>${grupo('arreglo_rapido', 'Arreglos')}${grupo('confeccion', 'Prendas nuevas')}<option value="__libre__">✎ Ítem libre (sin receta)</option></select>
      <div class="form" style="margin-top:14px">
        <label>Descuento<input name="desc" type="number" min="0" step="any" value="${desc0}"></label>
        <label class="full">Notas<textarea name="notas" rows="2">${esc(orden?.notas)}</textarea></label>
      </div>
      <div class="preview rpv" id="otot"></div>
      <p class="hint" style="margin-top:8px">Al pasar la orden a "En proceso" se descuentan del inventario los materiales de cada receta.</p>
      <div class="modal-act"><button type="button" class="btn ghost" data-x>Cancelar</button><button class="btn green">Guardar orden</button></div></form>`;
    document.body.append(d);
    const f = d.querySelector('form'), rows = d.querySelector('#orows');
    let out = null;

    const totales = () => {
      const sub = sumItems(), desc = Number(f.desc.value) || 0, total = Math.max(0, sub - desc);
      const costo = it.reduce((a, x) => a + x.cantidad * Number(x.costo_neto || 0), 0);
      d.querySelector('#otot').innerHTML = `<div><span>Subtotal</span><span>${money(sub)}</span></div>${desc ? `<div><span>Descuento</span><span>− ${money(desc)}</span></div>` : ''}
        <div><span>Utilidad estimada</span><span>${money(total - costo)}</span></div><div class="tot"><span>Total a cobrar</span><span>${money(total)}</span></div>`;
      return total;
    };
    const draw = () => {
      rows.innerHTML = it.length ? it.map((x, i) => `<div class="orow"><span>${esc(x.nombre)}<small class="hint"> ${esc(x.prenda || (x.servicio_id ? '' : 'ítem libre'))}</small></span>
        <input type="number" min="1" step="1" value="${x.cantidad}" data-q="${i}" title="Cantidad"><input type="number" min="0" step="any" value="${x.precio}" data-p="${i}" title="Precio unitario">
        <b>${money(x.cantidad * x.precio)}</b><button type="button" class="btn ghost sm" data-rm="${i}">✕</button></div>`).join('') : '<p class="hint">Aún no hay servicios en esta orden.</p>';
      totales();
    };
    d.querySelector('#oadd').onchange = (e) => {
      const v = e.target.value; e.target.value = '';
      if (!v) return;
      if (v === '__libre__') {
        const nombre = (prompt('Nombre del ítem:') || '').trim(); if (!nombre) return;
        it.push({ servicio_id: null, nombre, cantidad: 1, precio: 0, minutos: 0, costo_neto: 0, insumos: [] });
      } else {
        const s = srv.find((x) => x.id === v);
        let precio = Number(s.precio_final);
        try { precio = cotizar({ minutos: s.minutos_estimados, margenPct: s.margen_ganancia_pct, insumos: s.insumos_usados || [] }, cfg || NOCFG, inv).precio_final; } catch { toast('Algún insumo de la receta ya no existe; se usó el precio guardado', true); }
        it.push({ servicio_id: s.id, nombre: s.nombre, prenda: s.prenda, tipo: s.tipo, cantidad: 1, precio, minutos: s.minutos_estimados, costo_neto: Number(s.costo_neto), insumos: s.insumos_usados || [] });
      }
      draw();
    };
    rows.addEventListener('input', (e) => {
      const q = e.target.dataset.q, p = e.target.dataset.p, i = q ?? p;
      if (i == null) return;
      q != null ? (it[i].cantidad = Math.max(1, Number(e.target.value) || 1)) : (it[i].precio = Number(e.target.value) || 0);
      e.target.closest('.orow').querySelector('b').textContent = money(it[i].cantidad * it[i].precio);
      totales();
    });
    rows.addEventListener('click', (e) => { const b = e.target.closest('[data-rm]'); if (b) { it.splice(Number(b.dataset.rm), 1); draw(); } });
    f.desc.addEventListener('input', totales);
    draw();

    d.querySelector('[data-x]').onclick = () => d.close();
    f.onsubmit = (e) => {
      e.preventDefault();
      if (!f.reportValidity()) return;
      if (!it.length) return toast('Agrega al menos un servicio', true);
      out = { cliente_id: f.cliente.value, servicio_id: it.find((x) => x.servicio_id)?.servicio_id || null, items: it, estado: f.estado.value,
        fecha_entrega: toISO(f.entrega.value), total_cobrado: totales(), notas: f.notas.value.trim() || null };
      d.close();
    };
    d.addEventListener('close', () => { d.remove(); resolve(out); });
    d.showModal();
  });
}