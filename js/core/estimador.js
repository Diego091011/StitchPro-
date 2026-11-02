import { cotizar } from '../calculator.js';
import { PRENDAS, MEDIDAS_LABEL, MANGAS, VUELOS, piezas, metrosTela, aUnidad, norm } from './consumo.js';
import { NOCFG, insumoOptions } from './receta.js';
import { $, $$, money, moneyU, esc } from './utils.js';

const r2 = (x) => Math.ceil(x * 100) / 100;

/**
 * Calcula tela, materiales y precio de una prenda a la medida de un cliente.
 * Devuelve {nombre, prenda, minutos, margen, insumos, res, detalle} o null si se cancela.
 */
export function estimador({ cliente, inv, cfg }) {
  return new Promise((resolve) => {
    const med = cliente.medidas || {}, primero = cliente.nombre_completo.split(' ')[0];
    const find = (kw) => inv.find((i) => kw.some((k) => norm(i.categoria).includes(k) || norm(i.nombre).includes(k)));
    const d = document.createElement('dialog');
    d.className = 'wide';
    d.innerHTML = `<form method="dialog"><h3>Calcular prenda a medida · ${esc(cliente.nombre_completo)}</h3>
      ${cfg ? '' : '<div class="warn">Aún no defines tus costos base: mano de obra y energía cuentan como $0.</div>'}
      <div class="form">
        <label>Prenda<select id="e-tipo">${Object.entries(PRENDAS).map(([k, p]) => `<option value="${k}">${p.nombre}</option>`).join('')}</select></label>
        <label>Tiempo estimado (min)<input id="e-min" type="number" min="0" step="1"></label>
        <label>Margen de ganancia %<input id="e-margen" type="number" min="0" step="any" value="30"></label>
        <label>Nombre en la orden<input id="e-nombre"></label>
      </div>
      <div id="dyn"></div>
      <div class="preview rpv" id="e-pv"></div>
      <div class="modal-act"><button type="button" class="btn ghost" data-x>Cancelar</button><button class="btn green" id="e-ok">Crear orden</button></div></form>`;
    document.body.append(d);

    let tipo = 'pantalon', extra = [], res = null, out = null, meta = null;
    const P = () => PRENDAS[tipo];

    function iniciarExtras() {
      extra = [];
      const hilo = find(['hilo']);
      if (hilo) { const q = aUnidad(P().hilo * 0.9144, hilo.unidad_medida); extra.push({ insumo_id: hilo.id, cantidad: q ? Math.ceil(q) : P().hilo }); }
      P().extras.forEach((e) => { const it = find(e.kw); if (it) extra.push({ insumo_id: it.id, cantidad: e.qty }); });
    }
    function filas() {
      $('#e-rows', d).innerHTML = extra.map((x, i) => `<div class="mrow"><select data-i="${i}"><option value="">Material…</option>${insumoOptions(inv, x.insumo_id)}</select>
        <input type="number" min="0" step="any" value="${x.cantidad}" data-q="${i}"><small></small><b></b><button type="button" class="btn ghost sm" data-rm="${i}">✕</button></div>`).join('');
    }
    function dibujar() {
      const p = P(), tela = find(['tela']), forro = find(['forro']) || tela;
      $('#dyn', d).innerHTML = `<h4 class="sec" style="margin-top:16px">Medidas de ${esc(primero)} (cm)</h4>
        <div class="form">${p.req.map((k) => `<label>${MEDIDAS_LABEL[k]}<input type="number" min="0" step="any" data-m="${k}" value="${med[k] ?? ''}" class="${med[k] == null ? 'miss' : ''}" placeholder="falta"></label>`).join('')}</div>
        <h4 class="sec" style="margin-top:16px">Ajustes de la prenda</h4>
        <div class="form">
          <label>Ancho de la tela (cm)<input id="e-ancho" type="number" min="60" value="150"></label>
          ${p.manga ? `<label>Manga<select id="e-manga">${MANGAS.map(([l, v]) => `<option value="${v}" ${v === p.mangaDef ? 'selected' : ''}>${l}</option>`).join('')}</select></label>` : ''}
          ${p.vuelo ? `<label>Vuelo de la falda<select id="e-vuelo">${VUELOS.map(([l, v]) => `<option value="${v}">${l}</option>`).join('')}</select></label>` : ''}
          <label>Largo (cm) · vacío = medida del cliente<input id="e-largo" type="number" min="0" step="any"></label>
          <label>Merma %<input id="e-merma" type="number" min="0" value="8"></label>
          <label style="flex-direction:row;align-items:center"><input id="e-est" type="checkbox" style="width:auto"> Tela estampada o con dirección (+12%)</label>
        </div>
        <h4 class="sec" style="margin-top:16px">Materiales</h4>
        <div class="mrow"><select id="e-tela"><option value="">Tela…</option>${insumoOptions(inv, tela?.id)}</select><input id="e-telaq" readonly><small id="e-telau"></small><b id="e-telac"></b><span></span></div>
        ${p.forro ? `<div class="mrow"><select id="e-forro"><option value="">Forro…</option>${insumoOptions(inv, forro?.id)}</select><input id="e-forroq" readonly><small id="e-forrou"></small><b id="e-forroc"></b><span></span></div>` : ''}
        <div id="e-rows"></div><button type="button" class="btn ghost sm" id="e-add">+ Agregar material</button>`;
      filas();
    }

    function calcular() {
      const p = P(), m = {};
      $$('[data-m]', d).forEach((i) => (m[i.dataset.m] = Number(i.value) || 0));
      $$('[data-m]', d).forEach((i) => i.classList.toggle('miss', !Number(i.value)));
      const falta = p.req.filter((k) => !m[k]), pv = $('#e-pv', d);
      res = null;
      if (falta.length) { pv.innerHTML = `Faltan medidas: <b>${falta.map((k) => MEDIDAS_LABEL[k]).join(', ')}</b>. Complétalas arriba (no se guardan en el cliente).`; return; }
      const o = { largo: Number($('#e-largo', d).value) || 0, manga: p.manga ? Number($('#e-manga', d).value) : 0, vuelo: p.vuelo ? Number($('#e-vuelo', d).value) : 1 };
      const ps = piezas(tipo, m, o), opt = { merma: Number($('#e-merma', d).value) || 0, estampado: $('#e-est', d).checked };
      const ancho = Number($('#e-ancho', d).value) || 150;
      const insumos = [], notas = [];
      const linea = (idSel, qSel, uSel, cSel, metros, nombre) => {
        const it = inv.find((i) => i.id === $(idSel, d).value);
        if (!it) { $(qSel, d).value = ''; $(uSel, d).textContent = ''; $(cSel, d).textContent = '—'; return; }
        const q = aUnidad(metros, it.unidad_medida);
        if (q == null) { $(qSel, d).value = ''; $(cSel, d).textContent = 'unidad ✗'; notas.push(`La unidad de uso de "${it.nombre}" debe ser metro, yarda o cm.`); return; }
        const cant = r2(q);
        $(qSel, d).value = cant; $(uSel, d).textContent = it.unidad_medida; $(cSel, d).textContent = moneyU(it.costo_unidad * cant);
        insumos.push({ insumo_id: it.id, cantidad: cant }); notas.push(`${nombre}: ${metros.toFixed(2)} m`);
      };
      const mTela = metrosTela(ps, ancho, opt);
      linea('#e-tela', '#e-telaq', '#e-telau', '#e-telac', mTela, 'Tela');
      if (p.forro) linea('#e-forro', '#e-forroq', '#e-forrou', '#e-forroc', metrosTela(ps, ancho, { ...opt, soloForro: true }), 'Forro');
      extra.forEach((x, i) => {
        const it = inv.find((v) => v.id === x.insumo_id), row = $$('#e-rows .mrow', d)[i];
        if (!it || !(x.cantidad > 0)) { if (row) { row.children[2].textContent = it?.unidad_medida || ''; row.children[3].textContent = '—'; } return; }
        insumos.push({ insumo_id: it.id, cantidad: x.cantidad });
        row.children[2].textContent = it.unidad_medida; row.children[3].textContent = moneyU(it.costo_unidad * x.cantidad);
      });
      try {
        const minutos = Math.round(Number($('#e-min', d).value) || 0), margen = Number($('#e-margen', d).value) || 0;
        res = cotizar({ minutos, margenPct: margen, insumos }, cfg || NOCFG, inv);
        const x = res.desglose;
        pv.innerHTML = `<div><span>Tela estimada</span><span>${mTela.toFixed(2)} m${p.forro ? ' (+ forro)' : ''}</span></div>
          <div><span>Materiales</span><span>${money(x.materiales)}</span></div><div><span>Mano de obra (${minutos} min)</span><span>${money(x.manoObra)}</span></div><div><span>Energía</span><span>${money(x.energia)}</span></div>
          <div><span>Costo neto</span><span>${money(res.costo_neto)}</span></div><div class="tot"><span>Precio final</span><span>${money(res.precio_final)}</span></div>
          ${notas.some((t) => t.startsWith('La unidad')) ? `<div class="warn">${esc(notas.find((t) => t.startsWith('La unidad')))}</div>` : ''}`;
        meta = { minutos, margen, detalle: `Calculado por medidas · ${notas.filter((t) => !t.startsWith('La unidad')).join(' · ')} · ancho de tela ${ancho} cm` };
        meta.insumos = insumos;
      } catch (e) { res = null; pv.textContent = e.message; }
    }

    function cambiarPrenda() {
      tipo = $('#e-tipo', d).value;
      $('#e-min', d).value = P().minutos; $('#e-nombre', d).value = `${P().nombre} a medida · ${primero}`;
      iniciarExtras(); dibujar(); calcular();
    }

    d.addEventListener('input', (e) => {
      const q = e.target.dataset.q, i = e.target.dataset.i;
      if (q != null) extra[q].cantidad = Number(e.target.value) || 0;
      if (i != null) extra[i].insumo_id = e.target.value;
      if (e.target.id === 'e-tipo') return cambiarPrenda();
      calcular();
    });
    d.addEventListener('click', (e) => {
      if (e.target.id === 'e-add') { extra.push({ insumo_id: '', cantidad: 1 }); filas(); calcular(); }
      const rm = e.target.closest('[data-rm]');
      if (rm) { extra.splice(Number(rm.dataset.rm), 1); filas(); calcular(); }
    });
    d.querySelector('[data-x]').onclick = () => d.close();
    d.querySelector('form').onsubmit = (e) => {
      e.preventDefault();
      calcular();
      if (!res) return;
      out = { nombre: $('#e-nombre', d).value.trim() || `${P().nombre} a medida`, prenda: P().nombre, minutos: meta.minutos, margen: meta.margen, insumos: meta.insumos, res, detalle: meta.detalle };
      d.close();
    };
    d.addEventListener('close', () => { d.remove(); resolve(out); });
    cambiarPrenda();
    d.showModal();
  });
}