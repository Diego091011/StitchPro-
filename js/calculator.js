/** calculator.js — Lógica matemática pura (sin DOM ni red). Redondeo a 2 decimales solo al final. */
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
/** Suma de materiales. insumos: [{insumo_id, cantidad}] · inventario: array o Map de {id, costo_unidad} */
export function costoMateriales(insumos = [], inventario = []) {
  const mapa = inventario instanceof Map ? inventario : new Map(inventario.map((i) => [i.id, i]));
  return insumos.reduce((acc, { insumo_id, cantidad }) => {
    const item = mapa.get(insumo_id);
    if (!item) throw new Error(`Insumo no encontrado: ${insumo_id}`);
    return acc + num(cantidad, 'cantidad') * num(item.costo_unidad, 'costo_unidad');
  }, 0);
}
/** Energía de varias máquinas: usos [{maquina_id, minutos}] · maquinas [{id, potencia_w}]. Ignora máquinas que ya no existen. */
export function costoEnergiaMaquinas(usos = [], maquinas = [], precioKwh) {
  const mapa = new Map(maquinas.map((m) => [m.id, m]));
  return usos.reduce((a, u) => { const m = mapa.get(u.maquina_id); return m ? a + num(u.minutos, 'minutos máquina') * costoEnergiaMin(m.potencia_w, precioKwh) : a; }, 0);
}
/** C_neto = materiales + minutos * C_min + energía (energía = minutos * E_min si no se indica otra) */
export const costoNeto = ({ materiales = 0, minutos, cMin, eMin, energia }) => num(materiales, 'materiales') + num(minutos, 'minutos') * cMin + (energia ?? num(minutos, 'minutos') * eMin);
/** P_final = C_neto * (1 + margen/100) */
export const precioFinal = (cNeto, margenPct) => cNeto * (1 + num(margenPct, 'margenPct') / 100);

/**
 * Cotización completa. config: {sueldo_base, horas_mes, precio_kwh, potencia_maquina_w}
 * servicio.maquinas (opcional): [{maquina_id, minutos}]; si hay máquinas válidas, la energía sale de ellas; si no, de la potencia general.
 */
export function cotizar(servicio, config, inventario, maquinas = []) {
  const cMin = costoManoObraMin(config.sueldo_base, config.horas_mes);
  const eMin = costoEnergiaMin(config.potencia_maquina_w, config.precio_kwh);
  const materiales = costoMateriales(servicio.insumos, inventario);
  const ids = new Set(maquinas.map((m) => m.id)), usos = (servicio.maquinas || []).filter((u) => ids.has(u.maquina_id) && Number(u.minutos) > 0);
  const energia = usos.length ? costoEnergiaMaquinas(usos, maquinas, config.precio_kwh) : num(servicio.minutos, 'minutos') * eMin;
  const cNeto = costoNeto({ materiales, minutos: servicio.minutos, cMin, eMin, energia });
  const pFinal = precioFinal(cNeto, servicio.margenPct);
  return {
    desglose: { materiales: round2(materiales), manoObra: round2(servicio.minutos * cMin), energia: round2(energia) },
    costo_neto: round2(cNeto), precio_final: round2(pFinal), ganancia: round2(pFinal - cNeto),
  };
}