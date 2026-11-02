/**
 * consumo.js — Estimación de tela y materiales a partir de las medidas del cliente.
 * Módulo puro (sin DOM). Todas las medidas en cm. Es una estimación de patronaje
 * por piezas rectangulares con holguras y costuras; ajusta los parámetros a tu forma de trabajar.
 */
const n = (v) => Number(v) || 0;

export const MEDIDAS_LABEL = { cintura: 'Cintura', cadera: 'Cadera', busto: 'Busto', largo_pantalon: 'Largo de pantalón', largo_falda: 'Largo de falda', largo_blusa: 'Largo de blusa / chaqueta', largo_talle: 'Largo de talle' };
export const MANGAS = [['Sin manga', 0], ['Corta', 22], ['Tres cuartos', 45], ['Larga', 60]];
export const VUELOS = [['Recta', 1], ['Evasé', 1.4], ['Amplia', 1.8], ['Vuelo completo', 2.5]];

/** req: medidas necesarias · minutos: tiempo base · hilo: yardas · extras: [{kw: palabras clave de inventario, qty}] */
export const PRENDAS = {
  pantalon: { nombre: 'Pantalón', req: ['cintura', 'cadera', 'largo_pantalon'], minutos: 240, hilo: 250, extras: [{ kw: ['cierre'], qty: 1 }, { kw: ['boton'], qty: 1 }] },
  short: { nombre: 'Short', req: ['cintura', 'cadera'], minutos: 150, hilo: 130, extras: [{ kw: ['cierre'], qty: 1 }, { kw: ['boton'], qty: 1 }] },
  falda: { nombre: 'Falda', req: ['cintura', 'cadera', 'largo_falda'], minutos: 150, hilo: 120, vuelo: true, extras: [{ kw: ['cierre'], qty: 1 }, { kw: ['boton'], qty: 1 }] },
  blusa: { nombre: 'Blusa / Camisa', req: ['busto', 'largo_blusa'], minutos: 180, hilo: 150, manga: true, mangaDef: 22, extras: [{ kw: ['boton'], qty: 6 }] },
  vestido: { nombre: 'Vestido', req: ['busto', 'cintura', 'cadera', 'largo_talle', 'largo_falda'], minutos: 360, hilo: 250, manga: true, mangaDef: 0, vuelo: true, extras: [{ kw: ['cierre'], qty: 1 }] },
  chaqueta: { nombre: 'Chaqueta', req: ['busto', 'largo_blusa'], minutos: 480, hilo: 300, manga: true, mangaDef: 60, forro: true, extras: [{ kw: ['boton'], qty: 4 }] },
};

/** Piezas rectangulares aproximadas: {n: nombre, w: ancho, h: largo, qty, f: va en el forro}. */
export function piezas(tipo, m, o = {}) {
  const L = (d) => n(o.largo) || n(d), vuelo = n(o.vuelo) || 1;
  const mangas = (base) => (n(o.manga) > 0 ? [{ n: 'Mangas', w: n(m.busto) / 3 + base, h: n(o.manga) + 5, qty: 2, f: 1 }] : []);
  switch (tipo) {
    case 'pantalon': case 'short': {
      const l = tipo === 'short' ? n(o.largo) || 45 : L(m.largo_pantalon);
      return [{ n: 'Delanteros', w: n(m.cadera) / 4 + 9, h: l + 7, qty: 2 }, { n: 'Traseros', w: n(m.cadera) / 4 + 11, h: l + 7, qty: 2 }, { n: 'Pretina', w: n(m.cintura) + 12, h: 9, qty: 1 }, { n: 'Bolsillos', w: 20, h: 25, qty: 2 }];
    }
    case 'falda': return [{ n: 'Paneles', w: (n(m.cadera) / 2 + 10) * vuelo, h: L(m.largo_falda) + 6, qty: 2 }, { n: 'Pretina', w: n(m.cintura) + 10, h: 8, qty: 1 }];
    case 'blusa': return [{ n: 'Delantero y espalda', w: n(m.busto) / 2 + 8, h: L(m.largo_blusa) + 5, qty: 2 }, ...mangas(6), { n: 'Cuello y detalles', w: 40, h: 12, qty: 1 }];
    case 'vestido': return [{ n: 'Cuerpo', w: n(m.busto) / 2 + 8, h: n(m.largo_talle) + 6, qty: 2, f: 1 }, { n: 'Falda', w: (n(m.cadera) / 2 + 10) * vuelo, h: L(m.largo_falda) + 6, qty: 2, f: 1 }, ...mangas(6)];
    case 'chaqueta': {
      const l = L(m.largo_blusa);
      return [{ n: 'Frentes', w: n(m.busto) / 4 + 12, h: l + 8, qty: 2, f: 1 }, { n: 'Espalda', w: n(m.busto) / 2 + 12, h: l + 8, qty: 1, f: 1 }, ...mangas(8), { n: 'Solapa y bolsillos', w: 60, h: 30, qty: 1 }];
    }
    default: return [];
  }
}

/** Metros de tela: agrupa piezas de igual largo en filas a lo ancho de la tela; suma merma y redondea a 5 cm. */
export function metrosTela(ps, ancho = 150, { merma = 8, estampado = false, soloForro = false } = {}) {
  const W = Math.max(30, n(ancho) - 4), grupos = new Map();
  ps.filter((p) => !soloForro || p.f).forEach((p) => {
    let { w, qty } = p;
    if (w > W) { const s = Math.ceil(w / W); qty *= s; w /= s; }
    grupos.set(p.h, (grupos.get(p.h) || 0) + w * qty);
  });
  let cm = 0;
  grupos.forEach((tw, h) => (cm += Math.ceil(tw / W) * h));
  cm *= 1 + n(merma) / 100;
  if (estampado) cm *= 1.12;
  return Math.ceil(cm / 5) / 20;
}

const M_POR = { metro: 1, yarda: 0.9144, cm: 0.01 };
/** Convierte metros a la unidad de uso del insumo (null si no es una medida de largo). */
export const aUnidad = (metros, unidad) => (M_POR[unidad] ? metros / M_POR[unidad] : null);
export const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');