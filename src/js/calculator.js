/**
 * calculator.js — Lógica matemática pura de StitchPro (sin DOM ni red).
 * Los resultados monetarios se redondean a 2 decimales al final;
 * los intermedios conservan precisión completa.
 */

const num = (v, name) => {
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0) throw new RangeError(`${name} inválido: ${v}`);
  return n;
};

export const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

/** C_min = sueldoBase / (horasMes * 60) */
export function costoManoObraMin(sueldoBase, horasMes) {
  const h = num(horasMes, 'horasMes');
  if (h === 0) throw new RangeError('horasMes debe ser > 0');
  return num(sueldoBase, 'sueldoBase') / (h * 60);
}

/** E_min = (W / 1000) * (precioKwh / 60) */
export function costoEnergiaMin(potenciaW, precioKwh) {
  return (num(potenciaW, 'potenciaW') / 1000) * (num(precioKwh, 'precioKwh') / 60);
}

/**
 * Suma de materiales. insumos: [{insumo_id, cantidad}]
 * inventario: array o Map de {id, costo_unidad}
 */
export function costoMateriales(insumos = [], inventario = []) {
  const mapa = inventario instanceof Map ? inventario : new Map(inventario.map((i) => [i.id, i]));
  return insumos.reduce((acc, { insumo_id, cantidad }) => {
    const item = mapa.get(insumo_id);
    if (!item) throw new Error(`Insumo no encontrado: ${insumo_id}`);
    return acc + num(cantidad, 'cantidad') * num(item.costo_unidad, 'costo_unidad');
  }, 0);
}

/** C_neto = materiales + minutos * (C_min + E_min) */
export function costoNeto({ materiales = 0, minutos, cMin, eMin }) {
  return num(materiales, 'materiales') + num(minutos, 'minutos') * (cMin + eMin);
}

/** P_final = C_neto * (1 + margen/100) */
export function precioFinal(cNeto, margenPct) {
  return cNeto * (1 + num(margenPct, 'margenPct') / 100);
}

/**
 * Cotización completa.
 * @param {{minutos:number, insumos:Array, margenPct:number}} servicio
 * @param {{sueldo_base:number, horas_mes:number, precio_kwh:number, potencia_maquina_w:number}} config
 * @param {Array|Map} inventario
 */
export function cotizar(servicio, config, inventario) {
  const cMin = costoManoObraMin(config.sueldo_base, config.horas_mes);
  const eMin = costoEnergiaMin(config.potencia_maquina_w, config.precio_kwh);
  const materiales = costoMateriales(servicio.insumos, inventario);
  const cNeto = costoNeto({ materiales, minutos: servicio.minutos, cMin, eMin });
  const pFinal = precioFinal(cNeto, servicio.margenPct);

  return {
    desglose: {
      materiales: round2(materiales),
      manoObra: round2(servicio.minutos * cMin),
      energia: round2(servicio.minutos * eMin),
    },
    costo_neto: round2(cNeto),
    precio_final: round2(pFinal),
    ganancia: round2(pFinal - cNeto),
  };
}
